import { beforeAll, describe, expect, test } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { AtlasService } from "../src/application/atlas-service";
import { DemoRepository } from "../src/infrastructure/demo-repository";
import { createMcpServer } from "../src/interfaces/mcp";

const legacyTools = ["search_atlas", "find_services", "check_eligibility", "build_research_brief", "get_coverage"];
const calls: Record<string, Record<string, unknown>> = {
  search_atlas: { query: "تعليم" },
  find_services: { need: "تعليم", governorate: "القاهرة" },
  check_eligibility: { serviceId: "service-education-1", profile: { nationality: "سوداني", governorate: "Cairo" } },
  build_research_brief: { question: "ما خدمات التعليم المتاحة؟" },
  get_coverage: {},
  get_record: { id: "service-education-1" },
  list_records: { type: "service" },
  find_organizations: { serviceType: "education" },
  get_organization: { idOrName: "StARS" },
  find_legal_references: { topic: "التعليم" },
  find_datasets: {},
  list_sources: {},
  list_governorates: { onlyCovered: true },
  resolve_place: { query: "6 أكتوبر" },
  resolve_nationality: { query: "سودانيين" },
  list_service_types: {},
  compare_governorates: {},
  build_referral_sheet: { need: "دعم نفسي", governorate: "الجيزة", nationality: "Syrian", locale: "en" },
  check_freshness: { maxAgeDays: 365 },
  cite_record: { id: "legal-education-1" },
  export_records: { format: "csv", type: "service" },
};

let client: Client;
beforeAll(async () => {
  const server = createMcpServer(new AtlasService(new DemoRepository(), () => new Date("2026-10-20T00:00:00Z")));
  const [a, b] = InMemoryTransport.createLinkedPair();
  client = new Client({ name: "test", version: "0" });
  await Promise.all([server.connect(a), client.connect(b)]);
});

describe("MCP surface", () => {
  test("exposes 21 read-only tools, keeping every 0.1.0 tool name", async () => {
    const { tools } = await client.listTools();
    const names = tools.map((tool) => tool.name);
    expect(names).toHaveLength(21);
    for (const name of legacyTools) expect(names).toContain(name);
    expect(new Set(names)).toEqual(new Set(Object.keys(calls)));
    for (const tool of tools) {
      expect(tool.annotations?.readOnlyHint).toBe(true);
      expect(Object.keys(tool.inputSchema.properties ?? {})).toContain("locale");
    }
  });

  for (const [name, args] of Object.entries(calls)) {
    test(`${name} succeeds and cites its sources`, async () => {
      const result = await client.callTool({ name, arguments: args });
      expect(result.isError).toBeFalsy();
      const structured = result.structuredContent as { sources?: unknown[] };
      expect(Array.isArray(structured.sources)).toBe(true);
      expect(structured.sources!.length).toBeGreaterThan(0);
    });
  }

  test("Arabic place names drive results", async () => {
    const result = await client.callTool({ name: "find_services", arguments: { need: "mental health", governorate: "٦ أكتوبر" } });
    const structured = result.structuredContent as { resolved: { governorate: string }; items: Array<{ id: string }> };
    expect(structured.resolved.governorate).toBe("الجيزة");
    expect(structured.items.map((item) => item.id)).toContain("service-mental-health-1");
  });

  test("eligibility recognises Arabic demonym forms but never decides", async () => {
    const result = await client.callTool({ name: "check_eligibility", arguments: { serviceId: "service-education-1", profile: { nationality: "سودانية" } } });
    const structured = result.structuredContent as { decision: string; signals: { matched: string[] } };
    expect(structured.decision).toBe("needs_confirmation");
    expect(structured.signals.matched.length).toBeGreaterThan(0);
  });

  test("freshness flags old records", async () => {
    const result = await client.callTool({ name: "check_freshness", arguments: { maxAgeDays: 365 } });
    const structured = result.structuredContent as { stale: Array<{ id: string }> };
    expect(structured.stale.map((row) => row.id)).toContain("service-legal-1");
  });

  test("CSV export carries a manifest", async () => {
    const result = await client.callTool({ name: "export_records", arguments: { format: "csv" } });
    const structured = result.structuredContent as { content: string };
    expect(structured.content.startsWith("# tool: export_records")).toBe(true);
    expect(structured.content).toContain("source_url");
  });

  test("record resource returns the real record", async () => {
    const resource = await client.readResource({ uri: "marsa://records/org-stars" });
    const first = resource.contents[0] as { text: string };
    expect(JSON.parse(first.text).record.id).toBe("org-stars");
  });

  test("prompts are available", async () => {
    const { prompts } = await client.listPrompts();
    expect(prompts.map((prompt) => prompt.name).sort()).toEqual(["coverage_gaps", "referral", "research_brief"]);
  });
});
