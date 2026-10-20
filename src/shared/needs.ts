import { normalizeText, tokens } from "./arabic";

/**
 * Canonical service types used in the Marsa directory, with the words people
 * use for them in Arabic (MSA and Egyptian) and English. Lets "mental health",
 * «نفسي» and «دكتور نفسي» all find «دعم نفسي» services.
 */
export const serviceTypes = [
  { key: "education", ar: "تعليم", en: "Education", words: ["تعليم", "تعليمي", "مدرسة", "مدارس", "دراسة", "تعلم", "محو الأمية", "school", "schools", "education", "learning", "literacy", "classes"] },
  { key: "health", ar: "صحة", en: "Health", words: ["صحة", "صحي", "طبي", "علاج", "عيادة", "مستشفى", "دكتور", "طبيب", "ولادة", "حمل", "health", "medical", "clinic", "hospital", "doctor", "maternal", "pregnancy", "healthcare"] },
  { key: "mental_health", ar: "دعم نفسي", en: "Mental health & psychosocial support", words: ["دعم نفسي", "نفسي", "نفسية", "صحة نفسية", "اكتئاب", "صدمة", "mental", "mental health", "psychosocial", "mhpss", "counselling", "counseling", "trauma", "therapy"] },
  { key: "legal", ar: "مساعدة قانونية", en: "Legal aid", words: ["مساعدة قانونية", "قانوني", "قانونية", "قانون", "محامي", "محامٍ", "إقامة", "اقامة", "تسجيل", "وثائق", "أوراق", "بطاقة المفوضية", "تسجيل المواليد", "legal", "lawyer", "residency", "residence permit", "documents", "registration", "birth registration", "unhcr card"] },
  { key: "protection", ar: "حماية", en: "Protection", words: ["حماية", "عنف", "عنف قائم على النوع", "إساءة", "خطر", "طوارئ", "إحالة عاجلة", "protection", "violence", "gbv", "abuse", "safety", "case management", "emergency"] },
  { key: "livelihoods", ar: "سبل العيش", en: "Livelihoods", words: ["سبل العيش", "عمل", "شغل", "وظيفة", "وظائف", "تدريب مهني", "مشروع", "مشروعات صغيرة", "دخل", "livelihood", "livelihoods", "job", "jobs", "work", "employment", "vocational", "training", "small business"] },
  { key: "cash", ar: "مساعدات نقدية", en: "Cash assistance", words: ["مساعدات نقدية", "مساعدة نقدية", "دعم مالي", "فلوس", "cash", "cash assistance", "financial support"] },
  { key: "shelter", ar: "سكن", en: "Shelter", words: ["سكن", "مأوى", "إيجار", "شقة", "shelter", "housing", "rent", "accommodation"] },
  { key: "food", ar: "غذاء", en: "Food", words: ["غذاء", "طعام", "أكل", "تغذية", "food", "nutrition", "meals"] },
] as const;
export type ServiceTypeKey = (typeof serviceTypes)[number]["key"];

/** Service types whose vocabulary matches the need, strongest first. */
export function resolveNeed(need: string): (typeof serviceTypes)[number][] {
  const q = normalizeText(need);
  const qTokens = tokens(need);
  const scored = serviceTypes.map((type) => {
    let score = 0;
    for (const word of type.words) {
      const w = normalizeText(word);
      if (w === q) score += 2;
      else if (` ${q} `.includes(` ${w} `)) score += 0.8 + Math.min(w.length, 20) / 100;
      else if (qTokens.some((t) => t.length >= 3 && w.startsWith(t))) score += 0.3;
    }
    return { type, score };
  });
  const ranked = scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score);
  const top = ranked[0]?.score ?? 0;
  // Keep only the dominant meanings: "mental health" is mental_health, not also generic health.
  return ranked.filter((s) => s.score >= top * 0.75).map((s) => s.type);
}

/** Canonical service type for a label that appears on a record («دعم نفسي» → mental_health). */
export function serviceTypeOf(label: string): (typeof serviceTypes)[number] | undefined {
  const l = normalizeText(label);
  return serviceTypes.find((type) => normalizeText(type.ar) === l) ?? resolveNeed(label)[0];
}
