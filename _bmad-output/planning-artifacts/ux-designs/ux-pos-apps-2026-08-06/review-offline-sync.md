# Offline & Sync Honesty Review — POS Apps

## Overall verdict

**Pass with gaps.** DESIGN.md and EXPERIENCE.md correctly separate Sale complete from Sync waiting, keep Offline calm (navy, not alarm), hard-block Day Close (FR-24), allow offline POS PIN when material exists (FR-5), and keep Dashboard online-only. No stated copy re-labels a complete Sale as pending. Residual risk is underspecified implementer strings/states (retrying Sync, Day Close acknowledge, report-row badges, Dashboard lag empty states).

## Findings

- **[medium]** Sync chip lists `retrying` but Voice table only locks `"Menunggu unggah"` / `"Waiting to upload"`. Implementers can invent retry copy that sounds like Sale failure or pending. Fix: Add locked ID/EN for retrying (e.g. `"Mengunggah ulang"` / `"Retrying upload"`); ban Sale-status words (`pending`, `incomplete`, `gagal penjualan`).

- **[medium]** Day Close hard-block is stated, but acknowledge UI/copy is unspecified — easy to ship a soft “OK” dismiss. Fix: Require explicit acknowledge (checkbox or typed confirm) + primary CTA naming unsynced count; Finish stays disabled until acknowledge or Sync = 0 (FR-24).

- **[medium]** Today’s Sales Report lists transactions without forbidding Sync badges that say “pending” on complete rows (FR-20: past success must not look failed). Fix: Row Sale status stays `"Selesai"` / complete; optional chip only `"Menunggu unggah"`, never `"Pending sale"` / incomplete.

- **[medium]** Dashboard empty/stale sales or Stock before Cashier Sync can read as “no sales today” with no honesty cue that Dashboard is online-only and lags Local DB. Fix: Empty/lag copy may note last sync / online-only truth; never imply Offline Mode or local Cashier Sales on Dashboard.

- **[low]** Amber (`sync-waiting`) also used for “live cart total” focus — weak conflation of cart attention with Sync wait. Fix: Reserve amber fill for Sync/attention chrome; cart total uses weight/size (`cashier-price`), not amber chip semantics.

- **[low]** Offline banner copy is only `"Mode offline"` — no locked reassurance that sell continues (Don’t bans “connection error” as sole frame, but positive line absent). Fix: Optional supporting line under banner, e.g. `"Penjualan tetap jalan"` / `"Selling continues"`.

## PRD cross-check (critical rules)

| Rule | UX alignment |
|---|---|
| Sale complete ≠ Sync waiting (FR-15, FR-20) | Aligned — success copy + `"Menunggu unggah"` chip; Sync must not change Sale label |
| Sync waiting ≠ incomplete | Aligned in Do/Don’t + state table + Flows 1–2 |
| Day Close hard-block (FR-24) | Aligned — finish blocked until Sync or audited acknowledge; soft-dismiss banned |
| Offline POS PIN (FR-5) | Aligned — unlock if PIN material present; clear fail if missing |
| Dashboard offline claims | Aligned — Cashier-only Offline/Local DB; Dashboard online-only; no Offline affordances |
