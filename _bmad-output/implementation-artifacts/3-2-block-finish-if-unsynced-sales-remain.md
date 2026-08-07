---
baseline_commit: 653a8fad04ba54106cce0a08e851905271f0af58
---

# Story 3.2: Block finish if unsynced Sales remain

Status: done

## Story

As a cashier,
I want Day Close to hard-block finish while unsynced complete Sales remain unless I explicitly acknowledge,
so that Sales are not silently abandoned at close.

## Acceptance Criteria

1. Hard-block finish when pending Sync > 0 ✓
2. Explicit checkbox naming unsynced count ✓
3. After acknowledge, proceed; outbox retained ✓
4. Fully synced → no Sync block ✓

## Tasks / Subtasks

- [x] Acknowledge checkbox
- [x] Disable Continue/Confirm until checked
- [x] Never delete outbox on Day Close

## Senior Developer Review (AI)

**Outcome:** Approve
**Date:** 2026-08-07

## Dev Agent Record

### Completion Notes List

- Hard warning + required checkbox with `{count}` in Day Close summary

### File List

- apps/cashier/src/app/day-close/page.tsx

## Change Log

- 2026-08-07: Implemented + reviewed
