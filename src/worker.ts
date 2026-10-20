/**
 * Marsa Atlas MCP on Cloudflare Workers.
 *
 * Stateless Streamable HTTP (JSON responses) at `/mcp`. Each request builds a
 * fresh McpServer — no sessions, no Durable Objects, trivially scalable.
 * Data comes from the public Atlas REST API (ATLAS_API_URL), which keeps the
 * editorial WordPress private. Mounted in production on
 * https://atlas.marsaplatform.com/mcp by a zone route, so the Atlas web pages
 * on the origin are untouched.
 */
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { CfWorkerJsonSchemaValidator } from "@modelcontextprotocol/sdk/validation/cfworker";
import { ATLAS_VERSION, AtlasService } from "./application/atlas-service";
import type { AtlasRepository } from "./domain/repository";
import { DemoRepository } from "./infrastructure/demo-repository";
import { RestApiRepository } from "./infrastructure/rest-repository";
import { createMcpServer } from "./interfaces/mcp";

export interface Env {
  /** Base URL of the Atlas REST API. Default: https://atlas.marsaplatform.com */
  ATLAS_API_URL?: string;
  /** `api` (default) or `demo` (bundled fixtures, no network). */
  ATLAS_DATA_MODE?: string;
}

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,DELETE,OPTIONS",
  "access-control-allow-headers": "content-type,accept,authorization,mcp-protocol-version,mcp-session-id,last-event-id",
  "access-control-expose-headers": "mcp-session-id,mcp-protocol-version",
};

const json = (value: unknown, status = 200): Response => Response.json(value, { status, headers: { ...cors, "cache-control": "no-store" } });

// One repository per isolate so its short in-memory cache is shared across requests.
let repository: { key: string; repo: AtlasRepository } | undefined;
const repositoryFor = (env: Env): AtlasRepository => {
  const mode = env.ATLAS_DATA_MODE ?? "api";
  const key = `${mode}:${env.ATLAS_API_URL ?? ""}`;
  if (!repository || repository.key !== key) repository = { key, repo: mode === "demo" ? new DemoRepository() : new RestApiRepository(env.ATLAS_API_URL ?? "https://atlas.marsaplatform.com") };
  return repository.repo;
};

const info = (url: URL) => ({
  name: "marsa-atlas",
  title: "Marsa Atlas MCP — أطلس مرسى",
  version: ATLAS_VERSION,
  transport: "streamable-http (stateless, JSON responses)",
  endpoint: `${url.origin}/mcp`,
  docs: "https://github.com/marsaplatform/atlas-mcp#readme",
  website: "https://atlas.marsaplatform.com",
  usage: "POST JSON-RPC to /mcp with `accept: application/json, text/event-stream`.",
});

export async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (path === "/mcp/health" || path === "/health") return json({ ok: true, service: "marsa-atlas-mcp", version: ATLAS_VERSION, runtime: "cloudflare-workers" });
  if (path === "/mcp") {
    // A browser opening the URL gets a friendly description instead of a 406.
    if (request.method === "GET" && !(request.headers.get("accept") ?? "").includes("text/event-stream")) return json(info(url));
    if (request.method === "GET" || request.method === "DELETE") return json({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed: this endpoint is stateless; send POST requests." }, id: null }, 405);
    const service = new AtlasService(repositoryFor(env));
    const server = createMcpServer(service, { jsonSchemaValidator: new CfWorkerJsonSchemaValidator() });
    const transport = new WebStandardStreamableHTTPServerTransport({ enableJsonResponse: true });
    await server.connect(transport);
    const response = await transport.handleRequest(request);
    const headers = new Headers(response.headers);
    for (const [key, value] of Object.entries(cors)) headers.set(key, value);
    return new Response(response.body, { status: response.status, headers });
  }
  if (path === "/") return json(info(url));
  return json({ error: "not_found", hint: "MCP endpoint: POST /mcp" }, 404);
}

export default {
  fetch: (request: Request, env: Env) => handleRequest(request, env),
};
