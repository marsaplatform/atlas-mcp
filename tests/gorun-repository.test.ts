import { describe, expect, test } from "bun:test";
import { GorunRepository } from "../src/infrastructure/gorun-repository";

const content: Record<string, unknown[]> = {
  atlas_service: [{
    id: "01SERVICE", type: "atlas_service", title: "دعم نفسي", excerpt: "خدمة موثقة",
    fields: { source_url: "https://example.org/source.pdf", source_name: "دليل الخدمات", last_verified: "2026-08-14", record_status: "source_backed", phone: "17365", documents: "اتصل أولًا", legacy_id: 57 },
    terms: { atlas_governorate: ["cairo"], atlas_service_type: ["mental-health"], atlas_eligibility: ["all"], atlas_organization: ["mersal"] },
  }],
  atlas_indicator: [{
    id: "01INDICATOR", type: "atlas_indicator", title: "عدد الخدمات", excerpt: "",
    fields: { indicator_value: "0", live_source: "atlas_service", record_status: "demo" }, terms: {},
  }],
};
const terms: Record<string, unknown[]> = {
  atlas_governorate: [{ slug: "cairo", name: "القاهرة" }],
  atlas_service_type: [{ slug: "mental-health", name: "دعم نفسي" }],
  atlas_eligibility: [{ slug: "all", name: "جميع الجنسيات" }],
  atlas_organization: [{ slug: "mersal", name: "مرسال" }],
};

const gorun = (seen: string[] = []) => async (input: string | URL | Request, init?: RequestInit) => {
  const url = new URL(input instanceof Request ? input.url : input.toString());
  seen.push(new Headers(init?.headers).get("authorization") ?? "");
  const tax = url.pathname.match(/\/taxonomies\/([^/]+)\/terms$/)?.[1];
  const data = tax ? terms[tax] ?? [] : content[url.searchParams.get("type") ?? ""] ?? [];
  return new Response(JSON.stringify({ ok: true, data }));
};

describe("GorunRepository", () => {
  test("maps gorun content and term slugs to Atlas services with stable legacy IDs", async () => {
    const seen: string[] = [];
    const repository = new GorunRepository("http://gorun.test/", "gp_test", gorun(seen));
    const results = await repository.findServices({ need: "دعم", governorate: "القاهرة", limit: 5 });
    expect(results[0]?.id).toBe("wp:marsa_service:57");
    expect(results[0]?.source.url).toBe("https://example.org/source.pdf");
    expect(results[0]?.governorates).toEqual(["القاهرة"]);
    expect(results[0]?.contact?.phone).toBe("17365");
    expect(seen.every((header) => header === "Bearer gp_test")).toBe(true);
  });

  test("counts live indicators from the records it loaded", async () => {
    const repository = new GorunRepository("http://gorun.test", "gp_test", gorun());
    const indicator = (await repository.all()).find((record) => record.type === "indicator");
    expect(indicator?.indicator?.value).toBe("1");
    expect(indicator?.id).toBe("gorun:01INDICATOR");
  });

  test("keeps serving the last good copy when gorun fails", async () => {
    let fail = false;
    const ok = gorun();
    const repository = new GorunRepository("http://gorun.test", "gp_test", async (input, init) => (fail ? new Response("down", { status: 503 }) : ok(input, init)), 0);
    expect((await repository.coverage()).records).toBe(2);
    fail = true;
    expect((await repository.coverage()).records).toBe(2);
  });

  test("fails loudly when there is no cached copy", async () => {
    const repository = new GorunRepository("http://gorun.test", "gp_test", async () => new Response("nope", { status: 401 }));
    expect(repository.all()).rejects.toThrow("401");
  });
});
