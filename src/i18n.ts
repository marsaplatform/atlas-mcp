export type Locale = "ar" | "en";
export const locales = ["ar", "en"] as const;

const messages = {
  servicesDisclaimer: {
    ar: "الخدمات وشروطها قد تتغير؛ تحقق من المصدر وتاريخ المراجعة قبل الإحالة.",
    en: "Services and their conditions change; check the source and verification date before referring anyone.",
  },
  eligibilityDisclaimer: {
    ar: "هذا الفحص لا يمثل قرارًا نهائيًا بالأهلية؛ الجهة المقدمة للخدمة هي صاحبة القرار.",
    en: "This check is not a final eligibility decision; the service provider makes that decision.",
  },
  eligibilityNotFound: { ar: "هذا الفحص لا يمثل قرارًا نهائيًا بالأهلية.", en: "This check is not a final eligibility decision." },
  serviceMissing: { ar: "الخدمة غير موجودة.", en: "Service not found." },
  generalTermsOnly: { ar: "السجل يوضح شروطًا عامة فقط.", en: "The record only lists general conditions." },
  nationalityListed: { ar: "الجنسية مذكورة ضمن الفئات العامة في السجل.", en: "The nationality is listed among the record's general groups." },
  openToAll: { ar: "السجل يذكر أن الخدمة متاحة لجميع الجنسيات.", en: "The record says the service is open to all nationalities." },
  groupListed: { ar: "الفئة مذكورة في شروط السجل: ", en: "The group is listed in the record's conditions: " },
  nationalityNotListed: { ar: "الجنسية غير مذكورة صراحة في شروط السجل؛ تأكد من الجهة.", en: "The nationality is not explicitly listed; confirm with the provider." },
  governorateCovered: { ar: "الخدمة مسجلة في المحافظة المطلوبة.", en: "The service is listed in the requested governorate." },
  governorateNotListed: { ar: "الخدمة غير مسجلة في هذه المحافظة؛ قد تتطلب التنقل أو تقدم عن بُعد.", en: "The service is not listed in that governorate; it may require travel or be remote." },
  privacy: {
    ar: "لا تُدخل أسماء أو بيانات حالات شخصية في الأسئلة؛ الأطلس لا يحتاجها ولا يخزنها.",
    en: "Do not put names or personal case details in questions; Atlas neither needs nor stores them.",
  },
  attribution: {
    ar: "أطلس مرسى — بيانات مرتبطة بمصادرها وتاريخ التحقق. https://atlas.marsaplatform.com",
    en: "Marsa Atlas — records linked to their sources and verification dates. https://atlas.marsaplatform.com",
  },
  demoWarning: {
    ar: "بعض السجلات توضيحية (recordStatus=demo) ولا تُستخدم كدليل تشغيلي.",
    en: "Some records are illustrative (recordStatus=demo) and must not be used as operational guidance.",
  },
  legalDisclaimer: { ar: "الملخصات القانونية ليست استشارة قانونية؛ ارجع إلى النص الرسمي الكامل.", en: "Legal summaries are not legal advice; consult the full official text." },
  noResults: { ar: "لا توجد نتائج مطابقة. جرّب كلمة أعم أو محافظة أخرى أو search_atlas.", en: "No matching records. Try a broader word, another governorate, or search_atlas." },
  sources: { ar: "المصادر", en: "Sources" },
  referralTitle: { ar: "ورقة إحالة", en: "Referral sheet" },
  confirmBeforeReferral: { ar: "أكّد الإتاحة والشروط مع الجهة قبل الإحالة، من دون مشاركة بيانات الحالة هنا.", en: "Confirm availability and conditions with the provider before referring, without sharing case data here." },
} as const;

export type MessageKey = keyof typeof messages;
export const t = (key: MessageKey, locale: Locale = "ar"): string => messages[key][locale];
