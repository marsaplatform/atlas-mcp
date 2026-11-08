import { z } from "zod";
import type { AnyAtlasRecord, RecordType } from "../domain/models";
import { InMemoryRepository } from "./in-memory-repository";

type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

/**
 * Reads Atlas records that editors manage in the gorun CMS behind marsaplatform.com
 * (`/api/v1`, read-only key with the `content.view` scope). The corpus is small, so
 * every published record is loaded, cached briefly and searched in memory. When gorun
 * is unreachable the last good copy keeps serving.
 */
const itemSchema = z.looseObject({
  id: z.string(),
  type: z.string(),
  title: z.string(),
  excerpt: z.string().default(""),
  fields: z.record(z.string(), z.unknown()).default({}),
  terms: z.record(z.string(), z.array(z.string())).default({}),
});
const termSchema = z.looseObject({ slug: z.string(), name: z.string() });
const pageSchema = <T extends z.ZodType>(item: T) => z.looseObject({ ok: z.literal(true), data: z.array(item) });
type GorunItem = z.infer<typeof itemSchema>;

/** gorun content type → Atlas record type, and the legacy WordPress type kept in record IDs. */
export const gorunTypes: Record<string, { type: RecordType; legacy: string }> = {
  atlas_service: { type: "service", legacy: "marsa_service" },
  atlas_org: { type: "organization", legacy: "marsa_org" },
  atlas_legal: { type: "legal", legacy: "marsa_legal" },
  atlas_dataset: { type: "dataset", legacy: "marsa_dataset" },
  atlas_indicator: { type: "indicator", legacy: "marsa_indicator" },
};
const taxonomies = ["atlas_organization", "atlas_service_type", "atlas_governorate", "atlas_eligibility", "atlas_legal_topic", "atlas_data_topic"];
const PER_PAGE = 100;

const text = (item: GorunItem, key: string): string => {
  const value = item.fields[key];
  return typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : "";
};

export class GorunRepository extends InMemoryRepository {
  private readonly base: string;
  private cache: { at: number; records: AnyAtlasRecord[] } | undefined;

  constructor(baseUrl: string, private readonly token: string, private readonly fetcher: Fetcher = (input, init) => fetch(input, init), private readonly ttlMs = 60_000) {
    super();
    this.base = `${baseUrl.replace(/\/$/, "")}/api/v1`;
  }

  private async list<T extends z.ZodType>(path: string, params: Record<string, string>, item: T): Promise<z.infer<T>[]> {
    const out: z.infer<T>[] = [];
    for (let page = 1; ; page++) {
      const url = new URL(`${this.base}/${path}`);
      Object.entries({ ...params, page: String(page), per_page: String(PER_PAGE) }).forEach(([key, value]) => url.searchParams.set(key, value));
      const response = await this.fetcher(url, { headers: { accept: "application/json", authorization: `Bearer ${this.token}` }, signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error(`gorun request failed: ${response.status} ${url.pathname}`);
      const data = pageSchema(item).parse(await response.json()).data;
      out.push(...data);
      if (data.length < PER_PAGE) return out;
    }
  }

  protected async load(): Promise<AnyAtlasRecord[]> {
    if (this.cache && Date.now() - this.cache.at < this.ttlMs) return this.cache.records;
    try {
      const [items, termLists] = await Promise.all([
        Promise.all(Object.keys(gorunTypes).map((type) => this.list("content", { type, status: "published" }, itemSchema))).then((lists) => lists.flat()),
        Promise.all(taxonomies.map((tax) => this.list(`taxonomies/${tax}/terms`, {}, termSchema))),
      ]);
      const names = new Map(taxonomies.map((tax, index) => [tax, new Map((termLists[index] ?? []).map((term) => [term.slug, term.name]))]));
      const records = items.filter((item) => gorunTypes[item.type]).map((item) => this.mapItem(item, names, items));
      this.cache = { at: Date.now(), records };
      return records;
    } catch (error) {
      if (this.cache) {
        console.error(JSON.stringify({ level: "warn", event: "gorun_stale_cache", error: String(error) }));
        return this.cache.records;
      }
      throw error;
    }
  }

  /** Indicators can count live: `live_source` is a gorun type (records) or `tax:<taxonomy>` (terms in use). */
  private liveValue(source: string, names: Map<string, Map<string, string>>, items: GorunItem[]): string | undefined {
    if (source.startsWith("tax:")) {
      const tax = source.slice(4);
      return names.has(tax) ? String(new Set(items.flatMap((item) => item.terms[tax] ?? [])).size) : undefined;
    }
    return gorunTypes[source] ? String(items.filter((item) => item.type === source).length) : undefined;
  }

  private mapItem(item: GorunItem, names: Map<string, Map<string, string>>, items: GorunItem[]): AnyAtlasRecord {
    const kind = gorunTypes[item.type]!;
    const termNames = (tax: string): string[] => (item.terms[tax] ?? []).map((slug) => names.get(tax)?.get(slug) ?? slug);
    const legacyId = text(item, "legacy_id");
    const lastVerified = text(item, "last_verified");
    const status = text(item, "record_status");
    const contact = (): Record<string, string> => Object.fromEntries(
      (["phone", "email", "website", "whatsapp", "address", "hours"] as const).map((key) => [key, text(item, key)]).filter(([, value]) => value),
    );
    const base = {
      id: legacyId ? `wp:${kind.legacy}:${legacyId}` : `gorun:${item.id}`,
      title: item.title,
      summary: item.excerpt,
      countryCode: "EG" as const,
      language: "ar" as const,
      source: {
        name: text(item, "source_name") || item.title,
        url: text(item, "source_url"),
        publisher: termNames("atlas_organization")[0] ?? "Marsa Platform",
        retrievedAt: new Date().toISOString().slice(0, 10),
      },
      lastVerified,
      recordStatus: status === "demo" ? "demo" as const : status === "source_backed" ? "source_backed" as const : "community_submitted" as const,
      coverageNotes: lastVerified ? [] : ["لا يتوفر تاريخ تحقق لهذا السجل."],
      tags: taxonomies.flatMap(termNames),
    };
    if (kind.type === "service") {
      return {
        ...base,
        type: "service",
        organizationId: termNames("atlas_organization")[0] ?? "unknown",
        serviceTypes: termNames("atlas_service_type"),
        governorates: termNames("atlas_governorate"),
        eligibility: termNames("atlas_eligibility"),
        requirements: text(item, "documents") ? [text(item, "documents")] : [],
        contact: contact(),
        ...(text(item, "cost") ? { cost: text(item, "cost") } : {}),
      };
    }
    if (kind.type === "legal") {
      return {
        ...base,
        type: "legal",
        legalTopics: termNames("atlas_legal_topic"),
        instrument: text(item, "source_name") || item.title,
        ...(text(item, "article_number") ? { articleNumber: text(item, "article_number") } : {}),
        ...(text(item, "issued_date") ? { effectiveDate: text(item, "issued_date") } : {}),
      };
    }
    const governorates = termNames("atlas_governorate");
    const value = (text(item, "live_source") && this.liveValue(text(item, "live_source"), names, items)) || text(item, "indicator_value");
    return {
      ...base,
      type: kind.type as Exclude<RecordType, "service" | "legal">,
      ...(governorates.length ? { governorates } : {}),
      ...(kind.type === "organization" ? { contact: contact() } : {}),
      ...(value
        ? { indicator: { value, ...(text(item, "indicator_unit") ? { unit: text(item, "indicator_unit") } : {}), ...(text(item, "indicator_period") ? { period: text(item, "indicator_period") } : {}), ...(text(item, "methodology") ? { methodology: text(item, "methodology") } : {}) } }
        : {}),
      ...(text(item, "download_url") ? { downloadUrl: text(item, "download_url") } : {}),
    };
  }
}
