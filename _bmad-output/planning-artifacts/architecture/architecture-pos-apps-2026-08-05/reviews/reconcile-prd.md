---
title: "Reconcile — PRD vs Architecture Spine"
status: draft
created: 2026-08-06
updated: 2026-08-06
sources:
  - _bmad-output/planning-artifacts/prds/prd-pos-apps-2026-08-05/prd.md
  - _bmad-output/planning-artifacts/architecture/architecture-pos-apps-2026-08-05/ARCHITECTURE-SPINE.md
focus:
  - Offline Mode
  - Sale completeness
  - Sync
  - Stock
  - NestJS api
  - Cashier Local Database
---

# Reconcile: Final PRD ↔ Architecture Spine

Compares **PRD** (`prd.md`, status: final) against **ARCHITECTURE-SPINE** (status: draft) for Phase 1 gaps. Focus areas called out explicitly; other drift noted only when it blocks those areas.

**Verdict:** Spine correctly adopts Sale completeness (AD-2), Day Close vs Sync (AD-8), and auth split (AD-6). Several **write-path and catalog-pull** decisions remain underspecified relative to the PRD’s Offline Mode + Stock FRs. NestJS module list is a seed, not a contract that fully covers FR surface.

---

## 1. Offline Mode

### Aligned

| PRD | Spine |
| --- | --- |
| FR-14–FR-21 offline sell on Local Database; complete Sale = success; Sync may lag | AD-1 local-primary; Offline Mode + Sync row in capability map |
| Sync pending must not re-label Sale incomplete (FR-15, FR-20) | AD-3 explicit |
| Offline drill (FR-21); no CRDT / multi-cashier perfection | Deferred matches PRD §5 |
| Offline Mode only on Cashier | AD-7 surface separation |

### Gaps

| ID | Severity | Gap |
| --- | --- | --- |
| G-OFF-1 | **High** | **Catalog bootstrap for offline Cashier Menu is missing from spine invariants.** PRD FR-14 requires Cashier Menu / Cart / Checkout offline; FR-29 requires products available after “catalog refresh / Sync to Local Database.” Spine Sync contract (AD-3 + conventions) describes **upload of complete Sales only**. Diagram arrow is one-way `Outbox → API`. No AD for: when catalog is pulled, what is cached (products, prices, stock snapshot?), invalidate-on-edit, or failure if Local Database has no catalog. Offline Mode is incomplete without a catalog-in path. |
| G-OFF-2 | Medium | **Local Database readiness gate.** FR-14: without Local Database, offline sell blocked with clear error. Spine does not define “ready” (schema migrated? catalog present? PIN material present?). Needed for FR-5 + FR-14 acceptance. |
| G-OFF-3 | Low | **Online vs offline UX switch.** PRD UJ-2 assumes POS usable against Local Database when network drops mid-shift. Spine implies local-primary always, but does not state whether online path still writes Local-first (see G-SALE-1). Mid-Sale network flap behavior is unspecified. |

---

## 2. Sale completeness

### Aligned

| PRD | Spine |
| --- | --- |
| Complete = payment recorded **and** Receipt success (print or on-screen) | AD-2 `[ADOPTED]` |
| Incomplete → no Stock update; retry/cancel (FR-10–FR-12) | AD-2: incomplete must not enter Sync outbox; must not mutate server Stock |
| Offline complete Sale remains success while Sync waits (FR-15) | AD-2 + AD-3 |

### Gaps

| ID | Severity | Gap |
| --- | --- | --- |
| G-SALE-1 | **High** | **Dual write path ambiguity (“online create” vs local-primary).** AD-1: Cashier Local Database is SoR for complete-but-unsynced Sales. AD-4: API mutates Stock on “**online create or Sync**.” That implies a Cashier→API direct Sale create when online, parallel to outbox Sync. PRD Instant Checkout + Offline Mode treat Local Database as the sell path for UJ-2 and do not define a separate online-bypass. If online bypasses Local DB, Offline Mode mid-shift and Day Close totals (local + synced) get harder; if everything is Local-first + Sync, “online create” should be removed or redefined as “Sync of a just-completed Sale while online.” **Spine must pick one Sale write topology.** |
| G-SALE-2 | Medium | **Incomplete / cancel lifecycle in Local Database.** FR-12: print failed → incomplete; cancel discards without Stock change. Spine bans incomplete from outbox/Stock but does not say whether incomplete Sales are stored in Local DB, their `status` enum, or how cancel purges them. ER diagram has `status` + `synced` with no allowed values. |
| G-SALE-3 | Low | **On-screen Receipt confirm (PRD §8) vs print.** AD-2 mentions print or on-screen confirm; capability map points at cashier. No shared domain predicate in spine text for “Receipt success” variants — fine for seed, but `packages/domain` Sale completeness rule should enumerate both before stories. |

---

## 3. Sync

### Aligned

| PRD | Spine |
| --- | --- |
| Reconnect Syncs complete Sales; no silent drop (FR-17) | AD-3 + outbox |
| Retry; do not block next Sale (FR-19) | AD-3 |
| Status indicator ≠ incomplete Sale (FR-20) | AD-3 |
| Day Close hard block / acknowledge (FR-24); remain for later Sync (FR-27) | AD-8 |

### Gaps

| ID | Severity | Gap |
| --- | --- | --- |
| G-SYNC-1 | **High** | Same as G-OFF-1: **no catalog / product pull Sync.** PRD uses “Sync” for Sales upload **and** catalog-to-device refresh (FR-29). Spine overloads Sync as Sales upload only. Rename or split: e.g. `SalesSync` (outbox) vs `CatalogPull` — otherwise FR-29 has no architectural home. |
| G-SYNC-2 | Medium | **Idempotency + payload fields are spine-only.** AD-3 (`sale_id` UUID before complete, idempotent POST, `device_id`) is correct enrichment; PRD does not contradict. Not a PRD violation — but epics need this locked before Nest SyncModule. Confirm: Sync accepts **only** `status=complete` documents. |
| G-SYNC-3 | Medium | **Stale catalog / deleted product on Sync accept.** Offline Sale may reference a product later disabled on Dashboard (FR-29). Spine defers CRDT but does not say Sync accept behavior: reject, accept with snapshot lines, or soft-warn. Affects Stock mutation (AD-4) and FR-17 “one record per complete local Sale.” |
| G-SYNC-4 | Low | **Day Close acknowledge audit note (FR-24).** AD-8 requires acknowledge; PRD says recorded audit note. Spine does not say Local DB vs API persistence of that note — Dashboard cannot see acknowledge if only local. |

---

## 4. Stock

### Aligned

| PRD | Spine |
| --- | --- |
| Stock updates only for complete Sales (online or after Sync) — FR-11, FR-18, FR-30 | AD-2 + AD-4 |
| Dashboard reads Stock | AD-4, AD-7 |
| Only server Stock is Dashboard truth | AD-4 |

### Gaps

| ID | Severity | Gap |
| --- | --- | --- |
| G-STK-1 | Medium | **Manual Stock edit vs Sale-driven mutation.** FR-28: Dashboard can set Stock qty. AD-4: only API mutates Stock when accepting a complete Sale. Manual adjust needs an explicit API path (CatalogModule/StockModule) so it does not conflict with “Sale-only mutation” wording. |
| G-STK-2 | Medium | **Offline oversell / negative Stock.** Neither PRD nor spine says whether Cashier blocks sell when local/server qty would go negative. Coffee-shop Phase 1 may allow oversell; if so, document. If not, Local Database needs a stock snapshot rule (ties to G-OFF-1). |
| G-STK-3 | Medium | **Optimistic local qty (AD-4) unbound.** Spine allows Cashier “optimistic local qty for UX”; PRD Instant Checkout FRs never require showing Stock on Cashier Menu. When does local qty decrement (complete Sale? add to cart?)? Can it diverge permanently if Sync fails? Prefer: omit Cashier Stock UI in Phase 1 **or** specify decrement-at-complete + reconcile-on-catalog-pull. |
| G-STK-4 | Low | **Stock timing on online path.** Depends on G-SALE-1: Stock mutates on Sync ack only (pure local-primary) vs on online create response. PRD FR-11 “after complete Sale on the online path” fits either if Sync is immediate when online — but architecture text must not imply two mutators. |

---

## 5. NestJS `apps/api`

### Aligned

| PRD need | Spine seed |
| --- | --- |
| Account Login (FR-1) | AuthModule; Bearer after login |
| Catalog for Dashboard + feed Cashier (FR-28–29) | CatalogModule |
| Sync accept + Stock from Sales (FR-17–18, FR-30) | Sales/SyncModule, StockModule |
| No public marketplace API / Background Worker required (PRD §5) | Deferred Background Worker; API is product API not marketplace |

### Gaps

| ID | Severity | Gap |
| --- | --- | --- |
| G-API-1 | **High** | **Endpoint / use-case inventory not mapped to FRs.** Module names are a scaffold only. Missing explicit spine (or companion) coverage for: Account Login + token; role-gated catalog CRUD (FR-32); catalog list/pull for Cashier; Sync POST idempotent; Stock read for Dashboard; sales list/daily totals (FR-31); optional Day Close acknowledge upload. Without this map, Nest boundaries vs `packages/domain` stay vague. |
| G-API-2 | Medium | **Authorization for FR-32.** Spine Auth headers = Bearer; POS PIN local-only (AD-6). No rule that JWT/session carries catalog vs cashier-only role, or that CatalogModule enforces it. PRD consequences require cashier-only cannot edit products. |
| G-API-3 | Medium | **Sales/SyncModule vs StockModule ownership.** AD-4 says Stock mutates only when accepting a complete Sale — imply Stock decrement is inside Sync/Sale accept transaction, not a separate Cashier-callable Stock write. Spine should state single transactional accept path. |
| G-API-4 | Low | **Session expiry offline.** Account Login is online-only (AD-6). Token refresh while offline, expired Bearer after reconnect before Sync — not specified; Sync retries may fail auth and need re-login without losing outbox (FR-16, FR-19). |

---

## 6. Cashier Local Database

### Aligned

| PRD | Spine |
| --- | --- |
| Local Database for offline sell (glossary, FR-14–16) | `packages/local-db` IndexedDB (idb); cashier only (AD-7) |
| Durable unsynced complete Sales (FR-16) | Outbox + Local DB in structural seed |
| Offline POS PIN material (FR-5) | AD-6 persist PIN verification material |
| Latency ASSUMPTIONs on Local Database path (PRD §4.2 / SM-4) | Stack choice (IndexedDB) supports; no contradiction |

### Gaps

| ID | Severity | Gap |
| --- | --- | --- |
| G-LDB-1 | **High** | **Schema incomplete vs PRD entities.** ER sketch: USER, PRODUCT, SALE, SALE_LINE. Missing relative to FRs: Sync outbox records, POS PIN / session material (FR-5), Day Close acknowledge audit (FR-24), catalog sync metadata (version/`pulled_at`), incomplete Sale records (FR-12). Spine should list required local stores before scaffold stories. |
| G-LDB-2 | Medium | **Authority of local PRODUCT.stock_qty.** PRODUCT includes `stock_qty` in ER diagram; AD-4 says Cashier qty is not Dashboard truth. Clarify local `stock_qty` is cache/UX only (or omit from local schema until needed). |
| G-LDB-3 | Medium | **Security of PIN material at rest.** PRD §8: passwords/PIN not logged plaintext. AD-6 stores PIN verification material in Local Database — hashing/wrapping, device binding, and clear-on-logout (FR-4 / FR-27) not specified. |
| G-LDB-4 | Low | **Quota, multi-tab, eviction.** FR-16 durability vs IndexedDB quota and multi-tab PWA writers — deferred OK for Phase 1 demo, but note as Open Question if pilot runs long shifts with many unsynced Sales. |

---

## 7. Cross-cutting / secondary drift

| ID | Notes |
| --- | --- |
| G-X-1 | **Money:** Spine = integer minor units. PRD Open Question #3 tax inclusive/exclusive — domain money rules not yet bound; does not block Offline Mode but blocks Sale line totals consistency. |
| G-X-2 | **Platform:** PRD §8 PWA-first; spine Next.js PWA + Serwist assumption — aligned. Native shell deferred — aligned. |
| G-X-3 | **Binds header:** Spine claims `FR-1..FR-32` but several FRs (catalog pull, roles, incomplete cancel, Day Close audit) lack governing ADs beyond AD-2/6/8. |
| G-X-4 | **Status mismatch:** PRD `final`, spine `draft` — expected; close High gaps before treating spine as build substrate. |

---

## 8. Priority summary (architecture follow-ups)

Resolve in spine (or a short companion) before epics/stories on Offline Mode:

1. **G-SALE-1** — Single Sale write topology: Local-first always + Sync (including when online), **or** documented dual path with Day Close/Stock implications.
2. **G-OFF-1 / G-SYNC-1** — Catalog pull / Local Database bootstrap invariant (separate from Sales Sync outbox).
3. **G-LDB-1** — Local Database store inventory (outbox, PIN material, catalog meta, Sale status enum).
4. **G-API-1 / G-API-2 / G-API-3** — NestFR map: Sync accept transaction owns Stock; roles on catalog; Cashier catalog pull endpoint.
5. **G-STK-1 / G-STK-2 / G-STK-3** — Manual Stock adjust path; oversell policy; drop or bind optimistic Cashier qty.

Medium/Low items (G-SALE-2, G-SYNC-3–4, G-LDB-3–4, G-API-4, G-X-1) can land as Open Questions on the spine or first infra/auth stories.

---

## 9. What is *not* a gap

- Sale completeness gate matching PRD (AD-2).
- Sync status must not demote complete Sales (AD-3).
- Day Close vs unsynced acknowledge (AD-8).
- Offline POS PIN after prior Account Login (AD-6).
- Dashboard online-only; Offline Mode Cashier-only (AD-7).
- Deferred list matching PRD non-goals (CRDT, KDS, card gateway, native shell contingency).
- Stack choices (NestJS, IndexedDB, Next PWA) — PRD-compatible; NestJS not required by PRD but valid binding.
