# Adversarial Review — Architecture Spine (POS Apps Phase 1 + Phase 2)

**Reviewed:** `ARCHITECTURE-SPINE.md` (status: draft, updated 2026-08-13)  
**Lens:** Two units one level down (apps, Nest modules, or packages) that each obey every AD and Consistency Convention *to the letter*, yet ship incompatible shared-data shapes, dual owners of one entity, or conflicting state-mutation paths.  
**Method:** For each hole, Unit A and Unit B are both spine-legal. The pair is the defect. The fix is a new or tightened AD — not a comment, not a mermaid caption, not “owned in `packages/types`” without a field list.

**Verdict:** Fail. Phase 1 sale-write holes (direct API create, live re-price, catalog pull vs CDN Menu) are closed. Phase 2 opened a larger surface — Stock Ledger posters, mixed outbox events, Void/Return, Customer, Loyalty, in-transit qty, Day Close vs Shift cash — and the spine named *who may talk* without naming *the command, the DTO, or the owner*. Independent Inventory vs Sales vs Purchasing vs Cashier builds will diverge while citing AD-4, AD-13, AD-14, and AD-15.

Closed since the 2026-08-06 Phase 1 attack (do not re-open): AD-1 forbids create-Sale-on-API; AD-4 names `AcceptCompleteSale` + `AdjustStock`; AD-9 Menu reads Local Database including media cache; AD-10 line `price_minor` snapshot; AD-2 status enum `incomplete` | `complete`; Sync Sale *caption* now includes `store_id` / `register_id` / `shift_id?`. Those closes are real. They are not enough.

---

## Attack pairs (holes)

### Hole 1 — N Stock posters, two named commands `[critical]`

**Units:** `Sales.AcceptCompleteSale` (A) vs `Purchasing` Goods Receipt / `Inventory` Opname / Transfer / `Sales` Void·Return (B)

| | Unit A | Unit B |
| --- | --- | --- |
| Obeys | AD-4: only `apps/api` mutates server qty; complete Sale → `AcceptCompleteSale` posts STOCK OUT; Dashboard `AdjustStock` never used by Sync. AD-13: qty is sum of movements. AD-15: modules independent; cross-module via commands/DTOs. | Same. Capability map *requires* GR, Opname, Transfer, Void, Return to change qty. AD-4 does not forbid additional commands. |
| Builds | `postStockOut(sale_id)` with `qty_delta: -n`, `source_type: "sale"`, `reason: "STOCK OUT"`. Idempotent on `(source_type, source_id, product_id)`. | GR calls `AdjustStock` (the only other named command) with a signed delta *or* writes `stock_movements` from Purchasing with `qty_delta: +n`, `reason: "received"`, `source_type: "po"`. Opname posts a variance row with a different `reason` vocabulary. Void posts STOCK IN by inserting a second movement *or* by calling `AdjustStock`. |

**Clash:** Conflicting state-mutation paths; two (then six) owners of Stock Movement *behavior* inside the only allowed owner (`apps/api`). AD-4 Prevents already claims “two API code paths mutating quantity with different rules” — the Rule only binds Sale accept and Dashboard adjust. Memlog is stricter (`AcceptCompleteSale` / `AdjustStock` / `GoodsReceipt` / `Return` post movements); the spine dropped the extra commands. `qty_delta` sign, `source_type` enum, and “post once per source document” are free variables. Double-count (FR-48) is a product fail with no architectural single writer.

**Close with:** Tighten **AD-4** (or new **AD — Single ledger post**): exactly one domain command `PostStockMovement` (or a closed set: `AcceptCompleteSale`, `AdjustStock`, `PostGoodsReceipt`, `PostOpnameVariance`, `PostTransferShip`, `PostTransferReceive`, `AcceptVoid`, `AcceptReturn`) is legal; every poster goes through `packages/domain`; `source_type` + `source_id` + `product_id` (+ `store_id`) is the idempotency key; `qty_delta` sign convention (negative = leave sellable); modules must not INSERT `stock_movements` locally.

---

### Hole 2 — Phase 2 outbox has no envelope; AD-3 is `sale_id` only `[critical]`

**Units:** `packages/local-db` outbox (A) vs `apps/api` Sync ingest (B)

| | Unit A | Unit B |
| --- | --- | --- |
| Obeys | AD-14: Shift open/close, Cash In/Out, same-day Void, queued Customer creates use the **same** local-first outbox pattern as Sales (AD-1, AD-3). AD-3: POST idempotent on `sale_id` (upsert). | Same. Convention Sync DTO is a **Sale** document only. |
| Builds | One IndexedDB store `outbox`; Shift close is upserted as `{ sale_id: shift_id, …shift fields stuffed into payment/lines }`. FIFO by `completed_at`. | Generic `{ event_id, type, payload }` POST `/sync` with types `sale` \| `shift` \| `void` \| `cash_movement` \| `customer`. Idempotent on `event_id`. Separate endpoints `/sync/sales`, `/shifts`, `/voids`. |

**Clash:** Shared-data shape + conflicting mutation paths. “Same pattern as AD-3” applied to the letter either **abuses `sale_id`** for non-sales or **invents a new envelope** the convention does not list. Ordering of mixed events is unbound: a Sale with `customer_id` can ack before the queued Customer create; a Void can ack before its Sale. Rejected non-Sale events have no rule (AD-3 only says rejected Sync does not delete the local **complete Sale**).

**Close with:** New **AD — Durable outbox envelope**: canonical `{ event_id, type, payload, device_id, store_id, register_id, created_at }` in `packages/types`; `type` enum closed; idempotency per type (`sale_id` / `shift_id` / `void_id` / `customer_id` / `cash_event_id`); FIFO per Register with documented exceptions (Customer before Sale that references it; Sale before Void of that Sale); reject does not delete the local durable event.

---

### Hole 3 — Three legal reversals of one Sale `[critical]`

**Units:** Cashier same-day Void (A) vs online Return / Refund (B)

| | Unit A | Unit B |
| --- | --- | --- |
| Obeys | AD-14: Void is local-first outbox. AD-2: only `complete` Sales existed to void. AD-4: only api mutates server qty — Void is not named, so A posts STOCK IN via a new accept *or* skips ledger until Sync of a “negative sale.” | AD-14: Return lookup is **online-first**. AD-11/AD-17: Refund is catalog_admin / Permission, cashier token cannot call Refund. AD-4: non-Sync qty change = `AdjustStock`. |
| Builds | Unsynced complete Sale: delete/cancel local row and drop from outbox (server never saw STOCK OUT). Synced Sale: outbox `{ type: "void", sale_id }` → API inserts STOCK IN, sets `sale.status` still `complete` (enum has no `voided`). | Return creates a new document, calls `AdjustStock` for returned qty (Dashboard-shaped), leaves original Sale complete. Exchange mutates the same Sale’s lines (no new complete Sale, no second Receipt). Refund is Dashboard-only; Cashier Return is lookup + wait. |

**Clash:** Two owners of “this Sale no longer represents sellable-out qty.” Conflicting paths: (1) never-sync the original, (2) sync then reverse movement, (3) `AdjustStock` beside the Sale, (4) rewrite the Sale document. AD-2 forbids a third status. Convention Sync DTO has no void/return payload. Race: Void of in-flight Sale vs `AcceptCompleteSale` — both AD-legal; FR-48 double-count is the product symptom.

**Close with:** New **AD — Sale reversal**: Void vs Return vs Refund vs Exchange are distinct commands; unsynced Void retracts the outbox Sale (never STOCK OUT); synced Void is `AcceptVoid(sale_id)` which posts STOCK IN keyed to the original `sale_id` and marks the Sale `voided` (extend AD-2 enum **or** a sibling `voided_at` that Sync/Stock/Shift must honor); Return never uses `AdjustStock`; Exchange is a new complete Sale + Return, not an in-place line edit; API rejects Void if `AcceptCompleteSale` has not acked, or accepts both in documented order — pick one.

---

### Hole 4 — Sync Sale DTO is still a caption; Phase 2 money/identity fields are free `[high]`

**Units:** Cashier complete-Sale serializer (A) vs `AcceptCompleteSale` (B)

| | Unit A | Unit B |
| --- | --- | --- |
| Obeys | Convention: `{ sale_id, device_id, store_id, register_id, shift_id?, completed_at, payment, lines: [{ product_id, qty, price_minor }] }` owned in `packages/types`. AD-10: do not re-price. AD-16: `shift_id` required after 2C. AD-18: decorations fail open. | Same caption. `payment` is an untyped name. Lines have no variant, promo, customer, tax, or receipt evidence. |
| Builds | `payment: { method: "cash", amount_minor }` (brownfield seed). Lines are parent `product_id`. `customer_id` / `promotion_id` / `tenders[]` omitted (not in the caption). Receipt success is local-only; payload has no receipt field. Totals derived from lines. | `payment: [{ method, amount_minor }, …]` for FR-110 split tender. Lines keyed by `variant_id` with `product_id` as group. Requires `receipt: { channel: "print"\|"screen", confirmed_at }` to enforce AD-2. Recomputes loyalty earn (AD-10 forbids re-**price**, not re-earn). Rejects missing `shift_id` even in Phase 1. |

**Clash:** Shared-data shape. Two compliant serializers cannot round-trip. AD-2’s Receipt conjunct is unenforceable on the server because evidence is not in the DTO — Unit B must either trust `completed_at` (hollowing AD-2) or invent a field Unit A never sends. Variants (capability map / FR-37) vs `product_id`-only lines = two owners of the sellable SKU. `shift_id?` vs AD-16 is an unversioned breaking change.

**Close with:** Tighten **Consistency Conventions + AD-3/AD-10/AD-16**: normative Sync Sale (and a version field or wave-gated required keys); `payment` / split-tender array; `customer_id?`; line `variant_id` or “`product_id` is the SKU”; receipt evidence required for accept; `shift_id` absent until 2C, required after; snapshot fields beyond `price_minor` (list price, promo id, loyalty earn) if Dashboard/Reports will ever attribute them; forbid aliases (`items`, `unit_price_minor`, `tender`).

---

### Hole 5 — Customer is two writers; Loyalty balance is two clocks `[high]`

**Units:** Cashier queued Customer + Instant Checkout (A) vs Dashboard Customers + online Loyalty redeem (B)

| | Unit A | Unit B |
| --- | --- | --- |
| Obeys | AD-14: queued Customer creates are local-first outbox. AD-18: Customer-price / Loyalty **eval** once in `packages/domain`; fail open. Sale may attach a local `customer_id` before Sync. | AD-7: Dashboard talks only to api. Server is authoritative for synced documents (paradigm). AD-14: Loyalty **redeem** is online-first and must not block Instant Checkout. |
| Builds | Customer `{ customer_id, name, phone }` minted on device; Sale carries that UUID. Loyalty **earn** snapshotted on complete; redeem skipped if offline (fail open / skip). | Customer `{ id, display_name, mobile, email }` created on API; natural key = phone. Earn recomputed on `AcceptCompleteSale` from current rules. Redeem debits a server points ledger immediately. No Customer row in the spine ER beyond `CUSTOMER ||--o{ SALE`; no Loyalty entity at all. |

**Clash:** Two owners of Customer identity (device UUID vs phone upsert) and two mutation paths for the same points balance (earn-on-Sale-sync vs redeem-live). A queued create racing a Dashboard create for the same phone yields two Customers or a silent merge — neither AD exists. Dangling `customer_id` on a Sale if Customer Sync rejects (Hole 2). Eval-once (AD-18) does not own **balance writes**.

**Close with:** New **AD — Customer identity + Loyalty ledger**: Customer UUID minted by the originating surface, upsert key (phone) specified, Dashboard vs queued-create merge rule; Loyalty earn/redeem are ledger posts (not eval); redeem remains online-first; earn posts once in `AcceptCompleteSale` from **snapshotted** earn (or from domain eval of snapshots — pick one); fail-open never invents a second balance.

---

### Hole 6 — Completeness lives in domain; outbox cannot import domain `[high]`

**Units:** `packages/local-db` (A) vs `packages/domain` + `apps/api` (B)

| | Unit A | Unit B |
| --- | --- | --- |
| Obeys | AD-5 mermaid: `localdb → types` only — **must not** import domain. AD-2: only `complete` Sales enter the outbox. | AD-5: Sale rules live in `packages/domain`. AD-2: complete = payment recorded **and** Receipt success. |
| Builds | `enqueue(sale)` if `sale.status === "complete"` (dumb store). Trusts the UI. | `assertComplete(sale)` requires payment + receipt evidence. API `AcceptCompleteSale` re-checks; without receipt in the DTO (Hole 4) it checks `status` or `completed_at` only. |

**Clash:** Two owners of the completeness gate. The package that **holds** the outbox is forbidden from **running** the rule. Cashier orchestration might call domain — that is convention, not an AD. A second Cashier feature (hold → complete, Void, Shift-gated checkout) can write `status: complete` straight into local-db. Server cannot reconstruct Receipt success.

**Close with:** Tighten **AD-2 + AD-5**: Cashier **must** call `packages/domain` `completeSale` (or equivalent) before outbox insert; local-db offers no `enqueue` that accepts a raw status flag; API rejects payloads that lack the same receipt+payment evidence the domain predicate requires (ties to Hole 4).

---

### Hole 7 — In-transit qty has a rule and no shape `[high]`

**Units:** Inventory Transfer ship (A) vs sellable-qty projection / Cashier catalog pull (B)

| | Unit A | Unit B |
| --- | --- | --- |
| Obeys | AD-13: between Shipped and Received, qty is **in-transit** (not sellable at A or B). Movement convention: `{ movement_id, product_id, store_id, qty_delta, reason, source_type, source_id, actor_id, at }` — no bucket, no `location_type`. | AD-13: sellable qty **is** the sum of movements per product (and Store). AD-9: Cashier pulls catalog (including qty UX). |
| Builds | Ship: `qty_delta: -5` at Store A, nothing at B until Receive `+5`. Sum at A dropped; sum at B unchanged; in-transit is implied by open Transfer docs. | Ship: `-5` at A **and** `+5` at `store_id: IN_TRANSIT` virtual store, or a `reason: "in_transit"` row that **is** included in a naive SUM. Cashier optimistic qty uses the same SUM the Dashboard Stock Overview uses — or the `stock_qty` projection. |

**Clash:** Shared-data shape. The same AD-13 sentence yields two sellable numbers. Convention SUM over `qty_delta` **cannot** express “not at A or B” without a filter the spine does not name. Transfer UI can ship “later” (AD-13 allows event types in 2A) while 2D implementers invent a third schema.

**Close with:** Tighten **AD-13** + movement DTO: sellable qty = SUM of movements **excluding** in-transit (or including only `location = sellable`); in-transit is a first-class `location` / `bucket` on the movement (or a pair: OUT at origin + IN-TRANSIT row not counted as sellable); projection `stock_qty` is updated in the **same transaction** as the movement (closes projection-vs-sum drift).

---

### Hole 8 — Day Close vs Shift: two cash documents, one “display” `[high]`

**Units:** Cashier Day Close (A) vs API Shift accept / Dashboard reports (B)

| | Unit A | Unit B |
| --- | --- | --- |
| Obeys | AD-8: Day Close cannot finish while unsynced complete Sales remain (unless acknowledged) or while a Shift is open; cash summary **displays** closed Shift Expected Cash / counted — does not invent a second formula. Capability map: Day Close lives in **cashier**. AD-14 outbox list does **not** include Day Close. | AD-16: one open Shift per Register; `AcceptCompleteSale` requires `shift_id` after 2C. AD-14: Shift is local-first then Sync. Reports module (AD-15) reads server. |
| Builds | Day Close snapshot stored only in IndexedDB: `{ expected_cash_minor, counted_minor, acknowledged_unsynced: true }` copied from **local** Shift (includes unsynced Sales). After acknowledge, unsynced Sales remain but Day Close is “finished.” | Server Shift Expected Cash = SUM of **accepted** Sales + Cash In/Out for `shift_id`. No `day_close` table. Dashboard “daily cash” uses Shift rows, or invents a Day Close API because FR-23 still exists. |

**Clash:** Two owners of the cash number the shop will argue over. AD-8 forbids a second *formula* but not a second *document* or a second *dataset* (local including unsynced vs server excluding them). Day Close can finish (after acknowledge) while Shift-on-server will never match that snapshot. Day Close has no Sync owner, so Dashboard and Cashier cannot share it without inventing a path.

**Close with:** Tighten **AD-8**: whose Expected Cash is canonical (closed Shift on server after outbox drain, or frozen local snapshot); Day Close is either a synced document with an idempotency key **or** explicitly device-local and out of Reports; acknowledge-unsynced must label the snapshot `includes_unsynced: true` and Reports must not mix it with accepted Shift totals.

---

### Hole 9 — `device_id` / Register / session: three names, one stub `[medium]`

**Units:** Cashier identity bootstrap (A) vs Stores/Shift (B)

| | Unit A | Unit B |
| --- | --- | --- |
| Obeys | IDs: UUID v4 for `device_id`, `register_id`, `store_id`. AD-19: Phase 1 data **is** Store #1 + one Register; session bound to one Register; rows carry both ids once the stub exists. | AD-16: one open Shift per Register. Sync DTO includes both `device_id` and `register_id`. |
| Builds | `device_id = register_id =` install UUID. Second tablet is a second Register (two open Shifts legal). | `device_id` is install-scoped; `register_id` is a server entity the cashier picks at login. Two devices on one Register — AD-16 “one open Shift per Register” collides. `device_id = user_id`. |

**Clash:** Shared-data identity. No AD assigns who mints `register_id`, whether a device **is** a Register, or uniqueness scope of `device_id`. Multi-tablet coffee shop (in scope for a second cashier device even before 2D) forks here.

**Close with:** New **AD — Device vs Register**: `device_id` = stable install UUID in Local Database, never `user_id`; `register_id` minted by server (stub = Register #1); session binds one device to one Register; one open Shift per Register **forbids** a second device opening another Shift on that Register (or forbids two devices per Register in Phase 1 — pick).

---

### Hole 10 — Catalog media cache: `bytes` OR `already-fetched` `[medium]`

**Units:** Cashier catalog pull (A) vs API Catalog + MediaService (B)

| | Unit A | Unit B |
| --- | --- | --- |
| Obeys | AD-9: pull includes **durable Product Media cache (bytes or already-fetched cache entries)**; Menu always reads Local Database; after refresh, no live Media Provider. AD-12: POS DB stores **references** (`public_id`, `secure_url`, metadata). | AD-12: only MediaService talks to Cloudinary; Catalog must not import the SDK. AD-15: no reaching into another module’s tables. |
| Builds | Pull JSON + blob store of image bytes keyed by `product_id`. Local product row has no URL. | Pull is references only; “durable cache” = Cache API of `secure_url`. `PRODUCT_IMAGE` owned by Media vs image columns on `PRODUCT` owned by Catalog. Delete on server leaves local bytes/Cache API entries until a merge strategy that does not exist. |

**Clash:** Shared-data shape (bytes vs URL cache) **and** two owners of `PRODUCT_IMAGE`. AD-9’s “or” is an explicit fork. Airplane-mode Menu can still be placeholders if Unit B never populated the Cache API. AD-12 “POS DB” is ambiguous (Postgres vs IndexedDB).

**Close with:** Tighten **AD-9 + AD-12**: catalog pull DTO includes references; Cashier **must** persist image **bytes** (or a named Cache API contract with a test: airplane mode after one online refresh shows images); Media module owns `PRODUCT_IMAGE`; Catalog reads via DTO; pull replaces/deletes local cache entries for removed images.

---

### Hole 11 — Idempotent upsert vs second STOCK OUT `[medium]`

**Units:** Sync retry (A) vs `AcceptCompleteSale` ledger post (B)

| | Unit A | Unit B |
| --- | --- | --- |
| Obeys | AD-3: idempotent on `sale_id` (**upsert**, not insert-again). Same body or different body unspecified. | AD-4: `AcceptCompleteSale` posts STOCK OUT. AD-13: every change has a source document. |
| Builds | Second POST with same `sale_id` replaces the Sale row (cashier “fixed” a complete Sale — AD-2 does not say immutable). | Every accept posts a movement. Upsert that replaces lines posts a second STOCK OUT (or posts a reversing pair). Other build: first-write-wins, ignore body, no second movement. |

**Clash:** Conflicting mutation on the same `sale_id`. “Upsert” and “post STOCK OUT” together do not imply “post once.” Complete Sale mutability is unbound.

**Close with:** Tighten **AD-3 + AD-2 + AD-4**: complete Sale document is immutable; Sync of an existing `sale_id` returns ack without rewriting lines or posting stock; different body → `409` (or first-write-wins — pick); ledger idempotency key `(source_type=sale, source_id=sale_id)`.

---

### Hole 12 — Price composition inside the one eval `[medium]`

**Units:** Cashier Instant Checkout calling `packages/domain` (A) vs Dashboard promo simulator / Reports (B)

| | Unit A | Unit B |
| --- | --- | --- |
| Obeys | AD-18: eval lives **once** in domain; fail open to last-cached catalog / Store / list price. AD-10: snapshot `price_minor` after any Customer/Store/Promotion evaluation. | Same functions, different **inputs**: live catalog vs last-cached; Store overlay vs list already baked into `product.price_minor` (AD-9 pull shape unbound). |
| Builds | Precedence: Customer price replaces list, then promo % off, fail-open skips expired cached promo. Cached `product.price_minor` is already Store price. | Precedence: promo on list, Customer is min(); Store overlay applied in Catalog pull so domain never sees `store_price`. Simulator uses live rules → disagrees with Receipt snapshots. |

**Clash:** Shared-data semantics of `price_minor` on the cached product **and** unbound composition. One package does not help if the function contract (inputs, precedence, what fail-open returns) is not an AD. Two callers pass different snapshots and both cite AD-18.

**Close with:** Tighten **AD-18**: domain eval signature and precedence (list → Store → Customer → Promotion — or whatever is chosen); catalog pull stores **list** and **store** as distinct fields; fail-open output is list/Store price with `eval_status: skipped`; Dashboard simulator must consume the **same snapshot fields** as Sync, not live re-eval of historical Sales.

---

### Hole 13 — Hold/park vs Sale state `[medium]`

**Units:** Instant Checkout hold (A) vs Shift close / Day Close (B)

| | Unit A | Unit B |
| --- | --- | --- |
| Obeys | AD-2: Sale status `incomplete` \| `complete` only. Incomplete ∉ outbox, no server Stock. Hold is not named. | AD-8: Day Close cares about unsynced **complete** Sales. AD-16: Checkout disabled without open Shift; silent on parks. |
| Builds | Hold = `status: incomplete` Sale in the Sales store (parked cart is a Sale). Shift close leaves it for the next Shift on this Register. | Hold = a `cart` entity, not a Sale. Shift close discards carts. Day Close ignores them. Second device on the same Register cannot see the park (Hole 9). |

**Clash:** Two owners of in-progress work. Expected Cash (Shift) and Day Close will include or omit held tenders depending on whether a hold is a Sale. AD-2’s two-status machine is not enough once hold exists in the capability map’s Void/Return/Refund row (FR-62).

**Close with:** New **AD — Hold is not a Sale** (or it is, with transitions): parked cart identity, Register scope, Shift-close / Day Close behavior (block, warn, survive, discard); incomplete Sale used only for in-progress checkout, not overnight parks.

---

### Hole 14 — JWT role vs Permissions cutover; Refund surface `[medium]`

**Units:** Identity `RolesGuard` (A) vs Dashboard / Cashier token use (B)

| | Unit A | Unit B |
| --- | --- | --- |
| Obeys | AD-11: until 2D, `cashier` \| `catalog_admin`; 2D replaces with resource × action on JWT. AD-17: API enforces; cashier tokens cannot call Refund. `catalog_admin` → Admin **or** Store Manager (FR-103). | AD-6: POS PIN does not grant extra Permissions. AD-7: ops screens not on Instant Checkout. |
| Builds | Until 2D, JWT `{ role }`. At 2D, JWT `{ permissions[] }` only — Dashboard still checks `role === "catalog_admin"`. Refund allowed for `catalog_admin` token even if the request originates from the Cashier app. | Dual-read JWT. Refund only from Dashboard origin. Manager Account Login on Cashier + POS PIN can/cannot Refund. Supervisor (PRD FR-99) does not exist in AD-11’s two-role set — Identity invents a third role or overloads `catalog_admin`. |

**Clash:** Conflicting authorization paths across 2D cutover and across surfaces. AD-11’s “or” mapping plus a two-role floor vs PRD’s larger seed set lets Identity and Dashboard pick incompatible principals for the same approve actions (PO, Opname, Refund, price).

**Close with:** Tighten **AD-11 + AD-17**: cutover dual-read window; Refund/approve allowed surfaces (Dashboard-only vs manager-on-Cashier); map `catalog_admin` to **one** principal until 2D; extra seeded roles are Permissions on that principal or they wait for 2D — pick.

---

### Hole 15 — Opening movement and “tracked product” `[medium]`

**Units:** 2A cutover job (A) vs Inventory sellable SUM (B)

| | Unit A | Unit B |
| --- | --- | --- |
| Obeys | AD-4: cutover posts **one opening** Stock Movement per **tracked** product from Phase 1 qty. AD-19: Phase 1 data is Store #1. | AD-13: sellable = SUM per product **and Store**. Untracked / non-stock products unnamed. |
| Builds | `qty_delta = products.stock_qty`, `store_id = Store #1`, skip `stock_qty == 0`, leave column as-is. Services/recipes skipped. | Opening per Store after stub; zero-qty still posted; `stock_qty` zeroed and replaced by projection; untracked products get unconstrained NULL sellable (oversell allowed) vs SUM 0 (cannot sell). |

**Clash:** Shared-data + mutation-path fork on the one-time cutover that AD-4 itself says must happen. “Tracked” is undefined. Wrong opening cannot be distinguished from later theft.

**Close with:** Tighten **AD-4 cutover**: tracked = products that decrement on Sale (named flag); exactly one opening row per `(product_id, store_id)` with `source_type: opening`; Store #1; zero-qty posted or skipped (pick); `stock_qty` becomes projection in the same migration; untracked products are excluded from SUM and from `AcceptCompleteSale` STOCK OUT.

---

## Findings (cynical backlog)

- AD-4 Prevents “two API paths” while the capability map demands six posters and the Rule names two — the Prevents clause is already false.
- Memlog AD-13 lists GoodsReceipt/Return posters; the spine distilled them away. Distill drift is how feature teams “comply” with different documents.
- AD-14 “same outbox pattern as AD-3” is a slogan: AD-3 is a Sale upsert. Shift/Void/Customer have no DTO, no key, no reject rule, no order.
- Sale status machine still has two values in a world with Void, Return, Exchange, and Hold.
- Receipt success is a product phrase; Sync DTO still cannot prove it (Phase 1 Hole 4, unfixed).
- `payment` is a blob while FR-110 split tender is in scope.
- `product_id` on lines and movements is not declared to be the SKU; Variants will fork Stock.
- Customer UUID vs phone upsert; Loyalty eval without a points ledger; earn vs redeem clocks.
- `local-db` cannot import `domain`, so completeness is an honor system at the outbox.
- In-transit is English on AD-13, not a filter on SUM(`qty_delta`).
- Day Close is cashier-only and not in the outbox; Shift cash is server-side; AD-8 “display” does not pick a document.
- `device_id` remains required and ownerless; Register vs device is a stub with two IDs.
- AD-9 “bytes or already-fetched” is an OR where Offline Mode needs a NAND.
- Upsert + STOCK OUT does not imply post-once; complete Sales are not immutable.
- Promo/Store/Customer price composition and catalog-pull price shape are unbound inside the “one eval.”
- JWT `role` vs `permissions` cutover and catalog_admin **or** Store Manager are still an or-gate.
- Opening-balance “tracked product” is undefined; projection vs SUM same-transaction is undefined.
- Same `sale_id` different bodies: first-write / last-write / 409 all AD-3-legal.
- Actor on movements (`actor_id`) vs sync service vs Account Login user — unnamed.
- Reports reaching sellable qty via projection vs live SUM — two Dashboard numbers, both AD-13-legal until the projection rule exists.
- Currency still “integer minor units” with no code; brownfield types comment “rupiah” — spine does not pin it.
- Token expiry vs outbox drain (retry vs poison vs re-login) still unspecified; PIN unlock continues.

---

## Reviewer note

Minimum bar: if Inventory and Sales can both INSERT `stock_movements` with different `qty_delta` signs while citing AD-4; if Cashier and API can invent different outbox envelopes while citing AD-14; if Void and Return can reverse the same Sale by different commands while citing AD-2’s two statuses — the spine is not a build-substrate for Phase 2.

Highest-leverage closes: **(1) closed ledger-post command set + movement idempotency + sign/bucket**, **(2) outbox event envelope + per-type keys + ordering**, **(3) Sale reversal + status/voided**, **(4) normative Phase-2 Sync Sale DTO including receipt, tender, SKU/variant, shift_id wave**, **(5) Customer identity + Loyalty ledger writes**. Then completeness-must-call-domain, in-transit filter, Day Close document owner, device vs Register.
