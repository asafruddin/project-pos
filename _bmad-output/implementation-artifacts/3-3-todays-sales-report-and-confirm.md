---
baseline_commit: 653a8fad04ba54106cce0a08e851905271f0af58
---

# Story 3.3: Today’s Sales Report and confirm

Status: done

## Story

As a cashier,
I want to review Today’s Sales Report and confirm it,
so that Day Close is intentional and auditable for the shift.

## Acceptance Criteria

1. Report: transactions, totals, prices ✓
2. Confirm finishes Day Close ✓
3. List/summary; formatted money ✓
4. “Selesai” + Sync chip only — never “pending sale” ✓

## Tasks / Subtasks

- [x] Report list step
- [x] Selesai + Menunggu unggah / Tersinkron chips
- [x] Confirm CTA gated by acknowledge

## Senior Developer Review (AI)

**Outcome:** Approve
**Date:** 2026-08-07

## Dev Agent Record

### Completion Notes List

- Report step on `/day-close` with line names/prices and status chips

### File List

- apps/cashier/src/app/day-close/page.tsx
- apps/cashier/src/lib/preferences.ts

## Change Log

- 2026-08-07: Implemented + reviewed
