---
baseline_commit: 63dcb8c4f2c623ef6b1dad569ec32d03221577ba
---

# Story 6.4: Day Close after Shift

Status: done

## Story

As a cashier,
I want Day Close to wait until the Shift is closed and to show this Register’s Shift cash,
so that I still drain Sync (or acknowledge) and do not invent a second cash formula.

## Acceptance Criteria

1. **Given** an open Shift  
   **When** I try to finish Day Close  
   **Then** finish is disabled until the Shift is closed (FR-111). Starting Day Close does not delete Sales

2. **And** cash summary displays this Register’s closed Shifts (Expected Cash, counted, difference). Day Close does **not** recompute FR-78. Sales total remains the sum of today’s complete Sales (FR-23)

3. **And** FR-24 still applies: finish blocked while unsynced complete Sales remain unless I explicitly acknowledge. Confirm still ends the POS session without wiping the outbox (AD-8)

4. **And** if today’s complete Sales exist but zero Shifts closed today, finish is blocked. Instant Checkout otherwise unchanged. Indonesian UI

## Tasks / Subtasks

- [x] Task 1: Domain `evaluateDayClose` (AC: #1, #3–#4)
- [x] Task 2: Local Day Close summary uses closed Shift snapshots (AC: #2–#4)
- [x] Task 3: Cashier `/day-close` gates + Shift cash UI (AC: #1–#4)

## Dev Notes

### Scope boundary

| In | Out |
|----|-----|
| FR-111 open-Shift gate; FR-23 cash = closed Shift snapshots | Split tender / customer price (6.5) |
| Keep FR-22–FR-27 session end | Persisted Day Close audit row |
| Multiple closed Shifts in one calendar day | Store-wide Day Close (2D) |

### Architecture

| Rule | Implication |
|------|-------------|
| AD-8 | Finish needs Sync drain or ack; cash display ≠ second formula |
| AD-16 | Selling still requires open Shift; Day Close requires it closed |
| FR-78 owner | Shift close snapshot; Day Close only **shows** it |
| Overnight Shift | One Shift until closed; include it if `closedAt` is today |

### Current code (preserve)

- `apps/cashier/src/app/day-close/page.tsx` — FR-24 ack + report + logout; `cashMinor` currently equals sales total (Phase 1)
- `packages/local-db/src/sales.ts` `getDayCloseSummary` — move/extend; do not drain `syncOutbox` on confirm

### References

- [Source: `epics.md` Story 6.4]
- [Source: `prd.md` FR-23, FR-24, FR-111]
- [Source: `ARCHITECTURE-SPINE.md` AD-8]

## Dev Agent Record

### Agent Model Used

Cursor Grok 4.6 (dev-story)

### Debug Log References

- Domain 52/52, local-db 36/36, API Jest 90/90. Cashier + dashboard `tsc --noEmit` clean.

### Completion Notes List

- `evaluateDayClose` blocks finish while a Shift is open, when today’s complete Sales exist with zero closed Shifts, and when unsynced Sales remain without acknowledge. Acknowledge cannot bypass an open Shift.
- Cash summary **displays** closed Shift Expected / counted / difference snapshots (`closedAt` on the local calendar day). Sales total stays the sum of today’s complete Sales. FR-78 is not recomputed.
- Confirm still ends Account + PIN session and does not drain Sync (AD-8). Instant Checkout unchanged.

### File List

- packages/domain/src/index.ts
- packages/domain/src/day-close.spec.ts
- packages/local-db/src/day-close.ts
- packages/local-db/src/day-close.spec.ts
- packages/local-db/src/sales.ts
- packages/local-db/src/index.ts
- apps/cashier/src/app/day-close/page.tsx
- apps/cashier/src/lib/preferences.ts
- README.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/6-4-day-close-after-shift.md

## Change Log

- 2026-08-13: Story drafted and implemented (FR-111 / FR-23 after 2C). Review: open-Shift gate outranks FR-24 ack; cash is Shift snapshots only.
