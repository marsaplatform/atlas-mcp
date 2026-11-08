import { expect, test } from "bun:test";
import { ATLAS_VERSION } from "../src/application/atlas-service";
import pkg from "../package.json" with { type: "json" };

// The version the service reports must match the released package version, or
// /readyz and the MCP manifest drift from the release silently.
test("ATLAS_VERSION matches package.json", () => {
  expect(ATLAS_VERSION).toBe(pkg.version);
});
