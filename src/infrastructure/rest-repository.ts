import { z } from "zod";
import type { AnyAtlasRecord, Coverage, SearchInput, ServiceRecord, ServiceSearchInput } from "../domain/models";
import type { AtlasRepository } from "../domain/repository";

type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

/**
 * Reads the public Atlas REST API (`/api/v1`). This is what the Cloudflare
 * Worker uses: the editorial WordPress stays private, and the Atlas web
 * service on the origin remains the single read path to it.
 *
 * Records are validated loosely (shape of the envelope + required core fields)
 * so the Worker keeps working when the origin adds optional fields.
 */
const recordSchema = z.looseObject({
  id: z.string(),
  type: z.string(),
  title: z.string(),
  summary: z.string(),
  source: z.looseObject({ name: z.string(), url: z.string(), publisher: z.string(), retrievedAt: z.string() }),
  lastVerified: z.string(),
});
const listSchema = z.looseObject({ items: z.array(recordSchema) });
const coverageSchema = z.object({ records: z.number(), byType: z.record(z.string(), z.number()), lastUpdated: z.string() });

export class RestApiRepository implements AtlasRepository {
  private readonly base: string;
  private cache: { at: number; records: AnyAtlasRecord[] } | undefined;

  constructor(baseUrl: string, private readonly fetcher: Fetcher = (input, init) => fetch(input, init), private readonly ttlMs = 5 * 60_000) {
    this.base = `${baseUrl.replace(/\/$/, "")}/api/v1`;
  }

  private async get(path: string, params: Record<string, string | number | undefined> = {}): Promise<unknown> {
    const url = new URL(`${this.base}/${path}`);
    Object.entries(params).forEach(([key, value]) => value !== undefined && value !== "" && url.searchParams.set(key, String(value)));
    const response = await this.fetcher(url, { headers: { accept: "application/json", "user-agent": "marsa-atlas-mcp (+https://github.com/marsaplatform/atlas-mcp)" }, signal: AbortSignal.timeout(8000) });
    if (response.status === 404 && path.startsWith("records/")) return undefined;
    if (!response.ok) throw new Error(`Atlas API request failed: ${response.status} ${url.pathname}`);
    return response.json();
  }

  async all(): Promise<AnyAtlasRecord[]> {
    if (this.cache && Date.now() - this.cache.at < this.ttlMs) return this.cache.records;
    const data = listSchema.parse(await this.get("records", { limit: 500 }));
    const records = data.items as unknown as AnyAtlasRecord[];
    this.cache = { at: Date.now(), records };
    return records;
  }

  async search(input: SearchInput): Promise<AnyAtlasRecord[]> {
    const data = listSchema.parse(await this.get("search", { q: input.query, limit: 50 }));
    return (data.items as unknown as AnyAtlasRecord[]).filter((item) => input.types.length === 0 || input.types.includes(item.type)).slice(0, input.limit);
  }

  async findServices(input: ServiceSearchInput): Promise<ServiceRecord[]> {
    const data = listSchema.parse(await this.get("services", { need: input.need, governorate: input.governorate, eligibility: input.eligibility }));
    return (data.items as unknown as AnyAtlasRecord[]).filter((item): item is ServiceRecord => item.type === "service").slice(0, input.limit);
  }

  async getById(id: string): Promise<AnyAtlasRecord | undefined> {
    const cached = this.cache?.records.find((record) => record.id === id);
    if (cached) return cached;
    const data = await this.get(`records/${encodeURIComponent(id)}`);
    if (data === undefined) return undefined;
    return recordSchema.parse(data) as unknown as AnyAtlasRecord;
  }

  async coverage(): Promise<Coverage> {
    return coverageSchema.parse(await this.get("coverage"));
  }
}
