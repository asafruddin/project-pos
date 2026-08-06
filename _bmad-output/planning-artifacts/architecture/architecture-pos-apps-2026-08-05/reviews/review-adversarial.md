# Adversarial Review — Architecture Spine (POS Apps Phase 1)

**Reviewed:** `ARCHITECTURE-SPINE.md` (status: draft, 2026-08-06)  
**Lens:** Two units one level down that each obey every AD and Consistency Convention to the letter, yet ship incompatible shared-data shapes, dual owners of one entity, or conflicting state-mutation paths.  
**Method:** For each hole, Unit A and Unit B are both spine-legal. The pair is the defect; the fix is a new or tightened AD.

**Verdict:** Spine fails the one-level-down compatibility test. Paradigm and AD-1…AD-8 constrain *who may act* and *when Sync may fire*, but leave Sale/Stock payload shape, Sale state machine, Stock entity identity, dual Stock write entry points, and price snapshot authority unspecified — independent Cashier vs API (or SyncModule vs SalesModule) builds will diverge while remaining “compliant.”

---

## Attack pairs (holes)

### Hole 1 — Sync Sale document has no canonical shape

**Units:** `packages/local-db` + Cashier outbox (A) vs `apps/api` Sync accept (B)

| | Unit A (Cashier) | Unit B (API) |
| --- | --- | --- |
| Obeys | AD-3 UUID `sale_id`; conventions: ISO-8601, integer money, payload includes `sale_id`, `completed_at`, `device_id` | Same |
| Builds | `{ sale_id, completed_at, device_id, lines: [{ product_id, qty, unit_price_minor }], payment: { method: "cash", amount_minor }, total_minor }` | `{ sale_id, completed_at, device_id, items: [{ product_id, quantity, price }], tender: "cash", paid_minor }` |

**Clash:** Shared-data shape. “Complete Sale document + line items” names three required fields and nothing else — line key names, payment shape, totals, and required vs optional fields are free variables. Sync “idempotent on `sale_id`” still accepts or rejects the body inconsistently.

**Close with:** New **AD — Canonical Sync Sale DTO** (or tighten Consistency Conventions into a normative field list owned by `packages/types`): required keys, line-item schema, payment/tender fields, money field names (`*_minor`), and forbid alternate aliases.

---

### Hole 2 — Two Stock mutation paths without a single command

**Units:** `apps/api` online Sale create / SalesModule (A) vs SyncModule accept (B)

| | Unit A | Unit B |
| --- | --- | --- |
| Obeys | AD-4: only `apps/api` mutates server Stock; AD-2: only complete Sales; AD-5: rules “live in” `packages/domain` | Same |
| Builds | `SalesService.createOnline()` decrements `product.stock_qty` inline (maybe calling a one-line domain helper) | `SyncService.accept()` decrements via different domain helper / SQL — different allow-negative, missing-SKU, and partial-line policies |

**Clash:** Conflicting state-mutation paths. AD-4 names *who* (api) and *when* (accept complete Sale) but not *one* mutation command both entry points must call. Two owners of Stock *behavior* inside the only allowed owner.

**Close with:** Tighten **AD-4** (or new **AD — Single Stock mutation use-case**): exactly one domain function (e.g. `applySaleToStock(sale)`) is the only legal Stock write; online create and Sync must both invoke it; no module-local decrement.

---

### Hole 3 — PRODUCT.stock_qty is two entities wearing one name

**Units:** Cashier Local Database optimistic qty (A) vs server PostgreSQL `PRODUCT.stock_qty` / Dashboard (B)

| | Unit A | Unit B |
| --- | --- | --- |
| Obeys | AD-4: “Cashier may show optimistic local qty… not Dashboard truth”; AD-1 local-primary for Sales only | AD-4: only api mutates server Stock; Dashboard reads only |
| Builds | Mutates local `product.stock_qty` on every complete Sale; treats that column as UX ledger | Mutates server `product.stock_qty` on Sync; ER diagram’s sole Stock field |

**Clash:** Two owners of one conceptual entity. Spine ER puts `stock_qty` on `PRODUCT` while AD-4 Prevents text says “Stock ledger.” After Sync + catalog refresh, neither AD says whether local optimistic qty is overwritten, merged, or ignored — Cashier and Dashboard can disagree forever while both cite AD-4.

**Close with:** New **AD — Stock identity**: server Stock is a named server-side quantity (column or ledger table); local optimistic qty is a distinct field/type (e.g. `local_display_qty`) never written by Sync accept; catalog pull replaces local display from server; forbid sharing one `stock_qty` name across Local Database and Postgres as if identical.

---

### Hole 4 — Sale completeness / status machine is unbound

**Units:** Cashier Instant Checkout state machine (A) vs API accept gate (B)

| | Unit A | Unit B |
| --- | --- | --- |
| Obeys | AD-2: complete = payment recorded **and** Receipt success (print *or* on-screen confirm); AD-3: `sale_id` before complete; incomplete ∉ outbox | AD-2/AD-3: reject incomplete; idempotent on `sale_id` |
| Builds | Status enum `{ draft, awaiting_print, complete }` + `synced: bool`; “Receipt success” = print job *accepted* by OS | Status enum `{ open, paid, synced }`; treats payment-recorded as complete if payload has `receipt: { mode: "screen", confirmed: true }` with no shared definition of confirm |

**Clash:** Conflicting state-mutation paths into “complete.” ER lists `status` + `synced` with no allowed values. Print-accepted vs paper-out vs on-screen tap are all AD-2-legal, so Cashier marks complete and enqueues while API’s idea of complete (or a second Cashier build) disagrees — Sync and Stock fire on different predicates.

**Close with:** New **AD — Sale state machine**: canonical statuses and transitions (`incomplete` → `complete` → `synced` or equivalent); normative definition of Receipt success for architecture (what evidence the outbox and API accept); forbid conflating sync into `status` without a documented mapping.

---

### Hole 5 — Line price authority on Sync is undefined

**Units:** Cashier (embeds prices at complete) (A) vs API (re-resolves catalog on accept) (B)

| | Unit A | Unit B |
| --- | --- | --- |
| Obeys | AD-1 local authority for unsynced Sale; AD-3 Sync uploads complete Sale; conventions integer money | AD-4 Stock on accept; server SoR for catalog |
| Builds | Outbox line `unit_price_minor` = price at tap; totals frozen locally | On Sync, loads current `PRODUCT.price_minor`, recomputes totals / ignores client prices (catalog is server SoR) |

**Clash:** Shared-data semantic clash + dual ownership of Sale money. Both readings fit the spine: Sale is local-primary until ack, catalog is server SoR. Mid-shift Dashboard price edit then Sync → different receipts, Day Close totals, and Stock-value reports with zero AD violation.

**Close with:** New **AD — Sale line snapshot**: complete Sale lines carry immutable `unit_price_minor` (and name snapshot if needed); Sync accept must persist client snapshots for money fields; catalog changes never rewrite accepted Sale lines; Stock decrement keys off `product_id` + qty only.

---

### Hole 6 — Online Sale create client is unnamed (second writer of Sale)

**Units:** Cashier online path (A) vs Dashboard or ad-hoc API client (B)

| | Unit A | Unit B |
| --- | --- | --- |
| Obeys | AD-4: Stock mutates on “online create **or** Sync”; AD-7: Dashboard talks only to api | Same AD-4 clause; AD-7 does not forbid Dashboard posting Sales |
| Builds | Only Cashier creates Sales (local then Sync, or online POST) | Dashboard “sales list” grows a “record Sale” affordance, or Sync and a separate `POST /sales` both create server Sales |

**Clash:** Two owners of Sale creation on the server. AD-4’s “online create” invites a second mutation path without naming the sole client or forbidding Dashboard writes.

**Close with:** Tighten **AD-4** / new **AD — Sale write surfaces**: only Cashier may originate Sales; API exposes at most one accept path (Sync upsert by `sale_id`, online create = same handler); Dashboard is read-only for Sales in Phase 1.

---

### Hole 7 — `device_id` required but ownerless

**Units:** Cashier identity bootstrap (A) vs API analytics / idempotency helpers (B)

| | Unit A | Unit B |
| --- | --- | --- |
| Obeys | Convention: Sync payload includes `device_id` | Same |
| Builds | `device_id = user_id` after Account Login | `device_id = crypto.randomUUID()` per install, stable in Local Database |

**Clash:** Shared-data identity. Two cashiers on one Account, or reinstall, collide or fragment “device” meaning. No AD assigns generation, stability, or uniqueness scope.

**Close with:** New **AD — Device identity**: Cashier generates stable install-scoped UUID stored in Local Database; never equal to `user_id`; Sync and Day Close key off that rule.

---

### Hole 8 — Domain vs types ownership of Sale

**Units:** `packages/domain` (A) vs `packages/types` (B)

| | Unit A | Unit B |
| --- | --- | --- |
| Obeys | AD-5: `domain → types`; apps → packages; domain has Sale/Stock *rules* | AD-5 diagram; types hold “shared DTOs” |
| Builds | Canonical `Sale` + completeness predicates only in domain; types has thin wire DTOs that drift | Canonical Sync/API `Sale` only in types; domain re-implements structurally compatible but distinct types |

**Clash:** Shared-data shapes at package boundary. Dependency arrow alone does not name a single schema owner; TypeScript structural typing hides the break until Sync runtime.

**Close with:** Tighten **AD-5** / Consistency Conventions: `packages/types` owns wire + persistence Sale/Stock DTOs; `packages/domain` imports those types and exports pure functions only — no parallel entity interfaces.

---

### Hole 9 — Day Close vs Sale records mutation unspecified

**Units:** Day Close flow (A) vs Sync outbox (B)

| | Unit A | Unit B |
| --- | --- | --- |
| Obeys | AD-8: cannot finish with unsynced complete Sales unless acknowledged; unsynced remain for later Sync | AD-1/AD-3: local authority until Sync ack |
| Builds | Day Close sets `sale.day_id` / archives into “closed day” store, possibly separate from outbox | Outbox reads only `synced=false` from primary Sales store; ignores archive |

**Clash:** Conflicting state-mutation paths on the same Sales. AD-8 prevents silent drop but does not forbid Day Close reshaping storage so Sync no longer sees the rows.

**Close with:** Tighten **AD-8**: Day Close must not remove or relocate unsynced complete Sales from the Sync outbox source; any day annotation is additive metadata only.

---

## Findings (cynical backlog)

- Sync payload convention is a caption, not a contract — three field names, infinite Sale shapes.
- AD-4 allows two API entry points to mutate Stock without mandating one domain command.
- ER `PRODUCT.stock_qty` + “optimistic local qty” = one name, two ledgers, no reconciliation rule.
- Sale `status` appears in the ER with zero allowed values or transitions.
- “Receipt success (print or on-screen confirm)” is a product phrase, not an architectural predicate.
- Price snapshot vs live catalog re-price on Sync is unresolved between AD-1 and server catalog SoR.
- “Online create or Sync” invites a second Sale writer; Dashboard is not explicitly read-only for Sales.
- `device_id` is required in payloads and undefined as an entity.
- `packages/types` vs `packages/domain` both can claim the Sale type under AD-5.
- Day Close can legally rearrange local Sales storage and starve Sync while claiming AD-8 compliance.
- Idempotency is only on `sale_id` — no rule for same `sale_id` with different bodies (first-write-wins vs reject vs merge).
- Money “integer minor units” lacks currency code / single-currency Phase 1 pin.
- Auth convention says Bearer for API; Sync-while-token-expired vs queue-until-relogin is unspecified (retry vs poison).
- Catalog refresh vs in-flight cart prices ungoverned (related to Hole 5).
- Structural seed lists StockModule and Sales/SyncModule as siblings — organizes the dual-path footgun.

---

## Reviewer note

Minimum bar for this gate: if Cashier outbox and API Sync accept can disagree on Sale JSON, completeness, line prices, or Stock decrement policy while each cites an AD, the spine is not yet build-substrate. Highest leverage closes: **canonical Sync Sale DTO**, **single Stock mutation use-case**, **Stock identity (local display vs server)**, **Sale state machine + Receipt predicate**, **line price snapshot**.
