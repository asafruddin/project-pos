---
baseline_commit: 63dcb8c4f2c623ef6b1dad569ec32d03221577ba
---

# Story 6.3: Cash In/Out, Expected Cash, close Shift

Status: done

## Story

As a cashier,
I want to record Cash In/Out, see Expected Cash, and close the Shift with a counted drawer,
so that the difference is recorded and I can open the next Shift without draining Sync.

## Acceptance Criteria

1. **Given** an open Shift  
   **When** I record Cash In or Cash Out with a reason and amount ≥ 1  
   **Then** Expected Cash changes and Stock does not. Offline-capable (AD-14). Complete cash Sales on this Shift appear in its totals (FR-76)

2. **And** Expected Cash = opening + cash Sales + Cash In − Cash Out − cash Refunds − cash Voids (FR-78). Voided cash Sales are subtracted; non-cash Sales do not inflate Expected Cash

3. **And** close shows counted vs Expected vs difference. Non-zero difference **warns**, does not hard-block. After close, a new Shift can open. Close does not require FR-24 / drain Sync (AD-8 / FR-80)

4. **And** Dashboard (online-first) can review closed Shifts and differences. Cashier cannot edit a closed Shift. Indonesian UI. Instant Checkout otherwise unchanged

## Tasks / Subtasks

- [x] Task 1: Domain `recordCashMovement`, `expectedCash`, `closeShift` (AC: #1–#3)
- [x] Task 2: Schema + API (AC: #1–#4)
  - [x] `shift_cash_movements`; close snapshot columns; refunds attach `shift_id`
  - [x] POST cash in/out; POST close; GET list/detail
- [x] Task 3: Cashier local-first + Dashboard review (AC: #3–#4)
  - [x] IndexedDB v10 cash movements + close outbox
  - [x] `/shift` in/out + count/close; Dashboard **Shift**

## Dev Notes

### Scope boundary

| In | Out |
|----|-----|
| Cash In/Out, Expected Cash, close with count | Day Close after Shift (6.4) |
| Dashboard review of closed Shifts | Split tender / Store Credit (6.5) |
| Refunds attach to open Shift when present | Recomputing Expected Cash on Day Close |

### Architecture

| Rule | Implication |
|------|-------------|
| FR-78 | One formula; snapshot at close |
| AD-14 | Cash In/Out and close are local-first outbox |
| AD-8 | Close does not drain Sync |
| AD-4 | Cash movements never write Stock |

### References

- [Source: `epics.md` Story 6.3]
- [Source: `prd.md` FR-76–FR-81]
- [Source: `ARCHITECTURE-SPINE.md` AD-8, AD-14]

## Dev Agent Record

### Agent Model Used

Cursor Grok 4.6 (dev-story)

### Debug Log References

- Domain 45/45, local-db 32/32, API Jest 90/90. Cashier + dashboard `tsc --noEmit` clean. Migration `0015_shift_cash` applied.

### Completion Notes List

- `recordCashMovement` requires open Shift, reason, amount ≥ 1. `expectedCash` is FR-78 (voided cash sales counted then subtracted). `closeShift` records difference; non-zero warns, does not block.
- `POST /shifts/:id/cash` and `POST /shifts/:id/close` are cashier-only. Close snapshots counted/expected/difference (does not overwrite with a second formula). Cash movements never write Stock.
- IndexedDB v10: `cashMovements` + `cashMovementOutbox` + `shiftCloseOutbox`. Flush: customers → opens → cash → closes → sales → voids. Close does not drain Sync.
- Cashier `/shift`: Cash In/Out, live Expected Cash, count + warn-on-difference close. After close, Pay stays disabled until the next open. Dashboard **Shift** reviews closed rows; no PATCH on closed Shifts.
- Review fix: cash in/out outbox may replay after close when `occurred_at` ≤ `closed_at` (same as sales sync after close). Online Expected Cash merges server cash-refund totals into the local formula.

### File List

- packages/domain/src/index.ts
- packages/domain/src/shift-cash.spec.ts
- packages/types/src/index.ts
- packages/local-db/src/db.ts
- packages/local-db/src/shift-cash.ts
- packages/local-db/src/shift-cash.spec.ts
- packages/local-db/src/index.ts
- packages/local-db/package.json
- apps/api/src/db/schema.ts
- apps/api/drizzle/0015_shift_cash.sql
- apps/api/drizzle/meta/_journal.json
- apps/api/src/shifts/shifts.service.ts
- apps/api/src/shifts/shifts.controller.ts
- apps/api/src/shifts/shifts.controller.spec.ts
- apps/api/src/shifts/shifts.service.spec.ts
- apps/api/src/shifts/dto/record-cash.dto.ts
- apps/api/src/shifts/dto/close-shift.dto.ts
- apps/api/src/sales/returns.service.ts
- apps/cashier/src/lib/flush-sync.ts
- apps/cashier/src/lib/preferences.ts
- apps/cashier/src/app/shift/page.tsx
- apps/dashboard/src/app/shifts/page.tsx
- apps/dashboard/src/app/shifts-panel.tsx
- apps/dashboard/src/components/dashboard-shell.tsx
- README.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/6-3-cash-in-out-expected-cash-close-shift.md

## Change Log

- 2026-08-13: Story drafted and implemented (FR-76–FR-81). Review: replay cash movements after close; merge online refunds into local Expected Cash.
