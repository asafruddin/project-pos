---
baseline_commit: 63dcb8c4f2c623ef6b1dad569ec32d03221577ba
---

# Story 7.3: Reports and analytics

Status: done

## Story

As a store operator,
I want online-first sales, product, inventory, cashier, and financial reports on Dashboard,
so that I can see net after Refunds and margin from the product cost field without treating reports as a general ledger.

## Acceptance Criteria

1. **Given** a date range and Store #1  
   **When** Dashboard opens reports  
   **Then** it shows revenue, transaction count, units, AOV, discount, Refund, and net (FR-93). Net accounts for Refunds. Voided Sales are excluded from revenue. Cashier-only sees a limited view (no COGS/margin) or none; Cashier PWA has no reports UI

2. **And** product analytics lists top/slow sellers. Inactive products can still appear historically. Margin is selling vs product `cost_minor`, not FIFO, and is hidden from cashier-only (FR-94)

3. **And** inventory analytics shows stock value (cost × sellable), movement in the period, approved Stock Opname variance tied to opname ids, and dead Stock (sellable > 0 with zero units sold in the period) (FR-95). Cashier-only does not see this view

4. **And** cashier performance lists Sales and Refunds by cashier / Shift. A cashier cannot see others’ performance; catalog_admin can (FR-96)

5. **And** the financial snapshot is revenue, COGS (product cost field), gross profit, tax, and fees as recorded — not a GL. Tax and fees are 0 until set. Snapshot matches summed complete Sales minus Refunds. CSV export is catalog_admin only (FR-97). Reports do not drain Sync and are not on Instant Checkout

## Tasks / Subtasks

- [x] Task 1: Domain aggregations (net, COGS from cost field, product rank, opname variance, dead Stock) (AC: #1–#5)
- [x] Task 2: Nest `reports` module + role-stripped payloads + CSV export (AC: #1–#5)
- [x] Task 3: Dashboard `/reports` (date range, limited cashier view, admin export). No Cashier PWA reports page (AC: #1–#5)

## Dev Notes

### 2D subset `[ASSUMPTION]`

| In | Out (later) |
|----|-------------|
| UTC date range, Store #1 | Multi-Store picker (7.5) |
| COGS = `qty × products.cost_minor` (null cost = 0) | FIFO / average costing |
| Tax = 0, fees = 0 until recorded | Tax engine / GL |
| CSV export gated to `catalog_admin` | Resource × action `export` (7.4) |
| Cashier Dashboard: limited summary + own performance | Cashier PWA analytics |
| Simple bar viz for top sellers | Charting library |

### Architecture

| Rule | Implication |
|------|-------------|
| AD-15 | Nest `reports` module; no Cloudinary; no `insertStockMovement` |
| AD-10 | Totals from Sale snapshots + current product cost field; do not re-price lines |
| AD-19 | Store #1 only |
| AD-4 / AD-18 | Reports never block Instant Checkout; do not drain Sync |
| FR-31 | Existing `/sales` list + totals stays; this story adds analytics beside it |

### Current code (preserve)

- `GET /sales` today UTC list
- Product `cost_minor` already omitted from cashier catalog GET
- Refunded Returns have `refund_amount_minor` + `refunded_at`
- Approved opname lines already compute `counted − system`

### References

- [Source: `epics.md` Story 7.3]
- [Source: `prd.md` FR-93–FR-97]
- [Source: `ARCHITECTURE-SPINE.md` AD-10, AD-15, AD-19]

## Dev Agent Record

### Agent Model Used

Cursor Grok 4.6 (dev-story)

### Debug Log References

- No new migration: reports read existing sales, refunds, ledger, opname, and `products.cost_minor`.
- Restart `pnpm dev:api` if it was already running so `ReportsModule` loads.

### Completion Notes List

- Domain: `summarizeSalesAnalytics` (net = revenue − refunds, voids excluded, COGS = qty × cost field), product rank, opname variance on approved ids, dead stock, inventory value at cost. Tax/fees = 0.
- Nest `reports`: `GET /reports/summary|products|inventory|cashiers|export`. Cashier summary/products scoped to own shifts; no COGS/margin; inventory + CSV are `catalog_admin`. Does not drain Sync.
- Dashboard `/reports` with UTC date range and simple bar viz. Cashier PWA has no reports page. Existing `/sales` list (FR-31) unchanged.

### File List

- packages/domain/src/index.ts
- packages/domain/src/reports.spec.ts
- packages/types/src/index.ts
- apps/api/src/app.module.ts
- apps/api/src/reports/reports.module.ts
- apps/api/src/reports/reports.controller.ts
- apps/api/src/reports/reports.controller.spec.ts
- apps/api/src/reports/reports.service.ts
- apps/api/src/reports/reports.service.spec.ts
- apps/api/src/reports/reports-isolation.spec.ts
- apps/dashboard/src/app/reports/page.tsx
- apps/dashboard/src/app/reports-panel.tsx
- apps/dashboard/src/components/dashboard-shell.tsx

## Change Log

- 2026-08-13: Story drafted for implementation.
- 2026-08-13: Implemented reports. Review applied (cashier totals own-only; CSV all products). Status → done.
