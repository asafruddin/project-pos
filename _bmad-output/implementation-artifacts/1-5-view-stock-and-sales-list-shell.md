---
baseline_commit: fbc257ecf080138460d44c02f91a2034e90dd7b8
---

# Story 1.5: View Stock and sales list shell

Status: done

## Story

As a catalog_admin,
I want Dashboard Stock levels and a sales list / daily totals view,
so that I can see inventory now and have a place for synced Sales once Cashier Sync lands.

## Acceptance Criteria

1. **Given** I am logged in on Dashboard as `catalog_admin` (or `cashier` if read allowed)  
   **When** I open the Stock / products view  
   **Then** I see current server Stock qty per product (FR30 foundation)

2. **And** there is a Sales list + daily totals screen that works with **zero Sales** (empty state OK) (FR31)

3. **And** if a minimal synced-Sales read model is needed, create only what this list needs; **do not** implement Cashier Sync or `AcceptCompleteSale` (Epic 2)

4. **And** money shown formatted IDR consistent with NFR6 / UX-DR11

5. **And** sales list is list + totals only — **no charts** (UX-DR12)

6. **And** empty sales state does not imply Cashier Offline Mode or local-only Sales (Dashboard online-only)

## Tasks / Subtasks

- [x] Task 1: Stock visibility (AC: #1)
  - [x] Ensure Produk view clearly shows Stok column (already from 1.3) — add nav label **Stok / Produk** if helpful
  - [x] Read-only for cashier already OK from 1.4

- [x] Task 2: Sales list API shell (AC: #2–3)
  - [x] `GET /sales` (Bearer) → `{ sales: SalesListItem[], daily_total_minor: number }` 
  - [x] Empty array + 0 total when no rows; optional minimal `sales` table for future Sync OR in-memory empty without premature Sync fields
  - [x] Prefer minimal `sales` table: `sale_id`, `completed_at`, `amount_minor`, `created_at` — no AcceptCompleteSale writer yet
  - [x] Types in `@pos-apps/types`

- [x] Task 3: Dashboard Penjualan page (AC: #2, #4–6)
  - [x] Route `/sales` (or tab): Indonesian **Penjualan**, table columns Waktu / Total, empty: calm copy that synced sales appear after Cashier Sync (not offline)
  - [x] Daily total formatted IDR
  - [x] Sidebar nav: Produk | Penjualan | Keluar
  - [x] No charts

- [x] Task 4: Docs + tests
  - [x] README GET /sales
  - [x] Test: GET /sales authenticated returns empty shape; unauth 401

## Dev Notes

Reuse JwtAuthGuard; both roles may read. No RolesGuard needed for GET /sales.

Empty copy suggestion: `Belum ada penjualan tersinkron. Daftar ini terisi setelah kasir mengunggah penjualan selesai.`

## Dev Agent Record

### Agent Model Used

Cursor Grok 4.5

### Completion Notes List

- Minimal `sales` table + GET /sales empty shell (daily total UTC)
- Dashboard shell nav Stok/Produk + Penjualan; IDR totals; empty-state copy clarifies synced server sales
- Stock qty already on Produk list from 1.3

### File List

- packages/types/src/index.ts
- apps/api/src/db/schema.ts
- apps/api/drizzle/0003_sales_shell.sql
- apps/api/src/sales/**
- apps/api/src/app.module.ts
- apps/dashboard/src/components/dashboard-shell.tsx
- apps/dashboard/src/app/page.tsx
- apps/dashboard/src/app/sales/page.tsx
- README.md

## Change Log

- 2026-08-07: Story created, implemented, smoke-tested, done
