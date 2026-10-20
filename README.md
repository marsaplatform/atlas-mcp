# Marsa Atlas MCP — أطلس مرسى

> **المعلومة، ومعها المصدر.** خدمات وجهات ومراجع قانونية وبيانات الهجرة واللجوء في مصر، موثّقة بمصادرها وتاريخ التحقق، في متناول مساعدك الذكي.

**Source-grounded migration services, organizations, legal references and data for Egypt — as an MCP server on Cloudflare Workers, plus the Atlas website and REST API.**

[![CI](https://github.com/marsaplatform/atlas-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/marsaplatform/atlas-mcp/actions/workflows/ci.yml)
[![MCP](https://img.shields.io/badge/protocol-Model%20Context%20Protocol-7c3aed)](https://modelcontextprotocol.io)
[![Cloudflare Workers](https://img.shields.io/badge/runs%20on-Cloudflare%20Workers-f38020?logo=cloudflare&logoColor=white)](https://workers.cloudflare.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-16a34a.svg)](LICENSE)

```
https://atlas.marsaplatform.com/mcp
```

21 tools · Arabic-first, English too · sources on every result · no API key · no personal data

[العربية](#بالعربية) · [English](#english)

---

## بالعربية

### ما هو أطلس مرسى MCP؟

أطلس مرسى منتج مستقل داخل مرسى يربط الخدمات والجهات والقانون والبيانات المتعلقة بالهجرة واللجوء في مصر بمصادرها وتاريخ التحقق. هذا المستودع يقدّمه كخادم **MCP** (بروتوكول سياق النماذج): أي مساعد ذكي — Claude أو Cursor أو VS Code أو وكيل خاص بك — يتصل به مرة واحدة، فتصبح إجاباته عن الخدمات والمراجع مبنية على سجلات حقيقية مع روابط مصادرها، لا على ذاكرة النموذج.

الخادم يعمل على **Cloudflare Workers** على نفس دومين الأطلس (`atlas.marsaplatform.com/mcp`)، بينما صفحات الموقع وواجهة REST تبقى كما هي.

### المبادئ

- المصدر وتاريخ آخر تحقق يرافقان كل سجل وكل نتيجة (`sources`).
- مصر أولًا والعربية أولًا: يفهم أسماء المحافظات والمدن («6 أكتوبر» ← الجيزة، «الاسكندريه» ← الإسكندرية) والجنسيات بكل صيغها («سوداني/سودانية/سودانيين») والفئات («نساء»، «جميع الجنسيات»).
- لا بيانات حالات شخصية. لا تُدخل أسماء أو تفاصيل حالات.
- فحص الأهلية إرشادي دائمًا؛ الجهة المقدمة للخدمة هي صاحبة القرار.
- السجلات التوضيحية (`recordStatus: "demo"`) معلّمة بوضوح ولا تُستخدم كدليل تشغيلي.
- WordPress في مرسى هو نظام التحرير المرجعي؛ الأطلس يقرأ فقط.

### الأدوات (21 أداة)

| الأداة | الوظيفة |
|---|---|
| `search_atlas` | بحث موحد في كل السجلات |
| `find_services` | خدمات حسب الحاجة والمحافظة والجنسية |
| `check_eligibility` | فحص أهلية إرشادي غير ملزم |
| `build_research_brief` | موجز بحثي بمصادر مرقمة |
| `get_coverage` | حجم التغطية وتاريخها |
| `get_record` | سجل كامل مع السجلات المرتبطة |
| `list_records` | تصفح بالنوع والمحافظة والحالة |
| `find_organizations` | الجهات حسب الاسم ونوع الخدمة والمحافظة |
| `get_organization` | ملف جهة وكل خدماتها |
| `find_legal_references` | مراجع قانونية حسب الموضوع |
| `find_datasets` | مجموعات البيانات والمؤشرات |
| `list_sources` | المصادر والناشرون وحداثتهم |
| `list_governorates` | المحافظات الـ27 وتغطية كل منها |
| `resolve_place` | اسم مكان ← المحافظة |
| `resolve_nationality` | جنسية أو فئة ← رمز ISO3 أو الفئة |
| `list_service_types` | أنواع الخدمات ومفرداتها |
| `compare_governorates` | مقارنة المحافظات وإظهار الفجوات |
| `build_referral_sheet` | ورقة إحالة مرتبة بالمصادر |
| `check_freshness` | السجلات التي تحتاج إعادة تحقق |
| `cite_record` | استشهاد APA وMarkdown وBibTeX |
| `export_records` | تصدير CSV/JSON/Markdown مع manifest |

المرجع الكامل: [docs/tools.md](docs/tools.md).

### الاتصال

- **Claude (موصل مخصص) / Claude Code:** `claude mcp add --transport http marsa-atlas https://atlas.marsaplatform.com/mcp`
- **Cursor:** انسخ [examples/cursor-mcp.json](examples/cursor-mcp.json) إلى `~/.cursor/mcp.json`.
- **Claude Desktop:** [examples/claude-desktop-config.json](examples/claude-desktop-config.json) (عبر `mcp-remote`) أو تشغيل محلي بـ stdio: [examples/claude-desktop-local.json](examples/claude-desktop-local.json).

### أمثلة أسئلة

- «أحتاج دعم نفسي في القاهرة لسيدة سودانية، جهّز ورقة إحالة.»
- «أي المحافظات ليس فيها مساعدة قانونية مسجلة؟»
- «إيه المراجع القانونية عن الإقامة؟ واستشهد بيها بصيغة APA.»
- «إيه السجلات اللي محتاجة إعادة تحقق؟»

محادثات كاملة: [examples/conversations.md](examples/conversations.md).

### التشغيل المحلي والنشر

انظر قسم [Run locally](#run-locally) و[Deploy to Cloudflare Workers](#deploy-to-cloudflare-workers) بالإنجليزية أدناه — الأوامر نفسها.

---

## English

### What is it?

Marsa Atlas links migration and asylum services, organizations, Egyptian legal references and
data to their **original sources and verification dates**. This repository exposes it as an
**MCP server** so any AI assistant can answer from real, citable records — and runs the
Atlas website (`/`, `/en`) and REST API (`/api/v1`).

### Architecture

```text
Marsa WordPress (private, editorial system of record)
            ↓  marsa/v1 (private network)
   Atlas web service on the origin (Bun) ──  /  /en  /api/v1/*
            ↓  public REST: /api/v1/records, /records/{id}, /search, /services, /coverage
   Cloudflare Worker (src/worker.ts) ──  atlas.marsaplatform.com/mcp*  (zone route)
            ↓
   MCP clients: Claude, Cursor, VS Code, agents
```

- **One application layer** (`AtlasService`) behind every interface: Worker MCP, stdio MCP, REST and the web pages.
- **Stateless Streamable HTTP**: a fresh `McpServer` per request, JSON responses, no sessions.
- The zone route only matches `/mcp*`; everything else still reaches the origin unchanged.
- Why Workers: see [ADR 0003](docs/adr/0003-mcp-on-cloudflare-workers.md).

### Tools

21 read-only tools; every result carries `sources` and accepts `locale: "ar" | "en"`.

| Tool | Purpose |
|---|---|
| `search_atlas` | Unified source-grounded search |
| `find_services` | Services by need, governorate, eligibility and nationality |
| `check_eligibility` | Indicative eligibility with mandatory disclaimer |
| `build_research_brief` | Research brief with citations and coverage notes |
| `get_coverage` | Dataset coverage and freshness |
| `get_record` | One record with related records |
| `list_records` | Browse records with filters and paging |
| `find_organizations` | Organizations by name, service type, governorate |
| `get_organization` | Organization profile with all its services |
| `find_legal_references` | Egyptian legal references by topic |
| `find_datasets` | Datasets and indicators |
| `list_sources` | Sources and publishers behind the records |
| `list_governorates` | 27 governorates (AR/EN/ISO 3166-2) with coverage |
| `resolve_place` | Arabic/English place → governorate |
| `resolve_nationality` | Nationality or group → ISO3 / group key |
| `list_service_types` | Service-type taxonomy with AR/EN vocabulary |
| `compare_governorates` | Governorate × service-type matrix with gaps |
| `build_referral_sheet` | Ranked referral sheet with contacts and sources |
| `check_freshness` | Stale or undated records |
| `cite_record` | APA / Markdown / BibTeX citation |
| `export_records` | CSV / JSON / Markdown export with manifest |

Resources: `marsa://coverage`, `marsa://governorates`, `marsa://records/{id}`.
Prompts: `referral`, `research_brief`, `coverage_gaps`. Full reference: [docs/tools.md](docs/tools.md).

### Connect

Hosted endpoint (no key):

```
https://atlas.marsaplatform.com/mcp
```

| Client | How |
|---|---|
| Claude Code | `claude mcp add --transport http marsa-atlas https://atlas.marsaplatform.com/mcp` |
| claude.ai / Claude Desktop | Add a custom connector with the URL, or use [examples/claude-desktop-config.json](examples/claude-desktop-config.json) (`mcp-remote`) |
| Cursor | [examples/cursor-mcp.json](examples/cursor-mcp.json) → `~/.cursor/mcp.json` |
| Local stdio | [examples/claude-desktop-local.json](examples/claude-desktop-local.json) |
| Raw HTTP / SDKs | [examples/http-client.md](examples/http-client.md) |

### Run locally

Requires [Bun](https://bun.sh) ≥ 1.2 (and Node.js ≥ 22 for `wrangler dev`).

```bash
bun install
bun run check                 # typecheck + tests + build

bun run dev                   # MCP over stdio (demo data)
ATLAS_DATA_MODE=api bun run dev   # stdio, live data from the public Atlas API

bun run dev:worker            # the Cloudflare Worker locally → http://localhost:8787/mcp
bun run dev:http              # website + REST on http://localhost:3000 (MCP too with ATLAS_HTTP_MCP=1)
```

Data modes (`ATLAS_DATA_MODE`): `demo` (bundled fixtures, default for the Bun service),
`api` (public Atlas REST, `ATLAS_API_URL`; default for the Worker), `wordpress`
(Marsa WordPress `marsa/v1`, `ATLAS_WORDPRESS_URL`; used by the origin service).

### Deploy to Cloudflare Workers

```bash
export CLOUDFLARE_API_TOKEN=...      # Workers Scripts:Edit (+ Zone Workers Routes:Edit for a route)
export CLOUDFLARE_ACCOUNT_ID=...
bun run deploy                       # wrangler deploy → https://marsa-atlas-mcp.<subdomain>.workers.dev/mcp
```

To mount it on a path of an existing proxied hostname (what production does), add a route
in `wrangler.toml` — only `/mcp*` goes to the Worker:

```toml
routes = [{ pattern = "atlas.example.org/mcp*", zone_name = "example.org" }]
```

Point `ATLAS_API_URL` at your own Atlas web service if you self-host the data side.
`wrangler.toml` contains placeholders only — never commit account ids or tokens.

### Website and REST API

- `GET /` (Arabic), `GET /en` (English): server-rendered search with sources and verification dates.
- `GET /health`, `/healthz`, `/readyz`
- `GET /api/v1/coverage`
- `GET /api/v1/search?q=تعليم`
- `GET /api/v1/services?need=تعليم&governorate=القاهرة`
- `GET /api/v1/records?type=service&limit=100&offset=0`
- `GET /api/v1/records/{id}`

Docker / Coolify: build the `Dockerfile`, expose `3000`, set `ATLAS_DATA_MODE=wordpress` and
`ATLAS_WORDPRESS_URL`. The live deployment uses a private Docker-network WordPress URL; do not
replace it with the main public domain. `/mcp` on this service returns `410` pointing to the
Worker unless `ATLAS_HTTP_MCP=1`.

### Project layout

```text
src/
  worker.ts                  Cloudflare Worker entry (MCP over Streamable HTTP)
  cli.ts                     Bun entry: stdio MCP, or --http for web + REST
  application/atlas-service.ts   all tool logic, sources on every result
  interfaces/mcp.ts          tools, resources, prompts
  interfaces/http.ts         website + REST (origin)
  infrastructure/            demo, WordPress and REST-API repositories
  shared/                    Arabic folding, governorates, nationalities, service-type vocabulary
tests/                       bun test — services, tools, worker, REST, Arabic resolution
examples/                    client configs, HTTP examples, worked conversations
```

### Status

`0.2.0` — see [CHANGELOG.md](CHANGELOG.md). The bundled Zad fonts are under the SIL Open Font
License (`public/fonts/OFL.txt`). Code: [MIT](LICENSE). Record text belongs to its sources.

Part of [Marsa](https://marsaplatform.com) · sibling project: Malja MCP (humanitarian open data).
