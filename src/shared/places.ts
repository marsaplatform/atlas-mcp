import { matchScore, normalizeText } from "./arabic";

/** An Egyptian governorate (محافظة) with ISO 3166-2:EG code and the names people actually type. */
export interface Governorate {
  code: string;
  ar: string;
  en: string;
  region: "greater_cairo" | "delta" | "canal" | "alexandria_coast" | "upper_egypt" | "frontier";
  aliases: string[];
  /** Cities, districts and neighbourhoods that belong to this governorate. */
  places: string[];
}

export const governorates: readonly Governorate[] = [
  { code: "EG-C", ar: "القاهرة", en: "Cairo", region: "greater_cairo", aliases: ["cairo", "al qahirah", "el qahera", "القاهره"], places: ["مدينة نصر", "nasr city", "المعادي", "maadi", "مصر الجديدة", "heliopolis", "وسط البلد", "downtown", "عين شمس", "ain shams", "التجمع الخامس", "التجمع", "القاهرة الجديدة", "new cairo", "حلوان", "helwan", "شبرا", "shubra", "المقطم", "mokattam", "العباسية", "abbassia", "الزمالك", "zamalek", "المرج", "السلام", "الشروق", "بدر", "عرب المعادي"] },
  { code: "EG-GZ", ar: "الجيزة", en: "Giza", region: "greater_cairo", aliases: ["giza", "gizah", "el giza", "الجيزه", "جيزة"], places: ["6 أكتوبر", "السادس من أكتوبر", "اكتوبر", "6th of october", "october city", "الشيخ زايد", "sheikh zayed", "فيصل", "faisal", "الهرم", "haram", "pyramids", "الدقي", "dokki", "المهندسين", "mohandessin", "إمبابة", "imbaba", "العمرانية", "بولاق الدكرور", "الحوامدية", "البدرشين", "العياط"] },
  { code: "EG-ALX", ar: "الإسكندرية", en: "Alexandria", region: "alexandria_coast", aliases: ["alexandria", "alex", "اسكندرية", "الاسكندريه", "إسكندرية"], places: ["العجمي", "agami", "سيدي بشر", "sidi bishr", "برج العرب", "borg el arab", "المنتزه", "montaza", "محرم بك", "العامرية", "سموحة", "smouha", "ميامي", "المندرة"] },
  { code: "EG-KB", ar: "القليوبية", en: "Qalyubia", region: "greater_cairo", aliases: ["qalyubia", "qalyubiya", "kalyoubia", "القليوبيه"], places: ["شبرا الخيمة", "shubra el kheima", "بنها", "benha", "العبور", "obour", "الخانكة", "قليوب", "qalyub", "الخصوص"] },
  { code: "EG-SHR", ar: "الشرقية", en: "Sharqia", region: "delta", aliases: ["sharqia", "sharkia", "ash sharqiyah", "الشرقيه"], places: ["الزقازيق", "zagazig", "العاشر من رمضان", "10th of ramadan", "بلبيس", "belbeis", "منيا القمح"] },
  { code: "EG-DK", ar: "الدقهلية", en: "Dakahlia", region: "delta", aliases: ["dakahlia", "daqahliyah", "الدقهليه"], places: ["المنصورة", "mansoura", "ميت غمر", "طلخا"] },
  { code: "EG-GH", ar: "الغربية", en: "Gharbia", region: "delta", aliases: ["gharbia", "gharbiya", "الغربيه"], places: ["طنطا", "tanta", "المحلة الكبرى", "المحلة", "mahalla", "كفر الزيات"] },
  { code: "EG-MNF", ar: "المنوفية", en: "Monufia", region: "delta", aliases: ["monufia", "menoufia", "minufiyah", "المنوفيه"], places: ["شبين الكوم", "shibin el kom", "مدينة السادات", "sadat city", "منوف"] },
  { code: "EG-BH", ar: "البحيرة", en: "Beheira", region: "delta", aliases: ["beheira", "buhayrah", "البحيره"], places: ["دمنهور", "damanhur", "كفر الدوار", "رشيد", "rosetta", "وادي النطرون"] },
  { code: "EG-KFS", ar: "كفر الشيخ", en: "Kafr El Sheikh", region: "delta", aliases: ["kafr el sheikh", "kafr ash shaykh", "kafrelsheikh"], places: ["دسوق", "بلطيم", "desouk"] },
  { code: "EG-DT", ar: "دمياط", en: "Damietta", region: "delta", aliases: ["damietta", "dumyat"], places: ["دمياط الجديدة", "new damietta", "رأس البر", "ras el bar"] },
  { code: "EG-PTS", ar: "بورسعيد", en: "Port Said", region: "canal", aliases: ["port said", "bur said", "بور سعيد"], places: ["بورفؤاد", "port fouad"] },
  { code: "EG-IS", ar: "الإسماعيلية", en: "Ismailia", region: "canal", aliases: ["ismailia", "ismailiya", "الاسماعيليه"], places: ["فايد", "fayed", "القنطرة", "التل الكبير"] },
  { code: "EG-SUZ", ar: "السويس", en: "Suez", region: "canal", aliases: ["suez", "as suways"], places: ["العين السخنة", "ain sokhna", "الأربعين"] },
  { code: "EG-SIN", ar: "شمال سيناء", en: "North Sinai", region: "frontier", aliases: ["north sinai", "shamal sina"], places: ["العريش", "arish", "رفح", "rafah", "الشيخ زويد", "بئر العبد"] },
  { code: "EG-JS", ar: "جنوب سيناء", en: "South Sinai", region: "frontier", aliases: ["south sinai", "janub sina"], places: ["شرم الشيخ", "sharm el sheikh", "دهب", "dahab", "الطور", "el tor", "نويبع", "nuweiba", "سانت كاترين"] },
  { code: "EG-BA", ar: "البحر الأحمر", en: "Red Sea", region: "frontier", aliases: ["red sea", "al bahr al ahmar"], places: ["الغردقة", "hurghada", "سفاجا", "safaga", "مرسى علم", "marsa alam", "القصير", "حلايب", "شلاتين"] },
  { code: "EG-FYM", ar: "الفيوم", en: "Faiyum", region: "upper_egypt", aliases: ["faiyum", "fayoum", "fayum"], places: ["سنورس", "طامية", "إطسا"] },
  { code: "EG-BNS", ar: "بني سويف", en: "Beni Suef", region: "upper_egypt", aliases: ["beni suef", "bani suwayf"], places: ["الواسطى", "ناصر", "ببا"] },
  { code: "EG-MN", ar: "المنيا", en: "Minya", region: "upper_egypt", aliases: ["minya", "al minya", "el minya"], places: ["ملوي", "mallawi", "سمالوط", "مغاغة"] },
  { code: "EG-AST", ar: "أسيوط", en: "Asyut", region: "upper_egypt", aliases: ["asyut", "assiut", "asiut"], places: ["ديروط", "منفلوط", "القوصية"] },
  { code: "EG-SHG", ar: "سوهاج", en: "Sohag", region: "upper_egypt", aliases: ["sohag", "suhaj"], places: ["أخميم", "جرجا", "طهطا"] },
  { code: "EG-KN", ar: "قنا", en: "Qena", region: "upper_egypt", aliases: ["qena", "qina", "kena"], places: ["نجع حمادي", "nag hammadi", "قوص", "دشنا"] },
  { code: "EG-LX", ar: "الأقصر", en: "Luxor", region: "upper_egypt", aliases: ["luxor", "al uqsur"], places: ["إسنا", "esna", "أرمنت", "الطود"] },
  { code: "EG-ASN", ar: "أسوان", en: "Aswan", region: "upper_egypt", aliases: ["aswan", "aswān"], places: ["كوم أمبو", "kom ombo", "إدفو", "edfu", "أبو سمبل", "abu simbel", "دراو"] },
  { code: "EG-WAD", ar: "الوادي الجديد", en: "New Valley", region: "frontier", aliases: ["new valley", "al wadi al jadid"], places: ["الخارجة", "kharga", "الداخلة", "dakhla", "الفرافرة", "farafra", "باريس"] },
  { code: "EG-MT", ar: "مطروح", en: "Matrouh", region: "frontier", aliases: ["matrouh", "matruh", "marsa matruh"], places: ["مرسى مطروح", "سيوة", "siwa", "السلوم", "sallum", "العلمين", "el alamein", "الضبعة"] },
];

export interface PlaceMatch {
  governorate: Governorate;
  matchedName: string;
  kind: "governorate" | "place";
  score: number;
}

/** Resolve a free-text place («6 أكتوبر», "Giza", «الجيزه», "EG-GZ") to governorates, best first. */
export function resolvePlace(query: string, limit = 3): PlaceMatch[] {
  const q = normalizeText(query);
  if (!q) return [];
  const matches: PlaceMatch[] = [];
  for (const governorate of governorates) {
    let best: PlaceMatch | undefined;
    const consider = (name: string, kind: PlaceMatch["kind"], weight: number) => {
      const score = (normalizeText(name) === q ? 1 : matchScore(q, normalizeText(name))) * weight;
      if (score > 0 && (!best || score > best.score)) best = { governorate, matchedName: name, kind, score };
    };
    consider(governorate.code, "governorate", 1);
    for (const name of [governorate.ar, governorate.en, ...governorate.aliases]) consider(name, "governorate", 1);
    for (const name of governorate.places) consider(name, "place", 0.95);
    if (best && best.score >= 0.6) matches.push(best);
  }
  return matches.sort((a, b) => b.score - a.score).slice(0, limit);
}

/** Canonical Arabic governorate name for a free-text place, or undefined. */
export function canonicalGovernorate(query: string | undefined): string | undefined {
  if (!query) return undefined;
  return resolvePlace(query, 1)[0]?.governorate.ar;
}

/** True when a record governorate label refers to the same governorate as `canonicalAr`. */
export function sameGovernorate(label: string, canonicalAr: string): boolean {
  return normalizeText(label) === normalizeText(canonicalAr) || canonicalGovernorate(label) === canonicalAr;
}
