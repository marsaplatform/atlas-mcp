import { describe, expect, test } from "bun:test";
import { handleRequest } from "../src/worker";

const env = { ATLAS_DATA_MODE: "demo" };
const rpc = (id: number, method: string, params: unknown = {}) => new Request("https://atlas.example.org/mcp", {
  method: "POST",
  headers: { "content-type": "application/json", accept: "application/json, text/event-stream", "mcp-protocol-version": "2025-06-18" },
  body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
});

describe("Cloudflare Worker", () => {
  test("initialize over stateless Streamable HTTP", async () => {
    const response = await handleRequest(rpc(1, "initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "0" } }), env);
    expect(response.status).toBe(200);
    const body = await response.json() as { result: { serverInfo: { name: string } } };
    expect(body.result.serverInfo.name).toBe("marsa-atlas");
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
  });

  test("tools/list and tools/call", async () => {
    const list = await (await handleRequest(rpc(2, "tools/list"), env)).json() as { result: { tools: unknown[] } };
    expect(list.result.tools).toHaveLength(21);
    const call = await (await handleRequest(rpc(3, "tools/call", { name: "resolve_place", arguments: { query: "الاسكندريه" } }), env)).json() as { result: { structuredContent: { best: { code: string } } } };
    expect(call.result.structuredContent.best.code).toBe("EG-ALX");
  });

  test("browser GET describes the endpoint; health works", async () => {
    const info = await handleRequest(new Request("https://atlas.example.org/mcp"), env);
    expect(info.status).toBe(200);
    expect((await info.json() as { endpoint: string }).endpoint).toBe("https://atlas.example.org/mcp");
    expect((await handleRequest(new Request("https://atlas.example.org/mcp/health"), env)).status).toBe(200);
  });
});
