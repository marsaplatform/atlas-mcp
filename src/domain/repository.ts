import type { AnyAtlasRecord, Coverage, SearchInput, ServiceRecord, ServiceSearchInput } from "./models";

export interface AtlasRepository {
  search(input: SearchInput): Promise<AnyAtlasRecord[]>;
  findServices(input: ServiceSearchInput): Promise<ServiceRecord[]>;
  getById(id: string): Promise<AnyAtlasRecord | undefined>;
  /** Every published record. The Atlas corpus is small (tens to low hundreds of records). */
  all(): Promise<AnyAtlasRecord[]>;
  coverage(): Promise<Coverage>;
}
