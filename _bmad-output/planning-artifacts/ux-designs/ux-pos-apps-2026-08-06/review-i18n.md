# i18n Review — POS Apps

## Overall verdict

**Not ready as an implementable i18n contract.** Foundation correctly states Indonesian-first / default locale `id`, EN secondary, Settings language switch, and a good Voice glossary seed — but Key Flows, IA, and most chrome still teach English as primary; critical cashier strings (Day Close acknowledge, empty/error states) lack ID copy; money/date locale rules are unspecified.

## Findings

- **[critical]** Key Flows (and IA labels) use English as primary UI names — **POS PIN**, **Day Close**, **Account Login**, **Cart Panel**, **Checkout**, **Receipt** — while Voice says ID is primary (`PIN kasir`, `Tutup hari`, etc.). Implementers will ship EN chrome. Fix: Rewrite Flows 1–3 with ID primary / EN in parentheses; align IA screen column to ID labels (EN secondary).

- **[critical]** Glossary inconsistency: Voice maps `"PIN kasir"` → `"POS PIN"` and `"Tutup hari"` → `"Day Close"`, but DESIGN colors/components and EXPERIENCE patterns/states/flows use only the EN terms. Fix: Canonical glossary table (ID term | EN term | domain synonym) and use ID everywhere UI copy appears; reserve EN for EN locale + domain docs.

- **[critical]** Day Close unsynced **acknowledge** has behavior only (“explicit acknowledge”, audited) — no ID/EN microcopy for block reason, acknowledge CTA, or audit-facing confirmation. Fix: Add Voice rows e.g. block copy, `"Saya mengerti — tutup dengan penjualan belum terunggah"` / EN, and confirm button.

- **[high]** Missing ID (and EN) strings for high-traffic empty/error states called out only as behavior: empty catalog Menu guidance; offline + PIN material missing; Sync chip `synced` / `retrying`; Receipt fail retry/cancel; blocked Day Close finish; Dashboard empty sales; cashier mutate denied (403). Fix: Extend Voice & Tone table (or a Microcopy appendix) with ID primary / EN secondary for each State Pattern row.

- **[high]** Money formatting: DESIGN requires integer minor units + tabular figures but never binds locale — IDR (`Rp`, `.` thousands, no decimals typical) vs EN display. Fix: Spec `id` → `IDR` via `Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' })` (or equivalent); EN locale may keep IDR currency with `en` grouping; never show raw minor units to cashiers.

- **[medium]** Date/time formatting unset for Day Close report, sales list, Sync timestamps. Fix: Format with active UI locale (`id-ID` / `en`); document timezone (device local vs shop) for Phase 1.

- **[medium]** Settings language switch is named but underspecified: immediacy, persistence (per-device), whether formats follow language, no mixed-chrome rule, no ID/EN labels for the control itself. Fix: One paragraph — switch applies immediately to all chrome; preference persisted on device; number/date follow selected locale; product catalog names stay as entered.

- **[low]** RTL not addressed. Fix: Explicitly state LTR-only Phase 1; RTL out of scope (ID + EN only) — no RTL layout work.

- **[low]** DESIGN Do’s say “Indonesian-first UI strings” but body copy (Brand & Style, Colors) is EN-only with no pointer to required ID string inventory. Fix: Cross-link EXPERIENCE Voice table as the string source of truth for implementation.
