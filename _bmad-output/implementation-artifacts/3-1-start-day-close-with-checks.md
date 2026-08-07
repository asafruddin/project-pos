---
baseline_commit: 653a8fad04ba54106cce0a08e851905271f0af58
---

# Story 3.1: Start Day Close with checks

Status: done

## Story

As a cashier,
I want to start Day Close and see sales total, cash summary, and Sync status,
so that I know whether the day is ready to close.

## Acceptance Criteria

1. From POS-PIN unlocked Cashier, start Day Close (FR22) ✓
2. Show day’s sales total, cash summary, Sync status from Local Database ✓
3. Sync status: synced vs waiting — never relabel complete as incomplete ✓
4. ID-primary “Tutup hari” ✓

## Tasks / Subtasks

- [x] local-db day-close summary helpers
- [x] `/day-close` + Menu entry
- [x] Summary panel
- [x] ID/EN + formatIdr

## Senior Developer Review (AI)

**Outcome:** Approve (fixes applied with Epic 3 batch)
**Date:** 2026-08-07

- [x] FR4: shift auth flag cleared on Day Close so offline PIN alone cannot reopen shift
- [x] Day bounds unit test

## Dev Agent Record

### Completion Notes List

- `getDayCloseSummary` / `listCompleteSalesForLocalDay` in `@pos-apps/local-db`
- Cashier `/day-close` summary step; Menu **Tutup hari**

### File List

- packages/local-db/src/sales.ts
- packages/local-db/src/day-close.spec.ts
- packages/local-db/src/index.ts
- apps/cashier/src/app/day-close/page.tsx
- apps/cashier/src/app/menu/page.tsx
- apps/cashier/src/lib/preferences.ts
- README.md

## Change Log

- 2026-08-07: Implemented + reviewed
