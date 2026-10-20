import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { ATLAS_VERSION, type AtlasService } from "../application/atlas-service";
import { createMcpServer } from "./mcp";
import { recordTypes, type RecordType } from "../domain/models";
import { landing, type LandingState } from "./landing";
import stylesheet from "./landing.css" with { type: "text" };
import browserScript from "./atlas-browser.js" with { type: "text" };

const json = (value: unknown, status = 200): Response => Response.json(value, { status, headers: { "access-control-allow-origin": "*", "cache-control": "no-store" } });

export interface HttpOptions {
  /**
   * Serve MCP in-process at `/mcp`. Off by default since 0.2.0: the public MCP
   * endpoint runs on Cloudflare Workers (src/worker.ts) and is mounted on
   * https://atlas.marsaplatform.com/mcp by a zone route. Set ATLAS_HTTP_MCP=1
   * for self-hosting or to roll back to the in-process endpoint.
   */
  mcp?: boolean;
  publicMcpUrl?: string;
}

const recordTypeSet = new Set<string>(recordTypes);

export function startHttpServer(service: AtlasService, port: number, options: HttpOptions = {}): ReturnType<typeof Bun.serve> {
  return Bun.serve({
    port,
    async fetch(request) {
      const url = new URL(request.url);
      if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-methods": "GET,POST,OPTIONS", "access-control-allow-headers": "content-type,mcp-protocol-version" } });
      if (["/health", "/healthz", "/readyz"].includes(url.pathname)) {
        return json({ ok: true, service: "marsa-atlas", version: ATLAS_VERSION });
      }
      if (url.pathname === "/api/v1/coverage" && request.method === "GET") return json(await service.coverage());
      if (url.pathname === "/api/v1/search" && request.method === "GET") {
        const query = url.searchParams.get("q")?.trim() ?? "";
        if (query.length < 2) return json({ error: "q must contain at least 2 characters" }, 400);
        return json(await service.search({ query, types: [], limit: Math.min(Number(url.searchParams.get("limit") ?? 10), 50) }));
      }
      if (url.pathname === "/api/v1/services" && request.method === "GET") {
        const need = url.searchParams.get("need")?.trim() ?? "";
        if (need.length < 2) return json({ error: "need must contain at least 2 characters" }, 400);
        return json(await service.findServices({ need, governorate: url.searchParams.get("governorate") ?? undefined, eligibility: url.searchParams.get("eligibility") ?? undefined, limit: 20 }));
      }
      if (url.pathname === "/api/v1/records" && request.method === "GET") {
        const type = url.searchParams.get("type") ?? "";
        if (type && !recordTypeSet.has(type)) return json({ error: `type must be one of ${recordTypes.join(", ")}` }, 400);
        const limit = Math.max(1, Math.min(Number(url.searchParams.get("limit") ?? 100) || 100, 500));
        const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0) || 0);
        return json(await service.listRecords({ type: (type || undefined) as RecordType | undefined, limit, offset }));
      }
      if (url.pathname.startsWith("/api/v1/records/") && request.method === "GET") {
        const id = decodeURIComponent(url.pathname.slice("/api/v1/records/".length));
        const record = id ? (await service.getRecord(id)) : undefined;
        if (!record?.found) return json({ error: "not_found", id }, 404);
        return json(record.record);
      }
      if (url.pathname === "/mcp" && !options.mcp) {
        const location = options.publicMcpUrl ?? "https://atlas.marsaplatform.com/mcp";
        return json({ error: "gone", message: `The Atlas MCP endpoint is served by Cloudflare Workers at ${location}. Set ATLAS_HTTP_MCP=1 to serve MCP from this process.`, mcp: location }, 410);
      }
      if (url.pathname === "/mcp") {
        const server = createMcpServer(service);
        const transport = new WebStandardStreamableHTTPServerTransport({ enableJsonResponse: true });
        await server.connect(transport);
        return transport.handleRequest(request);
      }
      if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/en" || url.pathname === "/en/")) {
        const locale = url.pathname.startsWith("/en") ? "en" : "ar";
        const state: LandingState = { query: (url.searchParams.get("q") ?? "").trim().slice(0,200), mode: url.searchParams.get("mode") === "services" ? "services" : "all", governorate: (url.searchParams.get("governorate") ?? "").trim().slice(0,100) };
        if (state.query.length >= 2) {
          try { state.items = state.mode === "services" ? (await service.findServices({need:state.query, governorate:state.governorate || undefined, limit:20})).items : (await service.search({query:state.query, types:[], limit:20})).items; }
          catch { state.error = true; }
        }
        return new Response(landing(locale,state), { headers: { "content-type": "text/html; charset=utf-8", "cache-control":"no-store", "content-security-policy":"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'self'", "x-content-type-options":"nosniff", "referrer-policy":"strict-origin-when-cross-origin" } });
      }
      if (request.method === "GET" && url.pathname === "/assets/atlas.css") return new Response(stylesheet,{headers:{"content-type":"text/css; charset=utf-8","cache-control":"public,max-age=300"}});
      if (request.method === "GET" && url.pathname === "/assets/atlas.js") return new Response(browserScript,{headers:{"content-type":"text/javascript; charset=utf-8","cache-control":"public,max-age=300"}});
      const assetPaths: Record<string,string> = { "/assets/open-space.webp":"public/open-space.webp", "/assets/fonts/OFL.txt":"public/fonts/OFL.txt", "/assets/fonts/Zad-Regular.woff2":"public/fonts/Zad-Regular.woff2", "/assets/fonts/Zad-Bold.woff2":"public/fonts/Zad-Bold.woff2" };
      if (request.method === "GET" && assetPaths[url.pathname]) return new Response(Bun.file(assetPaths[url.pathname]!),{headers:{"cache-control":"public,max-age=86400"}});
      return json({ error: "not_found" }, 404);
    },
  });
}
