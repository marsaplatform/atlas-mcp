# ADR 0003: MCP on Cloudflare Workers

## Status

Accepted — 2026-10-20

## Context

Until 0.1.0 the public MCP endpoint ran inside the Bun web process on the origin,
next to the landing pages and REST API. The editorial WordPress is reachable only
from the origin's private network.

## Decision

- The MCP server runs on **Cloudflare Workers** (`src/worker.ts`): stateless
  Streamable HTTP, JSON responses, a fresh `McpServer` per request, JSON Schema
  validation through `@cfworker/json-schema` (no code generation).
- It is mounted on `https://atlas.marsaplatform.com/mcp*` by a **zone route**, so
  the public URL is unchanged and every other path still reaches the origin.
- The Worker reads the **public Atlas REST API** (`/api/v1/records`, `/records/{id}`,
  `/search`, `/services`, `/coverage`) — WordPress stays private and the origin
  remains the single read path to it. The corpus is cached per isolate for 5 minutes.
- The origin web service no longer serves `/mcp` (returns `410` pointing to the
  Worker) unless `ATLAS_HTTP_MCP=1` — kept for self-hosting and rollback.
- stdio (`bun run dev`) remains for local desktop clients.
