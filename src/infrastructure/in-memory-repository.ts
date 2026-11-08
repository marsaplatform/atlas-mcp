import type { AtlasRepository } from "../domain/repository";
import type { AnyAtlasRecord, Coverage, SearchInput, ServiceRecord, ServiceSearchInput } from "../domain/models";

const normalized = (value: string): string => value.normalize("NFKC").toLocaleLowerCase("ar").replace(/[ًٌٍَُِّْـ]/g, "").trim();

/** Searches a small, fully loaded corpus in memory. Subclasses only decide where the records come from. */
export abstract class InMemoryRepository implements AtlasRepository {
  protected abstract load(): Promise<AnyAtlasRecord[]>;

  async search(input: SearchInput): Promise<AnyAtlasRecord[]> {
    const query = normalized(input.query);
    const tokens = query.split(/\s+/).filter((token) => token.length >= 3);
    return (await this.load())
      .filter((record) => input.types.length === 0 || input.types.includes(record.type))
      .filter((record) => {
        const haystack = normalized([record.title, record.summary, ...record.tags].join(" "));
        return haystack.includes(query) || tokens.some((token) => haystack.includes(token));
      })
      .slice(0, input.limit);
  }

  async findServices(input: ServiceSearchInput): Promise<ServiceRecord[]> {
    const need = normalized(input.need);
    return (await this.load())
      .filter((record): record is ServiceRecord => record.type === "service")
      .filter((record) => normalized([record.title, record.summary, ...record.serviceTypes, ...record.tags].join(" ")).includes(need))
      .filter((record) => !input.governorate || record.governorates.map(normalized).includes(normalized(input.governorate)))
      .filter((record) => !input.eligibility || record.eligibility.map(normalized).includes(normalized(input.eligibility)))
      .slice(0, input.limit);
  }

  async all(): Promise<AnyAtlasRecord[]> {
    return this.load();
  }

  async getById(id: string): Promise<AnyAtlasRecord | undefined> {
    return (await this.load()).find((record) => record.id === id);
  }

  async coverage(): Promise<Coverage> {
    const records = await this.load();
    return {
      records: records.length,
      byType: Object.fromEntries(records.map((record) => record.type).map((type) => [type, records.filter((record) => record.type === type).length])),
      lastUpdated: records.map((record) => record.lastVerified).filter(Boolean).sort().at(-1) ?? "",
    };
  }
}
