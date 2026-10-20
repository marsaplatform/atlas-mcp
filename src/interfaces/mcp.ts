import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { ATLAS_VERSION, type AtlasService } from "../application/atlas-service";
import { recordTypes } from "../domain/models";
import type { Locale } from "../i18n";

type ServerOptions = ConstructorParameters<typeof McpServer>[1];

const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const locale = z.enum(["ar", "en"]).optional().describe("Language for human-readable text (disclaimers, notes, markdown). Default: ar. Record text keeps its original language. / لغة النصوص البشرية؛ الافتراضي العربية.");
const governorate = z.string().min(2).max(100).describe("Egyptian governorate or city in Arabic or English, e.g. «الجيزة», «6 أكتوبر», \"Giza\", \"EG-GZ\".");
const nationality = z.string().min(2).max(100).describe("Nationality or country in Arabic or English, e.g. «سوداني», «السودان», \"Sudanese\", \"SDN\".");
const recordId = z.string().min(2).max(200).describe("Atlas record id, e.g. wp:marsa_service:57 (from any search result).");
const recordStatus = z.enum(["source_backed", "community_submitted", "demo"]);

const sourcesText = (value: Record<string, unknown>): string => {
  const sources = Array.isArray(value.sources) ? (value.sources as Array<{ title?: string; url?: string; lastVerified?: string }>) : [];
  if (sources.length === 0) return "";
  return `\n\nSources / المصادر:\n${sources.slice(0, 25).map((source) => `- ${source.title ?? ""} — ${source.url ?? ""}${source.lastVerified ? ` (${source.lastVerified})` : ""}`).join("\n")}`;
};

/** Every tool returns the full payload as structuredContent and a readable text block that always ends with its sources. */
const toolResult = (value: object): CallToolResult => {
  const record = value as Record<string, unknown>;
  const lead = typeof record.markdown === "string" ? `${record.markdown}\n\n` : typeof record.content === "string" && typeof record.format === "string" ? `${record.content}\n\n` : "";
  return { content: [{ type: "text", text: `${lead}${JSON.stringify(record, null, 2)}${sourcesText(record)}` }], structuredContent: record };
};

const safely = <A>(handler: (args: A) => Promise<object> | object) => async (args: A): Promise<CallToolResult> => {
  try {
    return toolResult(await handler(args));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { isError: true, content: [{ type: "text", text: `Atlas could not complete this request: ${message}. The data source may be temporarily unavailable — retry shortly, or try get_coverage to check connectivity. / تعذّر إكمال الطلب؛ أعد المحاولة بعد قليل.` }] };
  }
};

const withSources = { sources: z.array(z.unknown()), attribution: z.string(), warnings: z.array(z.string()).optional() };

export function createMcpServer(service: AtlasService, options?: ServerOptions): McpServer {
  const server = new McpServer({ name: "marsa-atlas", title: "Marsa Atlas — أطلس مرسى", version: ATLAS_VERSION, websiteUrl: "https://atlas.marsaplatform.com" }, {
    ...options,
    instructions: "Marsa Atlas (أطلس مرسى): source-grounded services, organizations, law and data on migration and asylum in Egypt. Arabic-first; inputs accept Arabic or English, including Arabic governorate and nationality names. Every result carries `sources` with URLs and lastVerified dates — cite them. Eligibility checks are indicative only. Never send personal case data.",
  });

  // ── Core tools (unchanged names since 0.1.0) ───────────────────────────────
  server.registerTool("search_atlas", {
    title: "Search Marsa Atlas",
    description: "بحث عربي موحد وموثق في الخدمات والجهات والقانون والبيانات المرتبطة بالهجرة واللجوء في مصر. Unified search across services, organizations, legal references, datasets and indicators; Arabic or English queries; falls back to Arabic-aware local ranking when the exact phrase has no match.",
    inputSchema: { query: z.string().min(2).max(500), types: z.array(z.enum(recordTypes)).default([]), limit: z.number().int().min(1).max(50).default(10), locale },
    outputSchema: z.looseObject({ query: z.string(), count: z.number(), items: z.array(z.unknown()), ...withSources }),
    annotations: readOnly,
  }, safely(async (input) => service.search(input)));

  server.registerTool("find_services", {
    title: "Find migration services in Egypt",
    description: "اكتشاف خدمات حسب الاحتياج والمحافظة والأهلية مع المصدر وتاريخ آخر تحقق. Find services by need («دعم نفسي», \"legal aid\", «مدرسة»), governorate («6 أكتوبر» → الجيزة) and nationality; needs are mapped to the directory's service types.",
    inputSchema: { need: z.string().min(2).max(300), governorate: governorate.optional(), eligibility: z.string().min(2).optional().describe("Eligibility label as written on records, e.g. «نساء», «أطفال», «جميع الجنسيات»."), nationality: nationality.optional(), limit: z.number().int().min(1).max(50).default(10), locale },
    outputSchema: z.looseObject({ query: z.string(), count: z.number(), items: z.array(z.unknown()), disclaimer: z.string(), ...withSources }),
    annotations: readOnly,
  }, safely(async (input) => service.findServices(input)));

  server.registerTool("check_eligibility", {
    title: "Check indicative eligibility",
    description: "فحص إرشادي غير ملزم لأهلية خدمة. لا يمثل قرارًا نهائيًا من الجهة. Indicative, non-binding check of a profile (nationality, governorate, groups such as women/children/refugees) against a service's listed conditions. Never a final decision.",
    inputSchema: { serviceId: z.string().min(2), profile: z.object({ nationality: z.string().optional(), governorate: z.string().optional(), groups: z.array(z.string()).max(10).optional().describe("e.g. [\"نساء\"], [\"refugees\", \"children\"]") }), locale },
    outputSchema: z.looseObject({ found: z.boolean(), decision: z.enum(["unknown", "needs_confirmation"]), reasons: z.array(z.string()), service: z.unknown().optional(), disclaimer: z.string(), sources: z.array(z.unknown()) }),
    annotations: readOnly,
  }, safely(async (input) => service.checkEligibility(input)));

  server.registerTool("build_research_brief", {
    title: "Build a source-grounded research brief",
    description: "بناء موجز بحثي عربي يحافظ على المصادر وتواريخ التحقق وحدود التغطية. Research brief (markdown) with numbered citations and coverage notes.",
    inputSchema: { question: z.string().min(5).max(1000), limit: z.number().int().min(1).max(20).default(8), locale },
    outputSchema: z.looseObject({ question: z.string(), records: z.array(z.unknown()), citations: z.array(z.unknown()), coverageNotes: z.array(z.string()), markdown: z.string(), ...withSources }),
    annotations: readOnly,
  }, safely(async (input) => service.buildResearchBrief(input)));

  server.registerTool("get_coverage", {
    title: "Get Atlas coverage",
    description: "عرض حجم وتوزيع وتاريخ تغطية بيانات Marsa Atlas. Record counts by type and the latest verification date.",
    inputSchema: { locale },
    outputSchema: z.looseObject({ records: z.number(), byType: z.record(z.string(), z.number()), lastUpdated: z.string(), sources: z.array(z.unknown()) }),
    annotations: readOnly,
  }, safely(async ({ locale: lang }) => ({ ...(await service.coverage()), sources: [{ recordId: "reference:marsa-atlas", title: "Marsa Atlas coverage", url: "https://atlas.marsaplatform.com/api/v1/coverage", lastVerified: "" }], attribution: lang === "en" ? "Marsa Atlas — https://atlas.marsaplatform.com" : "أطلس مرسى — https://atlas.marsaplatform.com" })));

  // ── Records ───────────────────────────────────────────────────────────────
  server.registerTool("get_record", {
    title: "Get one Atlas record",
    description: "عرض سجل واحد كاملًا مع مصدره والسجلات المرتبطة (الجهة ← خدماتها). Full record by id with its source and related records (a service's provider, an organization's services).",
    inputSchema: { id: recordId, locale },
    annotations: readOnly,
  }, safely(async ({ id, locale: lang }) => service.getRecord(id, lang as Locale | undefined)));

  server.registerTool("list_records", {
    title: "List Atlas records",
    description: "تصفح السجلات حسب النوع والمحافظة وحالة التحقق مع ترقيم الصفحات. Browse records by type, governorate and record status, with paging.",
    inputSchema: { type: z.enum(recordTypes).optional(), governorate: governorate.optional(), status: recordStatus.optional(), limit: z.number().int().min(1).max(100).default(20), offset: z.number().int().min(0).default(0), locale },
    annotations: readOnly,
  }, safely(async (input) => service.listRecords(input)));

  // ── Organizations, law, data ───────────────────────────────────────────────
  server.registerTool("find_organizations", {
    title: "Find organizations",
    description: "البحث عن الجهات (منظمات ومبادرات) بالاسم أو نوع الخدمة أو المحافظة، مع عدد خدماتها. Find organizations by name, service type or governorate, with their service counts.",
    inputSchema: { query: z.string().min(2).max(200).optional(), governorate: governorate.optional(), serviceType: z.string().min(2).max(100).optional().describe("e.g. «صحة», \"legal aid\""), limit: z.number().int().min(1).max(50).default(20), locale },
    annotations: readOnly,
  }, safely(async (input) => service.findOrganizations(input)));

  server.registerTool("get_organization", {
    title: "Get an organization profile",
    description: "ملف جهة كامل مع كل خدماتها المسجلة ومصادرها. Organization profile plus every service it offers in Atlas. Accepts an id or a name in Arabic or English (e.g. \"StARS\", «مرسال»).",
    inputSchema: { idOrName: z.string().min(2).max(200), locale },
    annotations: readOnly,
  }, safely(async (input) => service.getOrganization(input)));

  server.registerTool("find_legal_references", {
    title: "Find legal references",
    description: "مراجع قانونية مصرية مرتبطة بموضوع (الإقامة، اللجوء، العمل، التعليم، تسجيل المواليد) مع المادة والمصدر. Egyptian legal references by topic, with article numbers and sources. Not legal advice.",
    inputSchema: { topic: z.string().min(2).max(200), limit: z.number().int().min(1).max(30).default(10), locale },
    annotations: readOnly,
  }, safely(async (input) => service.findLegalReferences(input)));

  server.registerTool("find_datasets", {
    title: "Find datasets and indicators",
    description: "مجموعات البيانات والمؤشرات المنشورة (القيمة والوحدة والفترة والمنهجية). Published datasets (with download links) and indicators (value, unit, period, methodology).",
    inputSchema: { query: z.string().min(2).max(200).optional(), includeIndicators: z.boolean().default(true), locale },
    annotations: readOnly,
  }, safely(async (input) => service.findDatasets(input)));

  server.registerTool("list_sources", {
    title: "List the sources behind Atlas",
    description: "قائمة المصادر والناشرين وعدد السجلات وآخر تاريخ تحقق لكل مصدر. Every source/publisher behind Atlas records, with record counts, types and latest verification.",
    inputSchema: { locale },
    annotations: readOnly,
  }, safely(async ({ locale: lang }) => service.listSources(lang as Locale | undefined)));

  // ── Places, people, taxonomy ───────────────────────────────────────────────
  server.registerTool("list_governorates", {
    title: "List Egyptian governorates",
    description: "محافظات مصر الـ27 بالعربية والإنجليزية ورموز ISO مع عدد الخدمات والجهات في كل محافظة. All 27 governorates (Arabic, English, ISO 3166-2) with Atlas service and organization counts.",
    inputSchema: { onlyCovered: z.boolean().default(false).describe("Only governorates with at least one record."), locale },
    annotations: readOnly,
  }, safely(async (input) => service.listGovernorates(input)));

  server.registerTool("resolve_place", {
    title: "Resolve a place name to a governorate",
    description: "فهم أسماء الأماكن بالعربي والإنجليزي: «6 أكتوبر»، «فيصل»، «الاسكندريه»، \"Alex\" ← المحافظة ورمزها. Resolves Arabic/English place, city and district names (with spelling variants) to the governorate.",
    inputSchema: { query: z.string().min(1).max(100), locale },
    annotations: readOnly,
  }, safely(({ query, locale: lang }) => service.resolvePlace(query, lang as Locale | undefined)));

  server.registerTool("resolve_nationality", {
    title: "Resolve a nationality or population group",
    description: "فهم الجنسيات والفئات بالعربي والإنجليزي: «سودانيين»، «السودان»، \"Syrian\"، «نساء»، «جميع الجنسيات» ← رمز ISO3 أو الفئة. Resolves nationalities (any Arabic gender/plural form) and eligibility groups.",
    inputSchema: { query: z.string().min(2).max(100), locale },
    annotations: readOnly,
  }, safely(({ query, locale: lang }) => service.resolveNationality(query, lang as Locale | undefined)));

  server.registerTool("list_service_types", {
    title: "List service types",
    description: "أنواع الخدمات في الدليل مع الكلمات الدالة عليها بالعربي والإنجليزي وعدد الخدمات. Service-type taxonomy with Arabic/English vocabulary and counts.",
    inputSchema: { locale },
    annotations: readOnly,
  }, safely(async ({ locale: lang }) => service.listServiceTypes(lang as Locale | undefined)));

  // ── Analysis & outputs ─────────────────────────────────────────────────────
  server.registerTool("compare_governorates", {
    title: "Compare service coverage across governorates",
    description: "مقارنة الخدمات المسجلة بين المحافظات حسب نوع الخدمة وإظهار الفجوات. Matrix of published services per governorate and service type, with gaps. Omit governorates for all covered ones.",
    inputSchema: { governorates: z.array(z.string().min(2)).max(27).optional(), need: z.string().min(2).max(200).optional(), locale },
    annotations: readOnly,
  }, safely(async (input) => service.compareGovernorates(input)));

  server.registerTool("build_referral_sheet", {
    title: "Build a referral sheet",
    description: "ورقة إحالة مرتبة للحاجة والمحافظة والجنسية: جهات، تواصل، متطلبات، مواعيد، تكلفة، مصدر وتاريخ تحقق. Ranked referral sheet (markdown) for a need + governorate + nationality, with contacts, requirements, sources and freshness. No personal data needed.",
    inputSchema: { need: z.string().min(2).max(300), governorate: governorate.optional(), nationality: nationality.optional(), groups: z.array(z.string()).max(10).optional(), limit: z.number().int().min(1).max(20).default(5), locale },
    annotations: readOnly,
  }, safely(async (input) => service.buildReferralSheet(input)));

  server.registerTool("check_freshness", {
    title: "Check record freshness",
    description: "فحص حداثة السجلات: ما الذي تجاوز عمر التحقق المسموح أو بلا تاريخ تحقق. Which records are stale or missing a verification date.",
    inputSchema: { maxAgeDays: z.number().int().min(1).max(3650).default(180), type: z.enum(recordTypes).optional(), locale },
    annotations: readOnly,
  }, safely(async (input) => service.checkFreshness(input)));

  server.registerTool("cite_record", {
    title: "Cite a record",
    description: "توليد استشهاد جاهز (APA وMarkdown وBibTeX) لسجل مع مصدره الأصلي. Ready-to-paste APA, Markdown and BibTeX citations for a record and its original source.",
    inputSchema: { id: recordId, locale },
    annotations: readOnly,
  }, safely(async (input) => service.citeRecord(input)));

  server.registerTool("export_records", {
    title: "Export records",
    description: "تصدير السجلات CSV أو JSON أو Markdown مع manifest قابل لإعادة الإنتاج. Export filtered records as CSV/JSON/Markdown with a reproducible extraction manifest.",
    inputSchema: { format: z.enum(["csv", "json", "markdown"]).default("csv"), type: z.enum(recordTypes).optional(), governorate: governorate.optional(), query: z.string().min(2).max(200).optional(), limit: z.number().int().min(1).max(500).default(100), locale },
    annotations: readOnly,
  }, safely(async (input) => service.exportRecords(input)));

  // ── Resources ─────────────────────────────────────────────────────────────
  server.registerResource("coverage", "marsa://coverage", { title: "Marsa Atlas Coverage", mimeType: "application/json" }, async (uri) => ({ contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(await service.coverage()) }] }));
  server.registerResource("governorates", "marsa://governorates", { title: "Egyptian governorates with Atlas coverage", mimeType: "application/json" }, async (uri) => ({ contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(await service.listGovernorates({ onlyCovered: false })) }] }));
  server.registerResource("record", new ResourceTemplate("marsa://records/{id}", { list: undefined }), { title: "Marsa Atlas Record", mimeType: "application/json" }, async (uri, { id }) => ({ contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(await service.getRecord(decodeURIComponent(String(id)))) }] }));

  // ── Prompts ───────────────────────────────────────────────────────────────
  server.registerPrompt("referral", { title: "Prepare a referral / تجهيز إحالة", description: "Find and rank services for a need in a governorate, then produce a referral sheet with sources.", argsSchema: { need: z.string(), governorate: z.string().optional(), nationality: z.string().optional() } }, ({ need, governorate: gov, nationality: nat }) => ({ messages: [{ role: "user", content: { type: "text", text: `استخدم build_referral_sheet للحاجة «${need}»${gov ? ` في «${gov}»` : ""}${nat ? ` لجنسية «${nat}»` : ""}. اعرض الخيارات مع المصدر وتاريخ التحقق لكل خيار، ونبّه إلى أن الأهلية النهائية تحددها الجهة. لا تطلب أي بيانات شخصية.` } }] }));
  server.registerPrompt("research_brief", { title: "Research brief / موجز بحثي", description: "A cited brief on a migration/asylum topic in Egypt.", argsSchema: { question: z.string() } }, ({ question }) => ({ messages: [{ role: "user", content: { type: "text", text: `اكتب موجزًا بحثيًا موثقًا عن: ${question}. ابدأ بـ build_research_brief ثم find_legal_references وfind_datasets عند الحاجة. استشهد بكل معلومة من sources، واذكر حدود التغطية وتواريخ التحقق.` } }] }));
  server.registerPrompt("coverage_gaps", { title: "Coverage gaps / فجوات التغطية", description: "Where are services missing or stale?", argsSchema: { need: z.string().optional() } }, ({ need }) => ({ messages: [{ role: "user", content: { type: "text", text: `حلّل فجوات التغطية${need ? ` لخدمات «${need}»` : ""}: استخدم compare_governorates وlist_governorates وcheck_freshness. اعرض جدولًا مختصرًا ثم أولويات التحديث، مع المصادر.` } }] }));

  return server;
}
