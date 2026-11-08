# Changelog

## 0.3.0 — 2026-11-09

### Added
- **GoRun data mode**: `ATLAS_DATA_MODE=gorun` reads records from a GoRun CMS
  (`ATLAS_GORUN_URL` + `ATLAS_GORUN_TOKEN`). Search/filter logic shared with the
  demo repository through a new `InMemoryRepository` base class
  (`src/infrastructure/in-memory-repository.ts`, `gorun-repository.ts`,
  `tests/gorun-repository.test.ts`). This is how atlas.marsaplatform.com is
  served in production.
- **Identity 2026**: redesigned landing experience — IBM Plex Sans Arabic and
  Readex Pro fonts (OFL, licenses in `public/fonts/OFL.txt`), new palette,
  brand mark, tap-to-call/WhatsApp contact blocks on results, and motion
  (count-up, scroll reveals) that respects `prefers-reduced-motion`.

### Changed
- `DemoRepository` now extends the shared `InMemoryRepository` base.
- `.env.example` documents the `gorun` mode and its variables.

## 0.2.0 — 2026-10-20

### Added
- **MCP on Cloudflare Workers** (`src/worker.ts`, `wrangler.toml`), mounted at `https://atlas.marsaplatform.com/mcp`.
- **16 new tools** (21 total): `get_record`, `list_records`, `find_organizations`, `get_organization`,
  `find_legal_references`, `find_datasets`, `list_sources`, `list_governorates`, `resolve_place`,
  `resolve_nationality`, `list_service_types`, `compare_governorates`, `build_referral_sheet`,
  `check_freshness`, `cite_record`, `export_records`.
- Arabic understanding: governorate/city names (27 governorates, ISO 3166-2, districts, spelling variants),
  nationality demonyms in every gender/plural form, eligibility groups, need → service-type vocabulary.
- `sources` + `attribution` on every tool result; optional `locale: "ar" | "en"` on every tool.
- Resources `marsa://governorates` and a real `marsa://records/{id}`; prompts `referral`, `research_brief`, `coverage_gaps`.
- REST: `GET /api/v1/records` and `GET /api/v1/records/{id}`.
- Arabic/English landing pages at `/` and `/en` (as deployed 2026-10-20).

### Changed
- The origin web service no longer serves `/mcp` by default (`410` → Worker); `ATLAS_HTTP_MCP=1` restores it.
- WordPress mapping keeps contact details, cost, indicator values and download links.
- Repository renamed to `marsaplatform/atlas-mcp`.

## 0.1.0 — 2026-08-14
- Foundation: 5 tools, REST, WordPress connector, demo fixtures.
