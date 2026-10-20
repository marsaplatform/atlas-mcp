import type { AtlasRepository } from "../domain/repository";
import type { AnyAtlasRecord, LegalRecord, RecordType, SearchInput, ServiceRecord, ServiceSearchInput } from "../domain/models";
import { t, type Locale } from "../i18n";
import { normalizeText, textIncludes, tokens } from "../shared/arabic";
import { canonicalGovernorate, governorates, resolvePlace, sameGovernorate } from "../shared/places";
import { classifyEligibility, populationGroups, resolveGroup, resolveNationality, type PopulationGroup } from "../shared/nationalities";
import { resolveNeed, serviceTypeOf, serviceTypes } from "../shared/needs";

export const ATLAS_VERSION = "0.2.0";

/** One citation per distinct source, carried by every tool result. */
export interface Citation {
  recordId: string;
  title: string;
  source: string;
  url: string;
  publisher: string;
  lastVerified: string;
  recordStatus: AnyAtlasRecord["recordStatus"];
  marsaUrl?: string;
}

export const citationOf = (record: AnyAtlasRecord): Citation => ({
  recordId: record.id,
  title: record.title,
  source: record.source.name,
  url: record.source.url,
  publisher: record.source.publisher,
  lastVerified: record.lastVerified,
  recordStatus: record.recordStatus,
  ...(record.url ? { marsaUrl: record.url } : {}),
});

export const sourcesOf = (records: AnyAtlasRecord[]): Citation[] => [...new Map(records.map((record) => [record.id, citationOf(record)])).values()];

const referenceSources = {
  iso3166: { recordId: "reference:iso-3166-2-eg", title: "ISO 3166-2:EG — Egypt governorate codes", source: "ISO 3166-2", url: "https://www.iso.org/obp/ui/#iso:code:3166:EG", publisher: "International Organization for Standardization", lastVerified: "2026-10-20", recordStatus: "source_backed" as const },
  iso3: { recordId: "reference:iso-3166-1", title: "ISO 3166-1 alpha-3 country codes", source: "ISO 3166-1", url: "https://www.iso.org/iso-3166-country-codes.html", publisher: "International Organization for Standardization", lastVerified: "2026-10-20", recordStatus: "source_backed" as const },
  atlas: { recordId: "reference:marsa-atlas", title: "Marsa Atlas", source: "Marsa Atlas", url: "https://atlas.marsaplatform.com", publisher: "Marsa Platform", lastVerified: "", recordStatus: "source_backed" as const },
};

const isService = (record: AnyAtlasRecord): record is ServiceRecord => record.type === "service";
const isLegal = (record: AnyAtlasRecord): record is LegalRecord => record.type === "legal";
const haystack = (record: AnyAtlasRecord): string => [record.title, record.summary, ...record.tags, ...(isService(record) ? [...record.serviceTypes, ...record.eligibility, record.organizationId] : []), ...(isLegal(record) ? record.legalTopics : [])].join(" ");
/** Services reference their provider by name (WordPress) or by id (fixtures). */
const providedBy = (service: ServiceRecord, org: AnyAtlasRecord): boolean => normalizeText(service.organizationId) === normalizeText(org.title) || service.organizationId === org.id;
const recordGovernorates = (record: AnyAtlasRecord): string[] => record.governorates ?? [];

export interface EligibilityProfile {
  nationality?: string | undefined;
  governorate?: string | undefined;
  groups?: string[] | undefined;
}

export class AtlasService {
  constructor(private readonly repository: AtlasRepository, private readonly now: () => Date = () => new Date()) {}

  private envelope(records: AnyAtlasRecord[], locale: Locale = "ar") {
    const sources = sourcesOf(records);
    return {
      sources,
      attribution: t("attribution", locale),
      ...(records.some((record) => record.recordStatus === "demo") ? { warnings: [t("demoWarning", locale)] } : {}),
    };
  }

  /** Local, Arabic-aware ranking over the full corpus — used as a fallback and by analytical tools. */
  private rank(records: AnyAtlasRecord[], query: string): AnyAtlasRecord[] {
    const q = normalizeText(query);
    const queryTokens = tokens(query).filter((token) => token.length >= 3);
    const needWords = resolveNeed(query).flatMap((type) => [type.ar, type.en]);
    const place = resolvePlace(query, 1)[0]?.governorate.ar;
    return records
      .map((record) => {
        const text = normalizeText(haystack(record));
        let score = 0;
        if (q && text.includes(q)) score += 5;
        score += queryTokens.filter((token) => text.includes(token)).length * 2;
        if (needWords.some((word) => text.includes(normalizeText(word)))) score += 3;
        if (place && recordGovernorates(record).some((label) => sameGovernorate(label, place))) score += 2;
        return { record, score };
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.record);
  }

  async search(input: SearchInput & { locale?: Locale | undefined }) {
    let items = await this.repository.search(input);
    let strategy: "upstream" | "local_fallback" = "upstream";
    if (items.length === 0) {
      items = this.rank(await this.repository.all(), input.query).filter((record) => input.types.length === 0 || input.types.includes(record.type)).slice(0, input.limit);
      strategy = "local_fallback";
    }
    return { query: input.query, count: items.length, items, strategy, ...this.envelope(items, input.locale) };
  }

  async findServices(input: ServiceSearchInput & { nationality?: string | undefined; locale?: Locale | undefined }) {
    const locale = input.locale ?? "ar";
    const governorate = canonicalGovernorate(input.governorate) ?? input.governorate;
    const types = resolveNeed(input.need);
    const nationality = input.nationality ? resolveNationality(input.nationality) : undefined;
    let items = await this.repository.findServices({ ...input, governorate });
    let strategy: "upstream" | "local_fallback" = "upstream";
    if (items.length === 0) {
      strategy = "local_fallback";
      const typeNames = types.map((type) => normalizeText(type.ar));
      items = (await this.repository.all())
        .filter(isService)
        .filter((record) => textIncludes(haystack(record), input.need, true) || record.serviceTypes.some((label) => typeNames.includes(normalizeText(label)) || (serviceTypeOf(label) && types.includes(serviceTypeOf(label)!))))
        .filter((record) => !governorate || record.governorates.some((label) => sameGovernorate(label, governorate)))
        .filter((record) => !input.eligibility || record.eligibility.some((label) => textIncludes(label, input.eligibility!)))
        .slice(0, input.limit);
    }
    if (nationality) items = items.filter((record) => record.eligibility.length === 0 || record.eligibility.some((label) => { const term = classifyEligibility(label); return term.kind === "unknown" || (term.kind === "group" && term.group !== "women" && term.group !== "children") || (term.kind === "nationality" && term.nationality.iso3 === nationality.iso3); }));
    return {
      query: input.need,
      resolved: { governorate: governorate ?? null, serviceTypes: types.map((type) => ({ key: type.key, ar: type.ar, en: type.en })), nationality: nationality ? { iso3: nationality.iso3, ar: nationality.ar, en: nationality.en } : null },
      count: items.length,
      items,
      strategy,
      disclaimer: t("servicesDisclaimer", locale),
      ...this.envelope(items, locale),
    };
  }

  async checkEligibility(input: { serviceId: string; profile: EligibilityProfile; locale?: Locale | undefined }) {
    const locale = input.locale ?? "ar";
    const record = await this.repository.getById(input.serviceId);
    if (!record || record.type !== "service") return { found: false, decision: "unknown" as const, reasons: [t("serviceMissing", locale)], disclaimer: t("eligibilityNotFound", locale), sources: [], attribution: t("attribution", locale) };
    const reasons: string[] = [t("generalTermsOnly", locale)];
    const matched: string[] = [];
    const unconfirmed: string[] = [];
    const terms = record.eligibility.map(classifyEligibility);
    const nationality = input.profile.nationality ? resolveNationality(input.profile.nationality) : undefined;
    const groups = new Set<PopulationGroup>((input.profile.groups ?? []).map(resolveGroup).filter((group): group is PopulationGroup => Boolean(group)));
    if (terms.some((term) => term.kind === "group" && term.group === "all")) { reasons.push(t("openToAll", locale)); matched.push(populationGroups.all[locale === "ar" ? "ar" : "en"]); }
    if (input.profile.nationality) {
      const listed = terms.some((term) => term.kind === "nationality" && nationality && term.nationality.iso3 === nationality.iso3) || record.eligibility.includes(input.profile.nationality);
      if (listed) { reasons.push(t("nationalityListed", locale)); matched.push(nationality ? nationality[locale] : input.profile.nationality); }
      else if (terms.some((term) => term.kind === "nationality")) { reasons.push(t("nationalityNotListed", locale)); unconfirmed.push(input.profile.nationality); }
    }
    for (const term of terms) if (term.kind === "group" && term.group !== "all" && groups.has(term.group)) { reasons.push(t("groupListed", locale) + term.label); matched.push(term.label); }
    for (const term of terms) if (term.kind === "group" && term.group !== "all" && !groups.has(term.group)) unconfirmed.push(term.label);
    let governorateStatus: "covered" | "not_listed" | "not_provided" = "not_provided";
    if (input.profile.governorate) {
      const wanted = canonicalGovernorate(input.profile.governorate) ?? input.profile.governorate;
      governorateStatus = record.governorates.some((label) => sameGovernorate(label, wanted)) ? "covered" : "not_listed";
      reasons.push(t(governorateStatus === "covered" ? "governorateCovered" : "governorateNotListed", locale));
    }
    return {
      found: true,
      decision: "needs_confirmation" as const,
      reasons,
      signals: { matched, unconfirmed, governorate: governorateStatus, requirements: record.requirements },
      service: record,
      disclaimer: t("eligibilityDisclaimer", locale),
      ...this.envelope([record], locale),
    };
  }

  async buildResearchBrief(input: { question: string; limit: number; locale?: Locale | undefined }) {
    const locale = input.locale ?? "ar";
    const result = await this.search({ query: input.question.replace(/[؟?]/g, ""), types: [], limit: input.limit, locale });
    const citations = result.items.map((item, index) => ({ index: index + 1, title: item.title, url: item.source.url, publisher: item.source.publisher, lastVerified: item.lastVerified }));
    const coverageNotes = [...new Set(result.items.flatMap((item) => item.coverageNotes))];
    const markdown = [`# ${input.question}`, "", ...result.items.map((item, index) => `## ${item.title}\n${item.summary}\n\n[${index + 1}] ${item.source.url}`), "", `## ${locale === "en" ? "Sources" : "المصادر"}`, ...citations.map((citation) => `${citation.index}. ${citation.title} — ${citation.url}`)].join("\n");
    return { question: input.question, records: result.items, citations, coverageNotes, markdown, ...this.envelope(result.items, locale) };
  }

  coverage() { return this.repository.coverage(); }

  async getRecord(id: string, locale: Locale = "ar") {
    const record = await this.repository.getById(id);
    if (!record) return { found: false as const, id, sources: [], attribution: t("attribution", locale) };
    const all = await this.repository.all();
    const related = isService(record)
      ? all.filter((other) => other.type === "organization" && providedBy(record, other))
      : record.type === "organization"
        ? all.filter(isService).filter((service) => providedBy(service, record))
        : [];
    return { found: true as const, record, related, ...this.envelope([record, ...related], locale) };
  }

  async listRecords(input: { type?: RecordType | undefined; governorate?: string | undefined; status?: AnyAtlasRecord["recordStatus"] | undefined; limit: number; offset: number; locale?: Locale | undefined }) {
    const governorate = canonicalGovernorate(input.governorate) ?? input.governorate;
    const filtered = (await this.repository.all())
      .filter((record) => !input.type || record.type === input.type)
      .filter((record) => !input.status || record.recordStatus === input.status)
      .filter((record) => !governorate || recordGovernorates(record).some((label) => sameGovernorate(label, governorate)));
    const items = filtered.slice(input.offset, input.offset + input.limit);
    return { total: filtered.length, offset: input.offset, count: items.length, items, ...this.envelope(items, input.locale) };
  }

  async findOrganizations(input: { query?: string | undefined; governorate?: string | undefined; serviceType?: string | undefined; limit: number; locale?: Locale | undefined }) {
    const all = await this.repository.all();
    const governorate = canonicalGovernorate(input.governorate) ?? input.governorate;
    const services = all.filter(isService);
    const wantedTypes = input.serviceType ? resolveNeed(input.serviceType) : [];
    const items = all
      .filter((record) => record.type === "organization")
      .map((org) => {
        const orgServices = services.filter((service) => providedBy(service, org));
        return { organization: org, serviceCount: orgServices.length, serviceTypes: [...new Set(orgServices.flatMap((service) => service.serviceTypes))], governorates: [...new Set([...recordGovernorates(org), ...orgServices.flatMap((service) => service.governorates)])] };
      })
      .filter((entry) => !input.query || textIncludes([haystack(entry.organization), ...entry.serviceTypes].join(" "), input.query, true))
      .filter((entry) => !governorate || entry.governorates.some((label) => sameGovernorate(label, governorate)))
      .filter((entry) => wantedTypes.length === 0 || entry.serviceTypes.some((label) => { const type = serviceTypeOf(label); return type ? wantedTypes.includes(type) : false; }))
      .slice(0, input.limit);
    return { count: items.length, items, ...this.envelope(items.map((entry) => entry.organization), input.locale) };
  }

  async getOrganization(input: { idOrName: string; locale?: Locale | undefined }) {
    const all = await this.repository.all();
    const q = normalizeText(input.idOrName);
    const org = all.find((record) => record.type === "organization" && record.id === input.idOrName)
      ?? all.filter((record) => record.type === "organization").find((record) => normalizeText(record.title) === q || normalizeText(record.title).split(" — ").some((part) => part.trim() === q))
      ?? all.filter((record) => record.type === "organization").find((record) => normalizeText(record.title).includes(q));
    if (!org) return { found: false as const, query: input.idOrName, sources: [], attribution: t("attribution", input.locale ?? "ar") };
    const services = all.filter(isService).filter((service) => providedBy(service, org));
    return { found: true as const, organization: org, services, ...this.envelope([org, ...services], input.locale) };
  }

  async findLegalReferences(input: { topic: string; limit: number; locale?: Locale | undefined }) {
    const legal = (await this.repository.all()).filter(isLegal);
    const ranked = this.rank(legal, input.topic) as LegalRecord[];
    const items = (ranked.length ? ranked : []).slice(0, input.limit);
    return { topic: input.topic, count: items.length, items, topics: [...new Set(legal.flatMap((record) => record.legalTopics))], disclaimer: t("legalDisclaimer", input.locale ?? "ar"), ...this.envelope(items, input.locale) };
  }

  async findDatasets(input: { query?: string | undefined; includeIndicators: boolean; locale?: Locale | undefined }) {
    const records = (await this.repository.all()).filter((record) => record.type === "dataset" || (input.includeIndicators && record.type === "indicator"));
    const items = input.query ? this.rank(records, input.query) : records;
    return {
      count: items.length,
      datasets: items.filter((record) => record.type === "dataset").map((record) => ({ ...record, downloadUrl: record.downloadUrl ?? null })),
      indicators: items.filter((record) => record.type === "indicator").map((record) => ({ id: record.id, title: record.title, value: record.indicator?.value ?? null, unit: record.indicator?.unit ?? null, period: record.indicator?.period ?? null, methodology: record.indicator?.methodology ?? null, lastVerified: record.lastVerified, recordStatus: record.recordStatus, source: record.source })),
      ...this.envelope(items, input.locale),
    };
  }

  async listServiceTypes(locale: Locale = "ar") {
    const services = (await this.repository.all()).filter(isService);
    const labels = new Map<string, number>();
    for (const service of services) for (const label of service.serviceTypes) labels.set(label, (labels.get(label) ?? 0) + 1);
    const items = serviceTypes.map((type) => {
      const matching = [...labels.entries()].filter(([label]) => serviceTypeOf(label)?.key === type.key);
      return { key: type.key, ar: type.ar, en: type.en, serviceCount: matching.reduce((sum, [, count]) => sum + count, 0), labels: matching.map(([label]) => label), exampleWords: type.words.slice(0, 6) };
    });
    return { items, unmappedLabels: [...labels.keys()].filter((label) => !serviceTypeOf(label)), ...this.envelope(services, locale) };
  }

  async listGovernorates(input: { onlyCovered: boolean; locale?: Locale | undefined }) {
    const all = await this.repository.all();
    const items = governorates.map((governorate) => {
      const services = all.filter(isService).filter((service) => service.governorates.some((label) => sameGovernorate(label, governorate.ar)));
      const organizations = all.filter((record) => record.type === "organization" && recordGovernorates(record).some((label) => sameGovernorate(label, governorate.ar)));
      return { code: governorate.code, ar: governorate.ar, en: governorate.en, region: governorate.region, serviceCount: services.length, organizationCount: organizations.length, serviceTypes: [...new Set(services.flatMap((service) => service.serviceTypes))] };
    }).filter((item) => !input.onlyCovered || item.serviceCount + item.organizationCount > 0);
    return { count: items.length, items, sources: [referenceSources.iso3166, ...sourcesOf(all.filter((record) => recordGovernorates(record).length > 0))], attribution: t("attribution", input.locale ?? "ar") };
  }

  resolvePlace(query: string, locale: Locale = "ar") {
    const matches = resolvePlace(query, 5).map((match) => ({ code: match.governorate.code, ar: match.governorate.ar, en: match.governorate.en, region: match.governorate.region, matchedName: match.matchedName, kind: match.kind, score: Number(match.score.toFixed(2)) }));
    return { query, found: matches.length > 0, best: matches[0] ?? null, matches, sources: [referenceSources.iso3166], attribution: t("attribution", locale) };
  }

  resolveNationality(query: string, locale: Locale = "ar") {
    const nationality = resolveNationality(query);
    const group = resolveGroup(query);
    return {
      query,
      kind: nationality ? "nationality" as const : group ? "population_group" as const : "unknown" as const,
      nationality: nationality ? { iso3: nationality.iso3, ar: nationality.ar, en: nationality.en, demonymAr: nationality.demonymAr, demonymEn: nationality.demonymEn } : null,
      group: group ? { key: group, ar: populationGroups[group].ar, en: populationGroups[group].en } : null,
      sources: [referenceSources.iso3],
      attribution: t("attribution", locale),
    };
  }

  async compareGovernorates(input: { governorates?: string[] | undefined; need?: string | undefined; locale?: Locale | undefined }) {
    const services = (await this.repository.all()).filter(isService);
    const wanted = (input.governorates?.length ? input.governorates.map((name) => canonicalGovernorate(name) ?? name) : [...new Set(services.flatMap((service) => service.governorates.map((label) => canonicalGovernorate(label) ?? label)))]);
    const needTypes = input.need ? resolveNeed(input.need).map((type) => type.key) : [];
    const relevant = services.filter((service) => needTypes.length === 0 || service.serviceTypes.some((label) => { const type = serviceTypeOf(label); return type ? needTypes.includes(type.key) : false; }));
    const typeLabels = [...new Set(relevant.flatMap((service) => service.serviceTypes))];
    const rows = wanted.map((governorate) => {
      const here = relevant.filter((service) => service.governorates.some((label) => sameGovernorate(label, governorate)));
      return { governorate, code: governorates.find((g) => g.ar === governorate)?.code ?? null, total: here.length, byServiceType: Object.fromEntries(typeLabels.map((label) => [label, here.filter((service) => service.serviceTypes.includes(label)).length])), gaps: typeLabels.filter((label) => !here.some((service) => service.serviceTypes.includes(label))) };
    });
    const table = [`| ${input.locale === "en" ? "Governorate" : "المحافظة"} | ${typeLabels.join(" | ")} | ${input.locale === "en" ? "Total" : "المجموع"} |`, `|---|${typeLabels.map(() => "---|").join("")}---|`, ...rows.map((row) => `| ${row.governorate} | ${typeLabels.map((label) => row.byServiceType[label]).join(" | ")} | ${row.total} |`)].join("\n");
    return { serviceTypes: typeLabels, rows, markdown: table, note: input.locale === "en" ? "Counts reflect records published in Atlas, not total availability on the ground." : "الأعداد تعكس السجلات المنشورة في الأطلس وليس كل ما هو متاح على أرض الواقع.", ...this.envelope(relevant, input.locale) };
  }

  async buildReferralSheet(input: { need: string; governorate?: string | undefined; nationality?: string | undefined; groups?: string[] | undefined; limit: number; locale?: Locale | undefined }) {
    const locale = input.locale ?? "ar";
    const governorate = canonicalGovernorate(input.governorate) ?? input.governorate;
    const nationality = input.nationality ? resolveNationality(input.nationality) : undefined;
    const groups = new Set((input.groups ?? []).map(resolveGroup).filter(Boolean));
    const types = resolveNeed(input.need);
    const today = this.now().getTime();
    const candidates = (await this.repository.all()).filter(isService).filter((service) => textIncludes(haystack(service), input.need, true) || service.serviceTypes.some((label) => { const type = serviceTypeOf(label); return type ? types.includes(type) : false; }));
    const scored = candidates.map((service) => {
      let score = 0;
      const why: string[] = [];
      if (governorate && service.governorates.some((label) => sameGovernorate(label, governorate))) { score += 3; why.push(locale === "en" ? "in requested governorate" : "في المحافظة المطلوبة"); }
      const terms = service.eligibility.map(classifyEligibility);
      if (terms.some((term) => term.kind === "group" && term.group === "all")) { score += 1; why.push(locale === "en" ? "open to all nationalities" : "متاحة لجميع الجنسيات"); }
      if (nationality && terms.some((term) => term.kind === "nationality" && term.nationality.iso3 === nationality.iso3)) { score += 2; why.push(locale === "en" ? "nationality listed" : "الجنسية مذكورة"); }
      if (terms.some((term) => term.kind === "group" && groups.has(term.group))) { score += 2; why.push(locale === "en" ? "group listed" : "الفئة مذكورة"); }
      if (nationality && terms.some((term) => term.kind === "nationality") && !terms.some((term) => term.kind === "nationality" && term.nationality.iso3 === nationality.iso3)) score -= 3;
      if (service.recordStatus === "source_backed") score += 1;
      const ageDays = service.lastVerified ? Math.floor((today - Date.parse(service.lastVerified)) / 86_400_000) : null;
      if (ageDays !== null && ageDays <= 120) score += 0.5;
      return { service, score, why, ageDays };
    }).filter((entry) => entry.score > -1).sort((a, b) => b.score - a.score).slice(0, input.limit);
    const lines = [`# ${t("referralTitle", locale)}: ${input.need}${governorate ? ` — ${governorate}` : ""}`, "", `> ${t("confirmBeforeReferral", locale)}`, ""];
    scored.forEach(({ service, why, ageDays }, index) => {
      const c = service.contact ?? {};
      lines.push(`## ${index + 1}. ${service.title}`, service.summary, "",
        `- ${locale === "en" ? "Provider" : "الجهة"}: ${service.organizationId}`,
        `- ${locale === "en" ? "Governorates" : "المحافظات"}: ${service.governorates.join("، ") || "—"}`,
        `- ${locale === "en" ? "Eligibility" : "الفئات"}: ${service.eligibility.join("، ") || "—"}`,
        ...(service.requirements.length ? [`- ${locale === "en" ? "Requirements" : "المتطلبات"}: ${service.requirements.join("؛ ")}`] : []),
        ...(c.phone ? [`- ${locale === "en" ? "Phone" : "الهاتف"}: ${c.phone}`] : []),
        ...(c.hours ? [`- ${locale === "en" ? "Hours" : "المواعيد"}: ${c.hours}`] : []),
        ...(service.cost ? [`- ${locale === "en" ? "Cost" : "التكلفة"}: ${service.cost}`] : []),
        ...(c.website ? [`- ${locale === "en" ? "Website" : "الموقع"}: ${c.website}`] : []),
        `- ${locale === "en" ? "Why listed" : "سبب الترشيح"}: ${why.join("، ") || "—"}`,
        `- ${locale === "en" ? "Source" : "المصدر"}: [${service.source.name}](${service.source.url}) — ${locale === "en" ? "last verified" : "آخر تحقق"} ${service.lastVerified || "—"}${ageDays !== null ? ` (${ageDays} ${locale === "en" ? "days" : "يومًا"})` : ""}${service.recordStatus === "demo" ? (locale === "en" ? " — illustrative record" : " — سجل توضيحي") : ""}`, "");
    });
    if (scored.length === 0) lines.push(t("noResults", locale));
    lines.push("", `_${t("servicesDisclaimer", locale)}_`, `_${t("privacy", locale)}_`);
    return { need: input.need, resolved: { governorate: governorate ?? null, nationality: nationality ? nationality.iso3 : null, serviceTypes: types.map((type) => type.key) }, count: scored.length, items: scored.map(({ service, score, why, ageDays }) => ({ service, score, why, ageDays })), markdown: lines.join("\n"), disclaimer: t("servicesDisclaimer", locale), ...this.envelope(scored.map((entry) => entry.service), locale) };
  }

  async checkFreshness(input: { maxAgeDays: number; type?: RecordType | undefined; locale?: Locale | undefined }) {
    const today = this.now().getTime();
    const records = (await this.repository.all()).filter((record) => !input.type || record.type === input.type);
    const rows = records.map((record) => {
      const ageDays = record.lastVerified ? Math.floor((today - Date.parse(record.lastVerified)) / 86_400_000) : null;
      return { id: record.id, type: record.type, title: record.title, lastVerified: record.lastVerified || null, ageDays, status: ageDays === null || Number.isNaN(ageDays) ? "missing_date" as const : ageDays > input.maxAgeDays ? "stale" as const : "fresh" as const, recordStatus: record.recordStatus };
    });
    const count = (status: string) => rows.filter((row) => row.status === status).length;
    return { maxAgeDays: input.maxAgeDays, asOf: this.now().toISOString().slice(0, 10), summary: { total: rows.length, fresh: count("fresh"), stale: count("stale"), missingDate: count("missing_date"), demo: rows.filter((row) => row.recordStatus === "demo").length }, stale: rows.filter((row) => row.status !== "fresh"), rows, ...this.envelope(records, input.locale) };
  }

  async citeRecord(input: { id: string; locale?: Locale | undefined }) {
    const record = await this.repository.getById(input.id);
    if (!record) return { found: false as const, id: input.id, sources: [], attribution: t("attribution", input.locale ?? "ar") };
    const accessed = this.now().toISOString().slice(0, 10);
    const year = (record.source.publishedAt ?? record.lastVerified ?? "").slice(0, 4) || "n.d.";
    const atlasUrl = record.url ?? "https://atlas.marsaplatform.com";
    const key = `marsa_atlas_${record.id.replace(/[^A-Za-z0-9]+/g, "_")}`;
    return {
      found: true as const,
      record: { id: record.id, title: record.title, type: record.type },
      citations: {
        apa: `${record.source.publisher}. (${year}). ${record.title}. ${record.source.name}. ${record.source.url} (via Marsa Atlas, ${atlasUrl}; last verified ${record.lastVerified || "n.d."}; accessed ${accessed})`,
        markdown: `[${record.title}](${record.source.url}) — ${record.source.publisher}, ${record.source.name}. ${input.locale === "en" ? "Last verified" : "آخر تحقق"}: ${record.lastVerified || "—"}. ${input.locale === "en" ? "Via" : "عبر"} [Marsa Atlas](${atlasUrl}).`,
        bibtex: `@misc{${key},\n  title = {${record.title}},\n  author = {{${record.source.publisher}}},\n  year = {${year}},\n  howpublished = {\\url{${record.source.url}}},\n  note = {${record.source.name}. Via Marsa Atlas (${atlasUrl}). Last verified ${record.lastVerified || "n.d."}; accessed ${accessed}.}\n}`,
      },
      ...this.envelope([record], input.locale),
    };
  }

  async exportRecords(input: { format: "csv" | "json" | "markdown"; type?: RecordType | undefined; governorate?: string | undefined; query?: string | undefined; limit: number; locale?: Locale | undefined }) {
    let records = await this.repository.all();
    if (input.type) records = records.filter((record) => record.type === input.type);
    const governorate = canonicalGovernorate(input.governorate) ?? input.governorate;
    if (governorate) records = records.filter((record) => recordGovernorates(record).some((label) => sameGovernorate(label, governorate)));
    if (input.query) records = this.rank(records, input.query);
    records = records.slice(0, input.limit);
    const manifest = { tool: "export_records", arguments: { format: input.format, type: input.type ?? null, governorate: governorate ?? null, query: input.query ?? null, limit: input.limit }, generatedAt: this.now().toISOString(), server: `marsa-atlas ${ATLAS_VERSION}`, records: records.length, attribution: t("attribution", "en"), license: "Record text: see each source. Code: MIT." };
    const columns = ["id", "type", "title", "summary", "governorates", "service_types", "eligibility", "source_name", "source_url", "publisher", "last_verified", "record_status", "marsa_url"] as const;
    const row = (record: AnyAtlasRecord): string[] => [record.id, record.type, record.title, record.summary, recordGovernorates(record).join("; "), isService(record) ? record.serviceTypes.join("; ") : "", isService(record) ? record.eligibility.join("; ") : "", record.source.name, record.source.url, record.source.publisher, record.lastVerified, record.recordStatus, record.url ?? ""];
    const csvCell = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
    let content: string;
    if (input.format === "csv") content = [...Object.entries(manifest).map(([key, value]) => `# ${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`), columns.join(","), ...records.map((record) => row(record).map(csvCell).join(","))].join("\n");
    else if (input.format === "markdown") content = [`| ${columns.slice(0, 4).join(" | ")} | source | last_verified |`, "|---|---|---|---|---|---|", ...records.map((record) => `| ${record.id} | ${record.type} | ${record.title} | ${record.summary.replace(/\|/g, "/").slice(0, 120)} | [${record.source.name}](${record.source.url}) | ${record.lastVerified} |`), "", `<!-- manifest: ${JSON.stringify(manifest)} -->`].join("\n");
    else content = JSON.stringify({ manifest, records }, null, 2);
    return { format: input.format, count: records.length, manifest, content, ...this.envelope(records, input.locale) };
  }

  async listSources(locale: Locale = "ar") {
    const records = await this.repository.all();
    const bySource = new Map<string, { name: string; url: string; publisher: string; records: number; types: Set<string>; latestVerified: string; statuses: Set<string> }>();
    for (const record of records) {
      const key = record.source.url;
      const entry = bySource.get(key) ?? { name: record.source.name, url: record.source.url, publisher: record.source.publisher, records: 0, types: new Set(), latestVerified: "", statuses: new Set() };
      entry.records += 1; entry.types.add(record.type); entry.statuses.add(record.recordStatus);
      if (record.lastVerified > entry.latestVerified) entry.latestVerified = record.lastVerified;
      bySource.set(key, entry);
    }
    const items = [...bySource.values()].map((entry) => ({ ...entry, types: [...entry.types], statuses: [...entry.statuses] })).sort((a, b) => b.records - a.records);
    return { count: items.length, items, ...this.envelope(records, locale), sources: [referenceSources.atlas, ...sourcesOf(records)] };
  }
}
