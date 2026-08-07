---
baseline_commit: 653a8fad04ba54106cce0a08e851905271f0af58
---

# Story 3.4: End session and return to Account Login

Status: done

## Story

As a cashier,
I want confirming Day Close to end the POS session and return to Account Login,
so that the next shift cannot continue on my PIN session.

## Acceptance Criteria

1. Confirm → Account Login ✓
2. POS PIN session cleared; Account Login + PIN required again ✓
3. Sales / Sync outbox not wiped by Day Close ✓

## Tasks / Subtasks

- [x] clearSession + clearPinUnlock; keep IndexedDB sales/outbox/PIN hash
- [x] shift auth flag cleared (FR4)
- [x] README Day Close note

## Senior Developer Review (AI)

**Outcome:** Approve (with FR4 shift-flag fix)
**Date:** 2026-08-07

- [x] `pos_cashier_shift_ok` set on login, cleared on Day Close/logout; home/PIN no longer unlock from bare PIN material after Day Close

## Dev Agent Record

### Completion Notes List

- Confirm ends shift → `/login`; outbox preserved for next login Sync

### File List

- apps/cashier/src/app/day-close/page.tsx
- apps/cashier/src/lib/auth-token.ts
- apps/cashier/src/app/page.tsx
- apps/cashier/src/app/pin/page.tsx
- README.md

## Change Log

- 2026-08-07: Implemented + reviewed
