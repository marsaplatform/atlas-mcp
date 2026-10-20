/**
 * Arabic-aware text normalisation, shared by search, place and nationality
 * resolution. Adapted from Malja MCP's country matcher (marsaplatform/malja-mcp, MIT).
 *
 * Folding makes spelling variants compare equal: harakat and tatweel are
 * stripped, hamza/alef forms unified, taa marbuta → haa, alef maqsura → yaa,
 * and the definite article «ال» is dropped at the start of each token
 * («الأردن» = «الاردن» = «اردن»). Applied to both sides of every comparison.
 */
export function foldArabic(input: string): string {
  return input
    .replace(/[\u064B-\u065F\u0670\u06DF]/g, "")
    .replace(/\u0640/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ئ/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ة/g, "ه")
    .replace(/(^|\s)ال(?=\S{2,})/g, "$1");
}

const arabicDigits = /[٠-٩]/g;

/** Lowercase, fold Arabic, strip Latin diacritics and punctuation, collapse whitespace. */
export function normalizeText(input: string): string {
  return foldArabic(input.normalize("NFKC").replace(arabicDigits, (d) => String(d.charCodeAt(0) - 0x0660)))
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Meaningful tokens of a free-text query (length ≥ 2 after folding, stop-words removed). */
const stopWords = new Set(["في", "من", "علي", "عن", "الي", "او", "و", "ما", "هي", "هو", "هل", "مع", "كيف", "اين", "the", "a", "an", "in", "of", "for", "and", "or", "to", "with", "what", "where", "how", "is", "are"]);
export function tokens(input: string): string[] {
  return [...new Set(normalizeText(input).split(" ").filter((t) => t.length >= 2 && !stopWords.has(t)))];
}

/** Score how well `query` matches `name` (both normalised): 1 exact … 0 none. */
export function matchScore(query: string, name: string): number {
  if (!query || !name) return 0;
  if (name === query) return 1;
  if (name.startsWith(query) || query.startsWith(name)) return 0.85;
  if (name.includes(query) || (name.length >= 3 && query.includes(name))) return 0.7;
  const q = query.split(" ");
  const n = new Set(name.split(" "));
  const overlap = q.filter((t) => n.has(t)).length;
  if (overlap > 0 && overlap === q.length) return 0.6;
  if (overlap > 0) return 0.4 * (overlap / q.length);
  return 0;
}

/** True when the normalised haystack contains the normalised needle (or any of its tokens, if `anyToken`). */
export function textIncludes(haystack: string, needle: string, anyToken = false): boolean {
  const h = normalizeText(haystack);
  const n = normalizeText(needle);
  if (!n) return false;
  if (h.includes(n)) return true;
  return anyToken && tokens(needle).some((t) => t.length >= 3 && h.includes(t));
}
