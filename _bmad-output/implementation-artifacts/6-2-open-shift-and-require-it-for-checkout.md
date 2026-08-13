---
baseline_commit: 63dcb8c4f2c623ef6b1dad569ec32d03221577ba
---

# Story 6.2: Open Shift and require it for Checkout

Status: done

## Story

As a cashier,
I want to open a Shift with opening cash before I can Pay,
so that every complete Sale after 2C belongs to exactly one Register Shift.

## Acceptance Criteria

1. **Given** no open Shift on this Register  
   **When** I open a Shift with opening cash (integer Rp ≥ 0)  
   **Then** opening cash is recorded and the Shift is active. Local-first (AD-14); Sync is idempotent on `shift_id`

2. **And** a second open on the same Register is rejected until close (close cash-count is Story 6.3). One open Shift per Register (AD-16 / AD-19 Store #1 + Register 1)

3. **And** Checkout **Pay** is disabled without an open Shift. `AcceptCompleteSale` / `POST /sales/sync` **requires** `shift_id` (`SALE_SHIFT_REQUIRED`). Sales never have `shift_id = null` after this story. Hold/park still works (not a Sale)

4. **And** Instant Checkout loop otherwise unchanged (oversell warn, no `SALE_INSUFFICIENT_STOCK`). Cash In/Out, Expected Cash, and close-with-count wait 6.3. Indonesian UI

## Tasks / Subtasks

- [x] Task 1: Domain `openShift` + `requireSaleShift` (AC: #1–#3)
- [x] Task 2: Schema + ShiftsModule + sale Sync (AC: #1–#3)
  - [x] `shifts` table; unique one-open-per-register; `sales.shift_id`
  - [x] `POST /shifts` cashier; idempotent on `shift_id`
  - [x] AcceptCompleteSale rejects missing `shift_id`
- [x] Task 3: Cashier local-first gate (AC: #2–#4)
  - [x] IndexedDB v9 shifts + `shiftOutbox`
  - [x] `/shift` opening cash; Pay disabled; flush shifts before sales

## Dev Notes

### Scope boundary

| In | Out |
|----|-----|
| Open Shift, opening cash, Checkout gate | Cash In/Out, Expected Cash, close count (6.3) |
| `shift_id` required on complete Sale | Day Close vs Shift (6.4) |
| One open per Register | Manager review of closed Shifts (FR-81) |

### Architecture

| Rule | Implication |
|------|-------------|
| AD-16 | Pay off without open Shift; AcceptCompleteSale requires `shift_id` |
| AD-14 | Shift open is local-first outbox `kind=shift` |
| AD-15 | `ShiftsModule` independent; no Cloudinary / ledger |
| AD-8 | Shift open does not drain Sync (Day Close still does) |
| AD-19 | Store #1 + Register 1 |

### References

- [Source: `epics.md` Story 6.2]
- [Source: `prd.md` FR-75]
- [Source: `ARCHITECTURE-SPINE.md` AD-8, AD-14, AD-16, AD-19]

## Dev Agent Record

### Agent Model Used

Cursor Grok 4.6 (dev-story)

### Debug Log References

- Domain 38/38, local-db 27/27, API Jest 85/85. Cashier + dashboard `tsc --noEmit` clean.

### Completion Notes List

- `openShift` records integer opening cash ≥ 0; second open → `SHIFT_ALREADY_OPEN`. Unique index one open Shift per Register.
- `requireSaleShift` + `POST /sales/sync` reject missing `shift_id` (`SALE_SHIFT_REQUIRED`). New complete Sales stamp the open Shift locally.
- Cashier `/shift` then **Bayar** disabled without an open Shift. Hold still works. Flush: customers → shifts → sales → voids. Close/count waits 6.3.

### File List

- packages/domain/src/index.ts
- packages/domain/src/open-shift.spec.ts
- packages/types/src/index.ts
- packages/local-db/src/db.ts
- packages/local-db/src/shifts.ts
- packages/local-db/src/shifts.spec.ts
- packages/local-db/src/sales.ts
- packages/local-db/src/index.ts
- packages/local-db/package.json
- apps/api/src/db/schema.ts
- apps/api/drizzle/0014_shifts.sql
- apps/api/drizzle/meta/_journal.json
- apps/api/src/shifts/*
- apps/api/src/app.module.ts
- apps/api/src/sales/sales.service.ts
- apps/api/src/sales/sales.service.spec.ts
- apps/cashier/src/lib/flush-sync.ts
- apps/cashier/src/lib/preferences.ts
- apps/cashier/src/components/cart-panel.tsx
- apps/cashier/src/components/app-shell.tsx
- apps/cashier/src/app/shift/page.tsx
- apps/cashier/src/app/pin/page.tsx
- README.md

## Change Log

- 2026-08-13: Story drafted and implemented (FR-75 / AD-16).
