import { describe, expect, test } from "bun:test";
import demo from "../data/demo.json";
import { RestApiRepository } from "../src/infrastructure/rest-repository";

const fakeApi = () => {
  const requested: string[] = [];
  const fetcher = async (input: string | URL | Request) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    requested.push(url.pathname + url.search);
    if (url.pathname === "/api/v1/records") return Response.json({ total: demo.length, items: demo });
    if (url.pathname.startsWith("/api/v1/records/")) {
      const item = demo.find((record) => record.id === decodeURIComponent(url.pathname.split("/").pop()!));
      return item ? Response.json(item) : Response.json({ error: "not_found" }, { status: 404 });
    }
    if (url.pathname === "/api/v1/coverage") return Response.json({ records: demo.length, byType: {}, lastUpdated: "2026-09-25" });
    return Response.json({ items: demo.slice(0, 1) });
  };
  return { requested, fetcher };
};

describe("RestApiRepository", () => {
  test("reads records from the public Atlas API and caches the corpus", async () => {
    const api = fakeApi();
    const repo = new RestApiRepository("https://atlas.example.org/", api.fetcher);
    expect((await repo.all()).length).toBe(demo.length);
    await repo.all();
    expect(api.requested.filter((path) => path.startsWith("/api/v1/records?")).length).toBe(1);
    expect((await repo.getById("org-stars"))?.title).toContain("StARS");
  });

  test("missing records are undefined, other failures throw", async () => {
    const api = fakeApi();
    const repo = new RestApiRepository("https://atlas.example.org", api.fetcher);
    expect(await repo.getById("nope")).toBeUndefined();
    const broken = new RestApiRepository("https://atlas.example.org", async () => new Response("down", { status: 502 }));
    expect(broken.coverage()).rejects.toThrow("502");
  });
});

 test("loads every page rather than silently truncating the corpus", async () => {
   const offsets: number[] = [];
   const repo = new RestApiRepository("https://atlas.example.org", async (input) => {
     const url = new URL(String(input));
     const offset = Number(url.searchParams.get("offset"));
     offsets.push(offset);
     return Response.json({ total: 3, items: offset === 0 ? demo.slice(0, 2) : demo.slice(2, 3) });
   });
   expect((await repo.all()).length).toBe(3);
   expect(offsets).toEqual([0, 2]);
 });

 test("expired corpus does not serve stale individual records", async () => {
   let title = "Original";
   const repo = new RestApiRepository("https://atlas.example.org", async (input) => {
     const record = { ...demo[0]!, title };
     return Response.json(String(input).includes("records?") ? { total: 1, items: [record] } : record);
   }, -1);
   await repo.all();
   title = "Updated";
   expect((await repo.getById(demo[0]!.id))?.title).toBe("Updated");
 });
