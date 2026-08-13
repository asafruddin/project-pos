---
baseline_commit: 63dcb8c4f2c623ef6b1dad569ec32d03221577ba
---

# Story 4.5: Stock Overview, Damaged Stock, and low-stock

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As inventory staff,
I want Overview, Damaged Stock, and low/out lists from the ledger,
so that I can see honest quantity without editing qty by hand.

## Acceptance Criteria

1. **Given** I am on Dashboard (FR-44)  
   **When** I open Stock Overview  
   **Then** sellable and damaged qty per product equal the **sum of Stock Movements** for that product at Store #1 (AD-13 / AD-19)

2. **And** I can move qty to Damaged Stock: STOCK OUT sellable + STOCK IN damaged, same reason, one TX (FR-47). Damaged is not sold on Cashier Menu (Menu still uses sellable `stock_qty` projection)

3. **And** Dashboard surfaces products at/under `min_qty` and at zero (FR-50). Oversell does **not** hard-block Instant Checkout (already AD-4)

4. **And** Cashier does not need this screen to sell. No Opname (4.6). No new qty writer besides named commands (`MarkDamaged` + existing AdjustStock / sale)

5. **And** reason is mandatory for damaged moves. `catalog_admin` mutates; cashier may view. Indonesian UI

## Tasks / Subtasks

- [x] Task 1: Domain `markDamaged` (AC: #2, #4)
  - [x] Pure function: `{ qty, reason }` → qty integer ≥ 1, reason trimmed non-empty
  - [x] Spec next to `post-stock-movement.spec.ts`

- [x] Task 2: Types + API (AC: #1–#3)
  - [x] `StockOverviewItem`: `product_id`, `name`, `sku`, `min_qty`, `track_stock`, `sellable_qty`, `damaged_qty`, `in_transit_qty`, `is_low`, `is_out`
  - [x] `GET /inventory/overview` JWT; any authenticated role. Qty from `SUM(qty_delta)` grouped by product + bucket, left-joined to `products`. Store #1 only
  - [x] `is_out` = sellable ≤ 0; `is_low` = `min_qty != null && sellable ≤ min_qty`
  - [x] `POST /inventory/products/:productId/damaged` `{ qty, reason }` `catalog_admin` only. Two movements `source_type=damage`; update `products.stock_qty` projection by −qty
  - [x] DTO: qty `@Min(1)`, reason required Indonesian empty message
  - [x] Empty reason / qty < 1 → 400. Unknown product → `CATALOG_NOT_FOUND`

- [x] Task 3: Dashboard (AC: #1–#3, #5)
  - [x] Nav **Ikhtisar stok** → `/stock`. Keep **Stok / Produk** as catalog
  - [x] Table: nama, dijual, rusak, min, badges **Rendah** / **Habis**
  - [x] Filters: Semua | Rendah | Habis | Ada rusak
  - [x] **Pindah ke rusak**: qty + **Alasan** (catalog_admin). Cashier view-only
  - [x] shadcn; no cashier Menu change except it already hides damaged (sellable projection)

- [x] Task 4: Tests + README (AC: #1, #2, #4)
  - [x] Overview uses ledger sums (mock movements)
  - [x] markDamaged posts sellable −n and damaged +n
  - [x] Low flag when sellable ≤ min
  - [x] README: overview path, damaged move, cashier still sells at zero

## Dev Notes

### Scope boundary

| In | Out |
|----|-----|
| Overview from ledger sums | Stock Opname (4.6) |
| MarkDamaged sellable → damaged | Goods receipt / transfer UI |
| Low / out lists | Hard-block checkout on zero |

### Current state

- `insertStockMovement` + AdjustStock + sale STOCK OUT exist (4.1)
- `products.stock_qty` is sellable **projection** — Overview must not treat it as SoT; compute SUM
- `min_qty` on products (4.2). Cashier Menu uses `stockQty` from catalog pull
- Do not reintroduce `SALE_INSUFFICIENT_STOCK`

### Architecture

| Rule | Implication |
|------|-------------|
| AD-13 | sellable = sum(movements where bucket=sellable) |
| AD-4 | MarkDamaged is a named command; negative sellable allowed |
| AD-19 | Store #1 only |
| FR-50 | warn/list only; Instant Checkout unchanged |

### Previous story intelligence

- Alasan before mutate (4.1). Unique/parent errors mapped (4.2)
- Image cache is 4.4 — do not touch cashier pull

### References

- [Source: `epics.md` Story 4.5]
- [Source: `prd.md` FR-44, FR-47, FR-50]
- [Source: `ARCHITECTURE-SPINE.md` AD-4, AD-13, AD-19]
- [Source: `apps/api/src/db/stock-ledger.ts`]

## Dev Agent Record

### Agent Model Used

Cursor Grok 4.6 (dev-story)

### Debug Log References

- API Jest 45/45, domain 12/12 (incl. mark-damaged), local-db 10/10.

### Completion Notes List

- Overview SoT is `SUM(stock_movements.qty_delta)` per product/bucket at Store #1 — not `products.stock_qty`.
- `markDamaged` posts sellable OUT + damaged IN in one TX (`source_type=damage`, shared `source_id`); projection `stock_qty -= qty`.
- `is_out` = sellable ≤ 0; `is_low` = min set and sellable ≤ min. Dashboard **Ikhtisar stok** filters Semua/Rendah/Habis/Ada rusak.
- Cashier Instant Checkout unchanged (no `SALE_INSUFFICIENT_STOCK`). No Opname (4.6). No Cloudinary. No `shift_id`.

### File List

- packages/domain/src/index.ts
- packages/domain/src/mark-damaged.spec.ts
- packages/types/src/index.ts
- apps/api/src/app.module.ts
- apps/api/src/inventory/inventory.module.ts
- apps/api/src/inventory/inventory.service.ts
- apps/api/src/inventory/inventory.service.spec.ts
- apps/api/src/inventory/inventory.controller.ts
- apps/api/src/inventory/inventory.controller.spec.ts
- apps/api/src/inventory/dto/mark-damaged.dto.ts
- apps/dashboard/src/app/stock-overview-panel.tsx
- apps/dashboard/src/app/stock/page.tsx
- apps/dashboard/src/components/dashboard-shell.tsx
- README.md

## Senior Developer Review (AI)

**Outcome:** Changes Requested → patched
**Date:** 2026-08-13

Layers: Blind Hunter + Edge Case Hunter + Acceptance Auditor.

### Action Items

- [x] Overview sums filter `store_id` = Store #1 (AD-19)
- [x] MarkDamaged movements share one `source_id` and pass Store #1 explicitly
- [x] Dashboard `useEffect`/`useCallback` load (not `useMemo`); Rendah/Habis badges
- [x] README cashier 403 restored; GET overview allowed; Instant Checkout still not hard-blocked
- [x] Domain + API specs: ledger sums, low/out flags, sellable OUT + damaged IN, blank reason, unknown product

Dismissed: Opname (4.6); hard-block checkout on zero (AD-4); `shift_id` (Epic 6).

## Change Log

- 2026-08-13: Stock Overview from ledger sums; MarkDamaged sellable→damaged; low/out lists on Dashboard (Story 4.5).
