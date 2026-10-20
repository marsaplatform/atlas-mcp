import { describe, expect, test } from "bun:test";
import { normalizeText } from "../src/shared/arabic";
import { canonicalGovernorate, governorates, resolvePlace } from "../src/shared/places";
import { classifyEligibility, resolveGroup, resolveNationality } from "../src/shared/nationalities";
import { resolveNeed } from "../src/shared/needs";

describe("Arabic folding", () => {
  test("hamza, taa marbuta, article and diacritics fold together", () => {
    expect(normalizeText("الإسكندريّة")).toBe(normalizeText("اسكندريه"));
    expect(normalizeText("الأقصر")).toBe(normalizeText("اقصر"));
    expect(normalizeText("٦ أكتوبر")).toBe("6 اكتوبر");
  });
});

describe("places", () => {
  test("all 27 governorates with unique ISO 3166-2 codes", () => {
    expect(governorates).toHaveLength(27);
    expect(new Set(governorates.map((g) => g.code)).size).toBe(27);
  });
  test.each([
    ["6 أكتوبر", "الجيزة"], ["٦ أكتوبر", "الجيزة"], ["فيصل", "الجيزة"], ["Giza", "الجيزة"], ["EG-GZ", "الجيزة"],
    ["الاسكندريه", "الإسكندرية"], ["Alex", "الإسكندرية"], ["مدينة نصر", "القاهرة"], ["cairo", "القاهرة"],
    ["شبرا الخيمة", "القليوبية"], ["Hurghada", "البحر الأحمر"], ["العاشر من رمضان", "الشرقية"], ["اسوان", "أسوان"],
  ])("%s → %s", (query, expected) => {
    expect(canonicalGovernorate(query)).toBe(expected);
  });
  test("unknown places resolve to nothing", () => {
    expect(resolvePlace("أتلانتس")).toEqual([]);
  });
});

describe("nationalities and groups", () => {
  test.each([
    ["سوداني", "SDN"], ["سودانيين", "SDN"], ["سودانية", "SDN"], ["السودان", "SDN"], ["Sudanese", "SDN"], ["SDN", "SDN"],
    ["جنوب السودان", "SSD"], ["جنوب سودانيون", "SSD"], ["سوريون", "SYR"], ["Syrian", "SYR"], ["يمنية", "YEM"], ["ارتيريا", "ERI"], ["اثيوبي", "ETH"],
  ])("%s → %s", (query, iso3) => {
    expect(resolveNationality(query)?.iso3).toBe(iso3);
  });
  test("eligibility labels are classified", () => {
    expect(resolveGroup("جميع الجنسيات")).toBe("all");
    expect(resolveGroup("نساء")).toBe("women");
    expect(resolveGroup("children")).toBe("children");
    expect(classifyEligibility("سودانيون")).toMatchObject({ kind: "nationality" });
    expect(classifyEligibility("دعم مالي").kind).toBe("unknown");
  });
});

describe("needs", () => {
  test.each([
    ["mental health", "mental_health"], ["دكتور نفسي", "mental_health"], ["دعم نفسي", "mental_health"],
    ["مدرسة", "education"], ["legal aid", "legal"], ["تجديد الإقامة", "legal"], ["شغل", "livelihoods"], ["عيادة", "health"],
  ])("%s → %s", (need, key) => {
    expect(resolveNeed(need)[0]?.key as string | undefined).toBe(key);
  });
});
