# Tool reference — مرجع الأدوات

Every tool is **read-only**, accepts an optional `locale` (`"ar"` default, or `"en"`) for
human-readable text, and returns `structuredContent` with a **`sources`** array
(`recordId, title, source, url, publisher, lastVerified, recordStatus, marsaUrl`) and an
`attribution` line. When any returned record is illustrative, `warnings` says so.
Place inputs accept Arabic or English governorate/city names («6 أكتوبر», "Alex", «الاسكندريه»,
"EG-GZ"); nationality inputs accept any Arabic gender/plural form («سوداني/سودانية/سودانيين»),
country names and ISO3 codes.

| # | Tool | What it does | Key inputs |
|---|---|---|---|
| 1 | `search_atlas` | Unified search across all record types, Arabic-aware fallback ranking | `query`, `types[]`, `limit` |
| 2 | `find_services` | Services by need, governorate, eligibility label and nationality; needs map to service types | `need`, `governorate`, `eligibility`, `nationality` |
| 3 | `check_eligibility` | Indicative check of a profile against a service's listed conditions — never a decision | `serviceId`, `profile{nationality,governorate,groups[]}` |
| 4 | `build_research_brief` | Markdown brief with numbered citations and coverage notes | `question`, `limit` |
| 5 | `get_coverage` | Record counts by type and latest verification date | — |
| 6 | `get_record` | One record in full, with related records (provider ↔ services) | `id` |
| 7 | `list_records` | Browse with filters and paging | `type`, `governorate`, `status`, `limit`, `offset` |
| 8 | `find_organizations` | Organizations by name, service type or governorate, with service counts | `query`, `serviceType`, `governorate` |
| 9 | `get_organization` | Organization profile and all its services | `idOrName` |
| 10 | `find_legal_references` | Egyptian legal references by topic (article, issue date, source) | `topic` |
| 11 | `find_datasets` | Datasets (download links) and indicators (value, unit, period, methodology) | `query`, `includeIndicators` |
| 12 | `list_sources` | Sources/publishers behind the records, counts and freshness | — |
| 13 | `list_governorates` | All 27 governorates (AR/EN/ISO 3166-2) with service & organization counts | `onlyCovered` |
| 14 | `resolve_place` | Place/city/district → governorate, with spelling variants | `query` |
| 15 | `resolve_nationality` | Nationality or population group → ISO3 / group key | `query` |
| 16 | `list_service_types` | Service-type taxonomy with AR/EN vocabulary and counts | — |
| 17 | `compare_governorates` | Governorate × service-type matrix with gaps | `governorates[]`, `need` |
| 18 | `build_referral_sheet` | Ranked referral sheet: contacts, requirements, hours, cost, why listed, source, age | `need`, `governorate`, `nationality`, `groups[]` |
| 19 | `check_freshness` | Fresh / stale / missing-date records against a max age | `maxAgeDays`, `type` |
| 20 | `cite_record` | APA, Markdown and BibTeX citations | `id` |
| 21 | `export_records` | CSV / JSON / Markdown export with a reproducible manifest | `format`, `type`, `governorate`, `query`, `limit` |

Tools 1–5 keep their 0.1.0 names and inputs; outputs only gained fields.

## Resources

- `marsa://coverage` — coverage JSON
- `marsa://governorates` — governorates with Atlas counts
- `marsa://records/{id}` — a full record with related records

## Prompts

- `referral` — prepare a referral for a need/governorate/nationality
- `research_brief` — cited brief on a topic
- `coverage_gaps` — where services are missing or stale

## Principles

- No personal case data in, none stored.
- Eligibility is indicative; the provider decides.
- Illustrative (`recordStatus: "demo"`) records are flagged and must not be used as operational guidance.
