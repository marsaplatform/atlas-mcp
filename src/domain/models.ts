export const recordTypes = ["service", "organization", "legal", "dataset", "indicator", "source"] as const;
export type RecordType = (typeof recordTypes)[number];

export interface SourceRef {
  name: string;
  url: string;
  publisher: string;
  publishedAt?: string;
  retrievedAt: string;
}

export interface ContactInfo {
  phone?: string;
  email?: string;
  website?: string;
  whatsapp?: string;
  url?: string;
  address?: string;
  hours?: string;
}

export interface IndicatorValue {
  value: string;
  unit?: string;
  period?: string;
  methodology?: string;
}

export interface AtlasRecord {
  id: string;
  type: RecordType;
  title: string;
  summary: string;
  countryCode: "EG";
  language: "ar" | "en";
  source: SourceRef;
  lastVerified: string;
  recordStatus: "source_backed" | "community_submitted" | "demo";
  coverageNotes: string[];
  tags: string[];
  /** Canonical public page for the record on marsaplatform.com, when known. */
  url?: string;
  /** Governorates the record is attached to (services and organizations). */
  governorates?: string[];
  contact?: ContactInfo;
  indicator?: IndicatorValue;
  downloadUrl?: string;
}

export interface ServiceRecord extends AtlasRecord {
  type: "service";
  organizationId: string;
  serviceTypes: string[];
  governorates: string[];
  eligibility: string[];
  requirements: string[];
  cost?: string;
}

export interface LegalRecord extends AtlasRecord {
  type: "legal";
  legalTopics: string[];
  instrument: string;
  articleNumber?: string;
  effectiveDate?: string;
}

export interface GenericAtlasRecord extends AtlasRecord {
  type: Exclude<RecordType, "service" | "legal">;
}

export type AnyAtlasRecord = GenericAtlasRecord | ServiceRecord | LegalRecord;

export interface SearchInput {
  query: string;
  types: RecordType[];
  limit: number;
}

export interface ServiceSearchInput {
  need: string;
  governorate?: string | undefined;
  eligibility?: string | undefined;
  limit: number;
}

export interface Coverage {
  records: number;
  byType: Record<string, number>;
  lastUpdated: string;
}
