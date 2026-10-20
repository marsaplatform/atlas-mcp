import { z } from "zod";
import type { AnyAtlasRecord, RecordType, ServiceRecord } from "../domain/models";
import type { AtlasRepository } from "../domain/repository";

const termSchema = z.object({ name: z.string(), slug: z.string() });
const itemSchema = z.object({
  id: z.number(),
  type: z.string(),
  title: z.string(),
  excerpt: z.string().default(""),
  url: z.string().url(),
  source_url: z.string().default(""),
  last_verified: z.string().default(""),
  meta: z.record(z.string(), z.string()).default({}),
  terms: z.record(z.string(), z.array(termSchema)).default({}),
});
const collectionSchema = z.object({ items: z.array(itemSchema), total: z.number(), pages: z.number() });
type WordPressItem = z.infer<typeof itemSchema>;
type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

const typeMap: Record<string, RecordType> = {
  marsa_service: "service",
  marsa_org: "organization",
  marsa_legal: "legal",
  marsa_dataset: "dataset",
  marsa_indicator: "indicator",
};

const termNames = (item: WordPressItem, taxonomy: string): string[] =>
  (item.terms[taxonomy] ?? []).map((term) => term.name);

const source = (item: WordPressItem) => ({
  name: item.meta.source_name || item.title,
  url: item.source_url || item.url,
  publisher: termNames(item, "marsa_organization")[0] ?? "Marsa Platform",
  retrievedAt: new Date().toISOString().slice(0, 10),
});

const baseRecord = (item: WordPressItem) => ({
  id: `wp:${item.type}:${item.id}`,
  type: typeMap[item.type] ?? "source" as RecordType,
  title: item.title,
  summary: item.excerpt,
  countryCode: "EG" as const,
  language: "ar" as const,
  source: source(item),
  lastVerified: item.last_verified,
  recordStatus: item.meta.record_status === "demo" ? "demo" as const : item.meta.record_status === "source_backed" ? "source_backed" as const : "community_submitted" as const,
  coverageNotes: item.last_verified ? [] : ["لا يتوفر تاريخ تحقق لهذا السجل."],
  tags: Object.values(item.terms).flat().map((term) => term.name),
});

const mapItem = (item: WordPressItem): AnyAtlasRecord => {
  const base = baseRecord(item);
  if (base.type === "service") {
    return {
      ...base,
      type: "service",
      organizationId: termNames(item, "marsa_organization")[0] ?? "unknown",
      serviceTypes: termNames(item, "marsa_service_type"),
      governorates: termNames(item, "marsa_governorate"),
      eligibility: termNames(item, "marsa_eligibility"),
      requirements: item.meta.documents ? [item.meta.documents] : [],
      contact: { ...(item.meta.phone ? { phone: item.meta.phone } : {}), url: item.url },
    };
  }
  if (base.type === "legal") {
    return {
      ...base,
      type: "legal",
      legalTopics: termNames(item, "marsa_legal_topic"),
      instrument: item.meta.source_name || item.title,
      ...(item.meta.article_number ? { articleNumber: item.meta.article_number } : {}),
      ...(item.meta.issued_date ? { effectiveDate: item.meta.issued_date } : {}),
    };
  }
  return { ...base, type: base.type as Exclude<RecordType, "service" | "legal"> };
};

export class WordPressRepository implements AtlasRepository {
  private readonly endpoint: string;

  constructor(baseUrl: string, private readonly fetcher: Fetcher = fetch) {
    this.endpoint = `${baseUrl.replace(/\/$/, "")}/wp-json/marsa/v1`;
  }

  private async request(path: string, params: Record<string, string | number | undefined>) {
    const url = new URL(`${this.endpoint}/${path}`);
    Object.entries(params).forEach(([key, value]) => value !== undefined && url.searchParams.set(key, String(value)));
    const response = await this.fetcher(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`WordPress request failed: ${response.status} ${url.pathname}`);
    return collectionSchema.parse(await response.json());
  }

  async search(input: Parameters<AtlasRepository["search"]>[0]): Promise<AnyAtlasRecord[]> {
    const perPage = Math.min(input.limit * 3, 100);
    const data = await this.request("search", { q: input.query, per_page: perPage });
    let items = data.items;
    if (items.length === 0) {
      const tokens = [...new Set(input.query.normalize("NFKC").split(/\s+/).map((token) => token.replace(/[؟?،,.]/g, "").trim()).filter((token) => token.length >= 3))].slice(0, 4);
      const responses = await Promise.all(tokens.map((token) => this.request("search", { q: token, per_page: perPage })));
      items = [...new Map(responses.flatMap((response) => response.items).map((item) => [`${item.type}:${item.id}`, item])).values()];
    }
    return items.map(mapItem).filter((item) => input.types.length === 0 || input.types.includes(item.type)).slice(0, input.limit);
  }

  async findServices(input: Parameters<AtlasRepository["findServices"]>[0]): Promise<ServiceRecord[]> {
    const data = await this.request("services", {
      q: input.need,
      governorate: input.governorate,
      eligibility: input.eligibility,
      per_page: input.limit,
    });
    return data.items.map(mapItem).filter((item): item is ServiceRecord => item.type === "service");
  }

  async getById(id: string): Promise<AnyAtlasRecord | undefined> {
    const [, type, numericId] = id.split(":");
    if (!type || !numericId) return undefined;
    const data = await this.request("search", { per_page: 100 });
    return data.items.find((item) => item.type === type && String(item.id) === numericId)
      ? mapItem(data.items.find((item) => item.type === type && String(item.id) === numericId)!)
      : undefined;
  }

  async coverage(): Promise<{ records: number; byType: Record<string, number>; lastUpdated: string }> {
    const data = await this.request("search", { per_page: 100 });
    const records = data.items.map(mapItem);
    return {
      records: data.total,
      byType: Object.fromEntries([...new Set(records.map((record) => record.type))].map((type) => [type, records.filter((record) => record.type === type).length])),
      lastUpdated: records.map((record) => record.lastVerified).filter(Boolean).sort().at(-1) ?? "",
    };
  }
}
