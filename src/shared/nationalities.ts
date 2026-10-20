import { normalizeText } from "./arabic";

/**
 * Nationalities and population groups as they appear in Arabic service
 * eligibility («سودانيون», «جميع الجنسيات», «نساء») and as users type them
 * ("Sudanese", «سوداني», «السودان», "SDN").
 */
export interface Nationality {
  iso3: string;
  ar: string;
  en: string;
  /** Arabic adjective stem (masculine singular); feminine/plural forms are derived. */
  demonymAr: string;
  demonymEn: string;
  aliases: string[];
}

export const nationalities: readonly Nationality[] = [
  { iso3: "SDN", ar: "السودان", en: "Sudan", demonymAr: "سوداني", demonymEn: "Sudanese", aliases: [] },
  { iso3: "SSD", ar: "جنوب السودان", en: "South Sudan", demonymAr: "جنوب سوداني", demonymEn: "South Sudanese", aliases: ["south sudanese"] },
  { iso3: "SYR", ar: "سوريا", en: "Syria", demonymAr: "سوري", demonymEn: "Syrian", aliases: ["سورية", "syrian arab republic"] },
  { iso3: "YEM", ar: "اليمن", en: "Yemen", demonymAr: "يمني", demonymEn: "Yemeni", aliases: [] },
  { iso3: "ERI", ar: "إريتريا", en: "Eritrea", demonymAr: "إريتري", demonymEn: "Eritrean", aliases: ["إرتريا", "ارتيريا", "إرتري"] },
  { iso3: "ETH", ar: "إثيوبيا", en: "Ethiopia", demonymAr: "إثيوبي", demonymEn: "Ethiopian", aliases: ["أثيوبيا", "اثيوبي", "الحبشة"] },
  { iso3: "SOM", ar: "الصومال", en: "Somalia", demonymAr: "صومالي", demonymEn: "Somali", aliases: [] },
  { iso3: "IRQ", ar: "العراق", en: "Iraq", demonymAr: "عراقي", demonymEn: "Iraqi", aliases: [] },
  { iso3: "PSE", ar: "فلسطين", en: "Palestine", demonymAr: "فلسطيني", demonymEn: "Palestinian", aliases: ["غزة", "gaza", "state of palestine"] },
  { iso3: "LBY", ar: "ليبيا", en: "Libya", demonymAr: "ليبي", demonymEn: "Libyan", aliases: [] },
  { iso3: "EGY", ar: "مصر", en: "Egypt", demonymAr: "مصري", demonymEn: "Egyptian", aliases: [] },
  { iso3: "TCD", ar: "تشاد", en: "Chad", demonymAr: "تشادي", demonymEn: "Chadian", aliases: [] },
  { iso3: "NGA", ar: "نيجيريا", en: "Nigeria", demonymAr: "نيجيري", demonymEn: "Nigerian", aliases: [] },
  { iso3: "COD", ar: "الكونغو الديمقراطية", en: "DR Congo", demonymAr: "كونغولي", demonymEn: "Congolese", aliases: ["drc", "democratic republic of the congo", "congo"] },
  { iso3: "CMR", ar: "الكاميرون", en: "Cameroon", demonymAr: "كاميروني", demonymEn: "Cameroonian", aliases: [] },
  { iso3: "BDI", ar: "بوروندي", en: "Burundi", demonymAr: "بوروندي", demonymEn: "Burundian", aliases: [] },
  { iso3: "AFG", ar: "أفغانستان", en: "Afghanistan", demonymAr: "أفغاني", demonymEn: "Afghan", aliases: [] },
  { iso3: "UGA", ar: "أوغندا", en: "Uganda", demonymAr: "أوغندي", demonymEn: "Ugandan", aliases: [] },
  { iso3: "SEN", ar: "السنغال", en: "Senegal", demonymAr: "سنغالي", demonymEn: "Senegalese", aliases: [] },
];

export const populationGroups = {
  all: { ar: "جميع الجنسيات", en: "All nationalities", names: ["جميع الجنسيات", "كل الجنسيات", "الجميع", "جميع الفئات", "all nationalities", "all", "everyone", "any nationality"] },
  refugees: { ar: "لاجئون", en: "Refugees", names: ["لاجئ", "لاجئة", "لاجئون", "لاجئين", "اللاجئين", "refugee", "refugees"] },
  asylum_seekers: { ar: "طالبو لجوء", en: "Asylum seekers", names: ["طالب لجوء", "طالبة لجوء", "طالبو لجوء", "طالبي لجوء", "asylum seeker", "asylum seekers"] },
  migrants: { ar: "مهاجرون", en: "Migrants", names: ["مهاجر", "مهاجرة", "مهاجرون", "مهاجرين", "migrant", "migrants"] },
  women: { ar: "نساء", en: "Women", names: ["نساء", "امرأة", "إمرأة", "سيدات", "سيدة", "النساء", "فتيات", "women", "woman", "female", "girls"] },
  children: { ar: "أطفال", en: "Children", names: ["أطفال", "طفل", "طفلة", "الأطفال", "قاصر", "قاصرون", "children", "child", "minors", "minor", "kids"] },
  stateless: { ar: "عديمو الجنسية", en: "Stateless people", names: ["عديم الجنسية", "عديمو الجنسية", "عديمي الجنسية", "stateless"] },
} as const;
export type PopulationGroup = keyof typeof populationGroups;

const demonymForms = (stem: string): string[] => [stem, `${stem}ة`, `${stem}ون`, `${stem}ين`];

const nationalityNames = (n: Nationality): string[] => [n.iso3, n.ar, n.en, n.demonymEn, `${n.demonymEn}s`, ...demonymForms(n.demonymAr), ...n.aliases];

export type EligibilityTerm =
  | { kind: "nationality"; nationality: Nationality; label: string }
  | { kind: "group"; group: PopulationGroup; label: string }
  | { kind: "unknown"; label: string };

/** Resolve a nationality from a country name, demonym or ISO3 code, in Arabic or English. */
export function resolveNationality(query: string): Nationality | undefined {
  const q = normalizeText(query);
  if (!q) return undefined;
  // Exact match first, then "contains" for multi-word inputs like «من السودان».
  for (const n of nationalities) if (nationalityNames(n).some((name) => normalizeText(name) === q)) return n;
  const sorted = [...nationalities].sort((a, b) => b.ar.length - a.ar.length); // «جنوب السودان» before «السودان»
  for (const n of sorted) if (nationalityNames(n).some((name) => { const k = normalizeText(name); return k.length >= 3 && ` ${q} `.includes(` ${k} `); })) return n;
  return undefined;
}

export function resolveGroup(query: string): PopulationGroup | undefined {
  const q = normalizeText(query);
  for (const [key, group] of Object.entries(populationGroups)) if (group.names.some((name) => normalizeText(name) === q)) return key as PopulationGroup;
  return undefined;
}

/** Classify an eligibility label from a record or a user profile. */
export function classifyEligibility(label: string): EligibilityTerm {
  const group = resolveGroup(label);
  if (group) return { kind: "group", group, label };
  const nationality = resolveNationality(label);
  if (nationality) return { kind: "nationality", nationality, label };
  return { kind: "unknown", label };
}
