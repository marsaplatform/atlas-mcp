# Worked conversations

Real prompts against the hosted endpoint. Figures come from the live Atlas corpus
(40 records on 2026-10-20) and change as records are added or re-verified.

## 1. «أحتاج دعم نفسي في القاهرة لسيدة سودانية»

1. `build_referral_sheet({ need: "دعم نفسي", governorate: "القاهرة", nationality: "سودانية", groups: ["نساء"] })`
2. The model returns a ranked sheet: Mersal's specialised mental-health services (hotline, hours,
   cost "free per the official source"), a women-only individual support service, and a group
   session listed for Sudanese — each with its source (UNHCR Egypt services booklet, June 2026)
   and verification date, plus the reminder that the provider decides eligibility.

## 2. "Which governorates have no legal aid listed?"

1. `compare_governorates({ need: "legal aid", locale: "en" })` → matrix + `gaps` per governorate.
2. `list_governorates({ onlyCovered: false })` → the 23 governorates with no record at all.

## 3. «إيه المراجع القانونية عن الإقامة؟ واستشهد بيها»

1. `find_legal_references({ topic: "الإقامة" })` → «قانون دخول وإقامة الأجانب» with its source.
2. `cite_record({ id: "wp:marsa_legal:16" })` → APA / Markdown / BibTeX.

## 4. "Is the directory up to date?"

1. `check_freshness({ maxAgeDays: 90 })` → fresh / stale / missing-date counts and the list to re-verify.
2. `list_sources()` → which publisher each record relies on and its latest verification.

## 5. "Give me the services as CSV for my spreadsheet"

`export_records({ format: "csv", type: "service" })` → CSV whose `#` header lines carry the
extraction manifest (`pd.read_csv(path, comment="#")`).
