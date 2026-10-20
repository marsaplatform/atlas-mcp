import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { AtlasService } from "../src/application/atlas-service";
import { DemoRepository } from "../src/infrastructure/demo-repository";
import { startHttpServer } from "../src/interfaces/http";

describe("REST records API and MCP switch", () => {
  let off: ReturnType<typeof Bun.serve>;
  let on: ReturnType<typeof Bun.serve>;
  beforeAll(() => {
    off = startHttpServer(new AtlasService(new DemoRepository()), 0);
    on = startHttpServer(new AtlasService(new DemoRepository()), 0, { mcp: true });
  });
  afterAll(() => { off.stop(true); on.stop(true); });

  test("GET /api/v1/records lists and filters", async () => {
    const all = await (await fetch(`http://127.0.0.1:${off.port}/api/v1/records`)).json() as { total: number; items: unknown[] };
    expect(all.total).toBeGreaterThan(3);
    const legal = await (await fetch(`http://127.0.0.1:${off.port}/api/v1/records?type=legal`)).json() as { items: Array<{ type: string }> };
    expect(legal.items.every((item) => item.type === "legal")).toBe(true);
    expect((await fetch(`http://127.0.0.1:${off.port}/api/v1/records?type=nope`)).status).toBe(400);
  });

  test("GET /api/v1/records/:id", async () => {
    const response = await fetch(`http://127.0.0.1:${off.port}/api/v1/records/org-stars`);
    expect(response.status).toBe(200);
    expect((await response.json() as { id: string }).id).toBe("org-stars");
    expect((await fetch(`http://127.0.0.1:${off.port}/api/v1/records/missing`)).status).toBe(404);
  });

  test("in-process /mcp is off by default and points to the Worker", async () => {
    const response = await fetch(`http://127.0.0.1:${off.port}/mcp`, { method: "POST" });
    expect(response.status).toBe(410);
    expect((await response.json() as { mcp: string }).mcp).toBe("https://atlas.marsaplatform.com/mcp");
  });

  test("ATLAS_HTTP_MCP=1 keeps the in-process endpoint for self-hosting", async () => {
    const response = await fetch(`http://127.0.0.1:${on.port}/mcp`, { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }) });
    expect(response.status).toBe(200);
    expect(((await response.json()) as { result: { tools: unknown[] } }).result.tools).toHaveLength(21);
  });
});
