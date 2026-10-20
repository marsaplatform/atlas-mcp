#!/usr/bin/env bun
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { AtlasService } from "./application/atlas-service";
import { createRepository } from "./infrastructure/repository-factory";
import { startHttpServer } from "./interfaces/http";
import { createMcpServer } from "./interfaces/mcp";

const service = new AtlasService(createRepository());
const http = process.argv.includes("--http");

if (http) {
  const port = Number(process.env.ATLAS_PORT ?? 3000);
  startHttpServer(service, port, { mcp: process.env.ATLAS_HTTP_MCP === "1", ...(process.env.ATLAS_PUBLIC_MCP_URL ? { publicMcpUrl: process.env.ATLAS_PUBLIC_MCP_URL } : {}) });
  console.error(JSON.stringify({ level: "info", event: "http_started", port, mcp: process.env.ATLAS_HTTP_MCP === "1" }));
} else {
  const server = createMcpServer(service);
  await server.connect(new StdioServerTransport());
}
