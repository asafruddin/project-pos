---
baseline_commit: 63dcb8c4f2c623ef6b1dad569ec32d03221577ba
---

# Story 7.5: Multi-Store and Stock Transfer

Status: done

## Story

As an Owner or Admin,
I want additional Stores, per-Store Stock and price, and Stock Transfer with an in-transit bucket,
so that Store A sales do not decrement Store B, transfers are auditable, and Instant Checkout never asks the cashier to pick a Store per line.

## Acceptance Criteria

1. **Given** Owner/Admin on Dashboard  
   **When** they define Stores and Registers  
   **Then** Phase 1 data remains Store #1 + Register 1; they can add Store #2 and a Register bound to it (FR-104). Cashier session is bound to the signed-in user’s Store + Register. Instant Checkout does not ask for a Store per line

2. **And** the Stock Ledger is per Store. A Sale at Store A does not decrement Store B. Stock Overview can filter by Store. Sync of an offline Sale posts to the cashier’s Store (FR-105)

3. **And** Admin may override selling price per Store. Cashier Menu uses that Store’s price after catalog refresh. Missing override falls back to catalog selling price (FR-106). `resolveSellingPrice` already has `store_price_minor` in the chain — persist it

4. **And** Stock Transfer statuses are Draft → Requested → Approved → Preparing → Shipped → Received → Completed. Invalid skips rejected. Stock does not leave Store A until Shipped. Between Shipped and Received, qty is **in-transit**: not sellable at A or B (FR-107)

5. **And** Shipped posts sellable OUT at A and in-transit IN (same qty). Received posts in-transit OUT and sellable IN at B. Completed: A decreased, B increased by the same qty. Rejected Draft: no Stock change (FR-108 / AD-4 `ShipTransfer` / `ReceiveTransfer`)

6. **And** Media Provider, Dashboard multi-Store UI, and transfer are **not** on cashier Checkout. Cross-Store offline Sync is out. FR-21 drill still passes on one Store (FR-109)

## Tasks / Subtasks

- [x] Task 1: Domain `transitionStockTransfer`, `shipTransfer`, `receiveTransfer`; store price already in `resolveSellingPrice` (AC: #3–#5)
- [x] Task 2: Schema + Nest stores/registers + transfer module; sales/sync post to actor `storeId`; only `insertStockMovement` writes qty (AC: #1–#6)
- [x] Task 3: Dashboard Stores + Transfer; Stock Overview store filter; catalog refresh uses session store price. No Checkout Store-picker (AC: #1–#3, #6)

## Dev Notes

### 2D subset `[ASSUMPTION]`

| In | Out (later) |
|----|-------------|
| Store #1 kept; add ≥1 extra Store + Register from Dashboard | Unlimited org tree / franchise |
| Per-Store ledger + store selling-price override | Per-Register stock |
| Transfer: OUT at Shipped, IN at Received; `in_transit` bucket | In-transit as a third Store |
| Cashier bound to `users.store_id` (and one Register) | Cashier picks Store at login every sale |
| Online transfer + online Sync to the signed-in Store | Cross-Store offline Sync |

### Architecture

| Rule | Implication |
|------|-------------|
| AD-4 | Only `ShipTransfer` / `ReceiveTransfer` (via `insertStockMovement`) write transfer qty. Instant Checkout never fail-closes on qty |
| AD-10 | Do not re-price synced lines from the destination Store’s catalog |
| AD-13 | Bucket `in_transit` already on `stock_movements`; use it |
| AD-15 | Nest by domain (`stores` or extend `inventory` for transfers). No Cloudinary |
| AD-19 | Phase 1 rows stay Store #1 + Register 1. New Stores are extra rows, not a rename |
| FR-109 | No Store picker on Instant Checkout / Cart |

### Current code (preserve)

- `STORE_1_ID` / `REGISTER_1_ID` in `@pos-apps/types`
- `stores` / `registers` tables; `stock_movements.store_id` + `in_transit` bucket
- Overview already projects `in_transit_qty`
- `resolveSellingPrice({ store_price_minor })` — **no table yet**
- Sales/sync currently default `storeId` to Store #1 — change to actor store, default Store #1 if missing
- `users.store_id` from 7.4 (still Store #1 until assigned)
- Instant Checkout cash path; do not drain Sync; do not block negative sellable

### Data model (suggested)

- `store_prices` PK `(store_id, product_id)` `price_minor` (null = clear override)
- `stock_transfers` + `stock_transfer_lines`
- Status check constraint matching FR-107
- Movements: `source_type` = `transfer`, `source_id` = transfer id

### Domain sketch

```
transitionStockTransfer({ from, to }) → ok | TRANSFER_INVALID_STATUS
shipTransfer({ lines, from_store }) → movements: sellable −qty @ A, in_transit +qty
receiveTransfer({ lines, to_store }) → in_transit −qty, sellable +qty @ B
```

Invalid skips (e.g. Draft → Shipped) fail closed. Shipped without prior Approved/Preparing fail closed.

### Permissions

- `stores:view` / `stores:update` — Owner/Admin (and Store Manager view)
- `inventory:update` already covers damaged/adjust; reuse for ship/receive **or** add `transfers:create` / `transfers:update`. Prefer `transfers:*` so cashiers cannot ship
- Default: Admin/Owner/Store Manager can approve/ship/receive; Inventory Staff can draft/request; Cashier none

### Do not

- Gate 7.5 on a custom role builder
- Re-price synced sale lines
- Ask for Store on Checkout
- Allow cross-Store offline Sync
- Let Catalog/Sales INSERT movements except through `insertStockMovement`
- Rename `catalog_admin` / `cashier`
- Commit unless asked

### References

- [Source: `epics.md` Story 7.5]
- [Source: `prd.md` FR-104–FR-109]
- [Source: `ARCHITECTURE-SPINE.md` AD-4, AD-13, AD-19]
- [Source: Story 4.1 ledger + Store stub]

## Dev Agent Record

### Agent Model Used

Cursor Grok 4.6

### Debug Log References

- Domain 93 pass; API Jest 140 pass; cashier + dashboard `tsc --noEmit` clean.
- Migration `0020_stores_transfers` applied; seed upserted `stores:*` / `transfers:*` grants (`onConflictDoNothing`).
- Restart `pnpm dev:api` so `StoresModule` is loaded.

### Completion Notes List

- Extra Stores/Registers are new rows. Store #1 + Register 1 stay. Create-store also inserts Register 1.
- Ledger and Sync use the actor’s `storeId`. `products.stock_qty` remains a Store #1 cache. Instant Checkout has no Store picker.
- Catalog overlay (`resolveSellingPrice` + `store_prices`) applies on Cashier/Supervisor GET only, so Dashboard product edit does not persist a store override as catalog price. Missing override falls back to catalog.
- Transfer machine is draft → requested → approved → preparing → shipped → received → completed. Cancel from draft/requested/approved. Ship posts sellable OUT @ A + in-transit IN @ B; receive posts in-transit OUT + sellable IN @ B. Completed is status-only. `shipped → completed` is rejected.
- Inventory Staff can draft/request; ship/receive/approve need `transfers:approve`. Cashier has none.
- Only `transfer.service.ts` in the stores module calls `insertStockMovement`.

### File List

- `packages/domain/src/index.ts`
- `packages/domain/src/stock-transfer.spec.ts`
- `packages/domain/src/rbac.spec.ts`
- `packages/types/src/index.ts`
- `apps/api/drizzle/0020_stores_transfers.sql`
- `apps/api/src/db/schema.ts`
- `apps/api/src/stores/`
- `apps/api/src/app.module.ts`
- `apps/api/src/catalog/catalog.service.ts`
- `apps/api/src/catalog/catalog.controller.ts`
- `apps/api/src/sales/sales.service.ts`
- `apps/api/src/sales/sales.controller.ts`
- `apps/api/src/sales/returns.service.ts`
- `apps/api/src/inventory/inventory.service.ts`
- `apps/api/src/inventory/inventory.controller.ts`
- `apps/api/src/users/users.service.ts`
- `apps/dashboard/src/components/dashboard-shell.tsx`
- `apps/dashboard/src/app/stores/`
- `apps/dashboard/src/app/stores-panel.tsx`
- `apps/dashboard/src/app/transfers/`
- `apps/dashboard/src/app/transfers-panel.tsx`
- `apps/dashboard/src/app/stock-overview-panel.tsx`
- `apps/dashboard/src/app/employees-panel.tsx`

## Review

All-layer review (Blind Hunter / Edge Case / Acceptance Auditor) ran in-session after tests were green.

### Findings fixed

- Receive API hopped `shipped → completed`, skipping persisted `received` and allowing an invalid skip.
- Changing transfer “from” store could submit the same store as destination.
- Dashboard catalog GET overlaid store price, so saving a product could write the override as catalog price.
- Mark-damaged while filtering Store #2 still posted to Store #1.
- `role_permissions` from 7.4 omitted `stores:*` / `transfers:*` until seed re-ran.

### Deferred (2D)

- Return cash-refund still prefers an open shift on Register 1.
- `products.stock_qty` is Store #1 only; Overview is the per-store source of truth.
- Employees assign store at create; no later reassign control.
- Cross-Store offline Sync remains out (FR-109).

