import records from "../../data/demo.json";
import type { AnyAtlasRecord } from "../domain/models";
import { InMemoryRepository } from "./in-memory-repository";

const allRecords = records as AnyAtlasRecord[];

export class DemoRepository extends InMemoryRepository {
  protected async load(): Promise<AnyAtlasRecord[]> {
    return allRecords;
  }
}
