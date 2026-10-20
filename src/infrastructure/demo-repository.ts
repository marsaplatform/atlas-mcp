import records from "../../data/demo.json";
import type { AtlasRepository } from "../domain/repository";
import type { AnyAtlasRecord, SearchInput, ServiceRecord, ServiceSearchInput } from "../domain/models";

const normalized = (value: string): string => value.normalize("NFKC").toLocaleLowerCase("ar").replace(/[ًٌٍَُِّْـ]/g, "").trim();
const allRecords = records as AnyAtlasRecord[];

export class DemoRepository implements AtlasRepository {
  async search(input: SearchInput): Promise<AnyAtlasRecord[]> {
    const query = normalized(input.query);
    const tokens = query.split(/\s+/).filter((token) => token.length >= 3);
    return allRecords
      .filter((record) => input.types.length === 0 || input.types.includes(record.type))
      .filter((record) => {
        const haystack = normalized([record.title, record.summary, ...record.tags].join(" "));
        return haystack.includes(query) || tokens.some((token) => haystack.includes(token));
      })
      .slice(0, input.limit);
  }

  async findServices(input: ServiceSearchInput): Promise<ServiceRecord[]> {
    const need = normalized(input.need);
    return allRecords
      .filter((record): record is ServiceRecord => record.type === "service")
      .filter((record) => normalized([record.title, record.summary, ...record.serviceTypes, ...record.tags].join(" ")).includes(need))
      .filter((record) => !input.governorate || record.governorates.map(normalized).includes(normalized(input.governorate)))
      .filter((record) => !input.eligibility || record.eligibility.map(normalized).includes(normalized(input.eligibility)))
      .slice(0, input.limit);
  }

  async all(): Promise<AnyAtlasRecord[]> {
    return allRecords;
  }

  async getById(id: string): Promise<AnyAtlasRecord | undefined> {
    return allRecords.find((record) => record.id === id);
  }

  async coverage(): Promise<{ records: number; byType: Record<string, number>; lastUpdated: string }> {
    return {
      records: allRecords.length,
      byType: Object.fromEntries(allRecords.map((record) => record.type).map((type) => [type, allRecords.filter((record) => record.type === type).length])),
      lastUpdated: allRecords.map((record) => record.lastVerified).sort().at(-1) ?? "",
    };
  }
}
