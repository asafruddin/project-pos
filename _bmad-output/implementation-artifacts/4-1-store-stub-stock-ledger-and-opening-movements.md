---
baseline_commit: 63dcb8c4f2c623ef6b1dad569ec32d03221577ba
---

# Story 4.1: Store stub, Stock Ledger, and opening movements

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a catalog_admin,
I want Phase 1 `stock_qty` to become a projection of a Stock Ledger with a Store #1 stub,
so that every later purchase, sale, and opname posts an auditable movement instead of a free-typed qty.

## Acceptance Criteria

1. **Given** existing Phase 1 products with `stock_qty`  
   **When** 2A migrations run  
   **Then** a `stores` row **Store #1** and one **Register** exist (AD-19 / FR-104)

2. **And** a `stock_movements` table exists with `bucket` `sellable` | `damaged` | `in_transit` (AD-13)

3. **And** each tracked product gets one **opening** Stock Movement equal to current `stock_qty` (`reason` = `opening_balance`, `bucket` = `sellable`, `store_id` = Store #1, `source_type` = `cutover`)

4. **And** `AdjustStock` **posts a movement** (reason required); it does not treat `UPDATE products.stock_qty` as the source of truth (AD-4 / FR-45 / FR-46)

5. **And** `AcceptCompleteSale` posts STOCK OUT `sellable` via the same ledger; Instant Checkout / Sync **never hard-blocks** on qty — negative sellable is allowed (FR-50 / AD-4). Lift Phase 1 `products_stock_qty_nonneg` CHECK.

6. **And** Dashboard Stock display is the **ledger projection** (sum of `sellable` `qty_delta` for that product at Store #1), not a disconnected typed field (FR-44)

7. **And** unsynced complete Sales remain cashier-real (AD-3) — this story must not make Dashboard treat missing server rows as “sale didn’t happen”

8. **And** Epic 2 sell/sync tests still pass after updating domain rules (SM-2). Do **not** keep `SALE_INSUFFICIENT_STOCK` as a Sync reject.

## Tasks / Subtasks

- [x] Task 1: Schema + migration (AC: #1–#3, #5)
  - [x] Add `stores` and `registers` to `apps/api/src/db/schema.ts` (Drizzle 0.45.1; generate via `pnpm --filter api db:generate` → `apps/api/drizzle/0005_*.sql`)
  - [x] Seed **fixed UUIDs** in the migration (idempotent `INSERT … ON CONFLICT DO NOTHING`):
    - Store #1 `00000000-0000-4000-8000-000000000001`, name `Store #1`
    - Register `00000000-0000-4000-8000-000000000002`, `store_id` = Store #1, name `Register 1`
  - [x] Add `stock_movements` as specified in Dev Notes → Data model
  - [x] `ALTER TABLE products DROP CONSTRAINT products_stock_qty_nonneg`
  - [x] Backfill: one opening movement per existing product (`qty_delta` = current `stock_qty`). Skip products that already have a `cutover`/`opening_balance` row (re-run safe)
  - [x] Keep `products.stock_qty` as a **cached projection** updated in the same transaction as movements — **do not drop the column**
  - [x] Update schema comment on `products` (today it still says “Stock lives on the product row”)

- [x] Task 2: Domain — ledger posting helpers (AC: #4–#5, #8)
  - [x] Add pure `postStockMovement` (name may vary) in `packages/domain/src/index.ts`: validate integer `qty_delta`, non-empty trimmed `reason`, `bucket` ∈ {sellable, damaged, in_transit}. **No** Nest / Drizzle / HTTP / Cloudinary (AD-5)
  - [x] Change `acceptCompleteSale`:
    - Keep fail-closed: empty lines, non-integer/`qty <= 0`, unknown `product_id`
    - **Remove** hard fail when `stock_qty < qty`. Return `{ ok: true, products, warned?: true }` with possibly **negative** `stock_qty`
    - Stop returning `SALE_INSUFFICIENT_STOCK` (delete the union member)
  - [x] Change `adjustStock` to `{ currentQty, targetQty, reason }` (or equivalent):
    - Reject empty/whitespace reason → `CATALOG_INVALID_STOCK` (or `CATALOG_STOCK_REASON_REQUIRED`)
    - Reject non-integer target
    - AdjustStock **target may not be negative** (manual set-below-zero is still invalid). Sales path is the only negative writer this story
    - Return `{ ok: true, stock_qty, qty_delta, reason }` where `qty_delta = targetQty - currentQty`. If delta is 0, callers skip INSERT
  - [x] Unit tests: opening-style delta; sale that would go negative still `ok: true` + `warned`; AdjustStock without reason fails; AdjustStock target `-1` still fails; invalid sale lines still fail

- [x] Task 3: Types (AC: #2, #4)
  - [x] Export in `packages/types/src/index.ts`:
    - `StockBucket = "sellable" | "damaged" | "in_transit"`
    - `StockMovement = { movement_id, product_id, store_id, qty_delta, bucket, reason, source_type, source_id, actor_id, at }`
    - `AdjustStockRequest = { stock_qty: number; reason: string }` (**breaking** — add `reason`)
  - [x] Do **not** require Cashier `SyncSaleRequest` to send `store_id`; API defaults to Store #1 (AD-19)
  - [x] No Nest/Drizzle imports in types (AD-5)

- [x] Task 4: API — Catalog + Sales post via commands (AC: #4–#7)
  - [x] `AdjustStockDto`: keep `@Min(0)` on `stock_qty`; add `@IsString() @IsNotEmpty()` `reason`
  - [x] `CatalogService.setStock(productId, { stock_qty, reason }, actorId?)`: one transaction — lock product row → domain `adjustStock` → INSERT movement (`source_type` = `adjust`, `bucket` = `sellable`, `store_id` = Store #1) → set `products.stock_qty` = new projection
  - [x] `CatalogService.create`: after insert, post `source_type` = `adjust` (or `opening_balance`) movement for initial `stock_qty` with reason `initial_stock` (no extra user field on create)
  - [x] `SalesService.acceptSync`: on **new** sale, for each line INSERT STOCK OUT (`qty_delta` = `-line.qty`, `bucket` = `sellable`, `source_type` = `sale`, `source_id` = `sale_id`, `store_id` = Store #1) then refresh projection from domain result. **Do not** throw `ConflictException` on insufficient stock
  - [x] Idempotent: `already_accepted` path must **not** insert a second movement (existing sale_id short-circuit stays first)
  - [x] `GET /catalog/products` still returns `stock_qty` as the cached projection (Dashboard list keeps working)
  - [x] Roles unchanged: `@Roles("catalog_admin")` on create/update/setStock; cashier 403 (Story 1.4). Cashier **can** still `POST /sales/sync`
  - [x] Errors remain `{ code, message }` via existing filter
  - [x] Do **not** add `apps/api/src/inventory/` this story — Catalog + Sales may INSERT movements **only** by calling domain helpers (AD-4 named commands). Do not invent a third writer. `ReceiveGoods` / `PostVoid` / `PostReturn` / `ApplyOpname` / transfers are later stories
  - [x] `seed.ts`: if inserting demo products on empty DB, also insert Store #1 (if missing) + opening/initial movements so projection matches

- [x] Task 5: Dashboard UX (AC: #4, #6)
  - [x] Edit-stock path: `PUT /catalog/products/:id/stock` body must include **Alasan** (`reason`). Empty → client-side error before request; API also 400
  - [x] Indonesian-first: label **Alasan**, helper “Wajib saat mengubah stok.” List/detail still show **Stok** `{product.stock_qty}` (projection)
  - [x] Create product: no Alasan field (server uses `initial_stock`)
  - [x] If edit save does not change qty, still send reason **or** skip the PUT `/stock` call when qty unchanged (prefer skip — avoids empty-reason 400)
  - [x] shadcn Input/Button; ID-primary (UX-DR2). Do **not** build Opname, Damaged Stock UI, Cloudinary, purchasing, or a Store picker
  - [x] Do **not** change Cashier Instant Checkout this story (oversell **warn** UI is Story 4.5). Server fail-open is enough for AC #5

- [x] Task 6: Tests + docs (AC: #7–#8)
  - [x] Rewrite `accept-complete-sale.spec.ts`: insufficient qty → `ok: true` (optionally `warned`); qty `0` / missing product still fail
  - [x] Rewrite `adjust-stock.spec.ts` for `{ currentQty, targetQty, reason }`
  - [x] Rewrite `sales.service.spec.ts` **“fails closed when AcceptCompleteSale rejects stock”** → accept succeeds when domain returns ok with negative/zero remaining; `already_accepted` still skips domain
  - [x] `catalog.service.spec.ts`: `setStock` without reason / blank reason → 400; with reason → would persist movement (mock tx if needed)
  - [x] README: ledger is SoT; `stock_qty` is projection; Store #1 stub UUIDs; Cloudinary **not** in this story; Instant Checkout does not hard-block on qty

## Dev Notes

### Scope boundary (critical)

| In scope | Out of scope (later stories) |
|----------|------------------------------|
| Store #1 + one Register stub | Multi-store UI / Stock Transfer (4.x / 7.5) |
| `stock_movements` + opening cutover | Damaged Stock UI (4.5), Opname (4.6) |
| AdjustStock + AcceptCompleteSale ledger posts | ReceiveGoods, PostVoid, PostReturn |
| Lift nonneg CHECK; Sync fail-open on qty | Cashier oversell **warn** chip (4.5) |
| Dashboard Alasan on qty change | Cloudinary / MediaService (4.3) |
| | Catalog SKU/barcode/variants (4.2) |
| | Shift `shift_id` on sale (6.2 / AD-16) |

### Current state (must not break)

**`packages/domain/src/index.ts` today (contradicts AD-4 — this story fixes it):**

- `adjustStock(targetQty)` rejects `targetQty < 0` with `CATALOG_INVALID_STOCK` / “Stok harus bilangan bulat ≥ 0.”
- `acceptCompleteSale` returns `ok: false, code: "SALE_INSUFFICIENT_STOCK"` when `stock_qty < qty`

**`apps/api/src/db/schema.ts`:** `products.stockQty` with `check("products_stock_qty_nonneg", sql\`${t.stockQty} >= 0\`)`. Roles still `cashier | catalog_admin`. `sales` jsonb lines + payment.

**`apps/api/src/sales/sales.service.ts` `acceptSync`:** transaction → if `sale_id` exists return `{ accepted: true, already_accepted: true }` **without** touching stock → else `SELECT … FOR UPDATE` products → `acceptCompleteSale` → on `!ok` throw `ConflictException({ code, message })` → else UPDATE each `stockQty` then INSERT sale. **Preserve** validateSyncRequest (cash only, amount = Σ qty×price_minor, integer lines). **Preserve** already_accepted short-circuit **before** movements.

**`apps/api/src/catalog/catalog.service.ts`:** `setStock` calls `adjustStock(stock_qty)` then UPDATE row only — no movement. `create` writes `stockQty` directly. **Preserve** name/price PATCH not touching stock; `CATALOG_NOT_FOUND`; integer `price_minor` ≥ 0.

**`apps/api/src/catalog/dto/adjust-stock.dto.ts`:** `{ stock_qty }` `@Min(0)` only — add `reason`.

**`apps/dashboard/src/app/products-panel.tsx`:** edit always `PUT …/stock` with `{ stock_qty }` even when only name/price changed. Create posts `{ name, price_minor, stock_qty }`. Copy: **Stok**, **Simpan**. `parseNonNegInt` on stock — keep ≥ 0 on the form (AdjustStock still refuses negative target).

**Cashier:** Local Database + outbox unchanged. Do not add `store_id` to cashier Sync payload. Do not import Cloudinary.

**Money:** integer rupiah (`price_minor`) — unchanged.

### What this story changes

- Quantity **source of truth** = Stock Ledger (AD-13). `products.stock_qty` is a cached projection updated in the **same TX** as the movement(s).
- Named writers this story: **`AdjustStock`** and **`AcceptCompleteSale`** only (AD-4).
- Oversell: Instant Checkout / Sync **fail open** on qty (AD-4, AD-18). Phase 1 fail-closed insufficient-stock is **intentionally reversed**.
- Tenancy stub: every new movement tagged Store #1 (AD-19). Cashier does not pick a Store.

### What must be preserved

- Sale completeness gate (AD-2) — only complete Sales sync; incomplete cancel posts **no** ledger
- Idempotent `sale_id` (AD-3)
- No direct API Sale create (AD-1)
- Dashboard online-only; Cashier Local Database (AD-7)
- Auth roles Story 1.4 / AD-11
- shadcn + ID-primary microcopy (UX-DR1, UX-DR2)
- Day Close / outbox / session (Epic 3) — do not touch cashier Day Close
- Do not call Cloudinary (AD-12) — MediaService is Story 4.3

### Architecture compliance

| Rule | Implication |
|------|-------------|
| AD-3 | Until Sync ack, Local DB is cashier SoT. Dashboard list of **server** sales may lag; do not invent “pending sale” copy. Idempotent `(sale)` id — no double STOCK OUT |
| AD-4 | Only listed commands mutate qty. This story implements two of them. Lift nonneg CHECK. Negative sellable from sales is allowed |
| AD-5 | Movement validation in `packages/domain`; Nest orchestrates TX; types in `@pos-apps/types` |
| AD-13 | Sellable qty **is** Σ `qty_delta` where `bucket = sellable` per product (and Store). Projection column must match that sum after every TX |
| AD-15 | Do not stuff Purchasing/Media into Catalog. Do not create Inventory module unless it is the **only** INSERT path — simpler: Catalog/Sales call domain helper then INSERT `stock_movements` themselves this story |
| AD-16 | Do **not** require `shift_id` on AcceptCompleteSale yet |
| AD-19 | Phase 1 data **is** Store #1 + one Register. No cashier Store picker |
| FR-45 | No silent qty edit that bypasses the ledger (create initial + adjust + sale) |
| FR-46 | Adjustment without reason rejected; cashier cannot PUT `/stock` |
| FR-50 | Oversell does not block Checkout/Sync; negative/zero visible after Sync on Dashboard `stock_qty` |

### Data model (exact)

```text
stores
  store_id    uuid PK   -- 00000000-0000-4000-8000-000000000001
  name        text NOT NULL
  created_at  timestamptz NOT NULL default now()

registers
  register_id uuid PK   -- 00000000-0000-4000-8000-000000000002
  store_id    uuid NOT NULL FK → stores
  name        text NOT NULL
  created_at  timestamptz NOT NULL default now()

stock_movements
  movement_id uuid PK default gen_random_uuid()
  product_id  uuid NOT NULL FK → products
  store_id    uuid NOT NULL FK → stores
  qty_delta   integer NOT NULL          -- signed; STOCK OUT is negative
  bucket      text NOT NULL             -- CHECK IN ('sellable','damaged','in_transit')
  reason      text NOT NULL             -- trim; reject empty
  source_type text NOT NULL             -- 'cutover' | 'adjust' | 'sale' (more types later; allow text)
  source_id   uuid NULL                 -- sale_id when source_type = 'sale'
  actor_id    uuid NULL                 -- JWT user_id when known
  at          timestamptz NOT NULL default now()

products.stock_qty   integer NOT NULL   -- CACHED PROJECTION; may be negative after sales
-- DROP CONSTRAINT products_stock_qty_nonneg
```

Projection formula after each TX:

`stock_qty = SUM(qty_delta) FILTER (bucket = 'sellable')` for `(product_id, store_id = Store #1)`.

Prefer: apply domain-returned snapshot in the same TX (matches Phase 1 loop) **and** assert it equals the sum if cheap; do not leave projection stale.

### Project Structure Notes

```
apps/api/src/db/schema.ts                 # UPDATE — stores, registers, stock_movements; drop nonneg
apps/api/drizzle/0005_*.sql               # NEW — generate; do not edit 0000–0004
apps/api/src/db/seed.ts                   # UPDATE — Store #1 + movements for demo products
apps/api/src/catalog/catalog.service.ts   # UPDATE — create + setStock post movements
apps/api/src/catalog/catalog.controller.ts# UPDATE — setStock passes reason
apps/api/src/catalog/dto/adjust-stock.dto.ts
apps/api/src/sales/sales.service.ts       # UPDATE — STOCK OUT; no insufficient ConflictException
apps/api/src/sales/sales.service.spec.ts  # UPDATE — invert fail-closed stock test
apps/api/src/catalog/catalog.service.spec.ts
packages/domain/src/index.ts              # UPDATE
packages/domain/src/accept-complete-sale.spec.ts
packages/domain/src/adjust-stock.spec.ts
packages/types/src/index.ts               # UPDATE
apps/dashboard/src/app/products-panel.tsx # UPDATE — Alasan
README.md                                 # UPDATE
```

Alignment: existing Nest modules under `apps/api/src/{catalog,sales,db}/`. Do **not** add Cloudinary dependency (not in lockfile; Story 4.3). drizzle-orm **0.45.1**, drizzle-kit **0.30.6** — already pinned; do not bump.

### Testing requirements

- Domain: `node:test` in `packages/domain` (existing pattern — `assert` + `describe`/`it`)
- API: Jest + `@nestjs/testing` + `jest.mock("../db/client")` (existing `catalog.service.spec.ts` / `sales.service.spec.ts`)
- Do **not** switch domain specs to Jest
- Cashier Playwright / Epic 2 offline drill: no cashier code change expected; do not break `POST /sales/sync` contract besides failing-open on qty
- If an e2e still expects 409 `SALE_INSUFFICIENT_STOCK`, update that expectation — it is now wrong vs AD-4

### Previous story intelligence

No prior story in Epic 4. Cross-epic:

- **1.3** established AdjustStock as the **only** Dashboard qty path, `PUT /catalog/products/:id/stock`, `adjustStock` in domain, Indonesian **Stok**, integer rupiah. Reuse that endpoint; do not add a second Dashboard qty API.
- **1.4** RolesGuard: cashier 403 on catalog mutations — keep.
- **2.8** `acceptSync` is cashier-authorized, idempotent by `sale_id`, atomic sale + stock. Keep atomicity: movement INSERT + projection UPDATE + sale INSERT in **one** transaction. Today it fail-closes on insufficient stock — **reverse that**, keep everything else.
- **3.4** Day Close / session — do not touch.

### Git intelligence

Recent commits are cashier session/UI (SessionGuard, PrefControls, Phosphor). Last stock/sync work: `653a8fa` (sales sync + `AcceptCompleteSale`). Follow that pattern: domain pure function → Nest service TX → drizzle schema + numbered SQL under `apps/api/drizzle/`. Do not introduce a new HTTP client or state library.

### Latest tech notes

- **drizzle-orm 0.45.x / drizzle-kit 0.30.x** — current in `apps/api/package.json`. Use `pgTable` + `check()` like `users_role_check`. `db:generate` from `apps/api` with `DATABASE_URL`.
- **Nest 11.1.x** — existing `ConflictException` / `BadRequestException` `{ code, message }` bodies. Insufficient stock must **not** use 409 after this story.
- **No new npm package** for 4.1. Do not add `cloudinary`.
- PostgreSQL CHECK drop: `ALTER TABLE "products" DROP CONSTRAINT "products_stock_qty_nonneg";`

### Project context reference

No `project-context.md` in repo. Standing facts: local-primary offline-first POS; `apps/cashier` Next + Serwist; `apps/dashboard` Next; `apps/api` Nest + Drizzle + Neon Postgres; shared `packages/domain` + `packages/types`. Indonesian UI first.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 4 / Story 4.1]
- [Source: `_bmad-output/planning-artifacts/prds/prd-pos-apps-2026-08-05/prd.md` — FR-44, FR-45, FR-46, FR-48, FR-50, FR-104]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-pos-apps-2026-08-05/ARCHITECTURE-SPINE.md` — AD-3, AD-4, AD-5, AD-13, AD-15, AD-19]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-pos-apps-2026-08-06/EXPERIENCE.md` — Flow 4 (AdjustStock); Phase 2 screens spine-only]
- [Source: `packages/domain/src/index.ts` — current `SALE_INSUFFICIENT_STOCK`]
- [Source: `apps/api/src/sales/sales.service.ts` — current fail-closed `acceptSync`]
- [Source: `apps/api/src/db/schema.ts` — `products_stock_qty_nonneg`]
- [Source: `_bmad-output/implementation-artifacts/1-3-create-and-edit-products.md` — AdjustStock path]
- [Source: `_bmad-output/implementation-artifacts/2-8-sync-outbox-and-acceptcompletesale-updates-stock.md` — sync TX]

## Dev Agent Record

### Agent Model Used

Cursor Grok 4.6 (dev-story)

### Debug Log References

- Domain 10/10, API Jest 25/25 passing after ledger cutover.
- `SALE_INSUFFICIENT_STOCK` removed; Sync fail-open on qty.
- Migration handwritten as `0005_store_stock_ledger.sql` (matches existing 0001–0004 style; drizzle-kit generate not required).

### Completion Notes List

- Store #1 + Register 1 seeded with fixed UUIDs; `stock_movements` is quantity SoT; `products.stock_qty` remains a cached projection (nonneg CHECK dropped).
- `AdjustStock` requires `reason` and posts `source_type=adjust`; create posts `initial_stock`; Sync posts per-line STOCK OUT `sale` with cashier `actor_id`.
- Dashboard **Alasan** only on edit; skip PUT `/stock` when qty unchanged.
- Instant Checkout / Cashier untouched.

### File List

- apps/api/src/db/schema.ts
- apps/api/drizzle/0005_store_stock_ledger.sql
- apps/api/drizzle/meta/_journal.json
- apps/api/src/db/stock-ledger.ts
- apps/api/src/db/seed.ts
- apps/api/src/catalog/catalog.service.ts
- apps/api/src/catalog/catalog.controller.ts
- apps/api/src/catalog/catalog.service.spec.ts
- apps/api/src/catalog/catalog.controller.spec.ts
- apps/api/src/catalog/dto/adjust-stock.dto.ts
- apps/api/src/sales/sales.service.ts
- apps/api/src/sales/sales.service.spec.ts
- apps/api/src/sales/sales.controller.ts
- packages/domain/src/index.ts
- packages/domain/src/adjust-stock.spec.ts
- packages/domain/src/accept-complete-sale.spec.ts
- packages/domain/src/post-stock-movement.spec.ts
- packages/types/src/index.ts
- apps/dashboard/src/app/products-panel.tsx
- README.md

## Senior Developer Review (AI)

**Outcome:** Changes Requested → patched
**Date:** 2026-08-13

Layers: Blind Hunter + Edge Case Hunter + Acceptance Auditor (all ran).

### Action Items

- [x] Dashboard: validate Alasan and stock-change before PATCH; allow name/price save when displayed qty is negative (oversell projection)
- [x] Seed: product insert + opening movements in one transaction; backfill missing `cutover`/`opening_balance` rows
- [x] Tests: assert STOCK OUT / AdjustStock movement payload (qtyDelta, bucket, sourceType)
- [x] AD-19: `sales.store_id` / `register_id` stub columns defaulting to Store #1 / Register 1
- [x] AdjustStockDto empty reason Indonesian message

Dismissed: Instant Checkout local insufficient-stock (Story 4.5 / Task 5); drizzle snapshot gap (existing 0001–0004 pattern); create `qty_delta=0` movement (Task 4).

## Change Log

- 2026-08-13: Implemented Store stub, Stock Ledger, opening cutover, AdjustStock reason, and fail-open AcceptCompleteSale (Story 4.1).
- 2026-08-13: Addressed code review findings - 5 items resolved.
