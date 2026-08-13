---
baseline_commit: 63dcb8c4f2c623ef6b1dad569ec32d03221577ba
---

# Story 5.4: Same-day Void

Status: done

## Story

As a cashier,
I want to Void a complete Sale from today after manager PIN approval,
so that stock comes back and the sale is reversed without pretending it never happened.

## Acceptance Criteria

1. **Given** a complete Sale from this device’s calendar day that is not already Voided or Returned  
   **When** a manager PIN is entered in-session  
   **Then** `PostVoid` reverses it: STOCK IN sellable for each line; the Sale row is **not** deleted (audit)

2. **And** incomplete Checkout cancel is **not** Void (AD-2) and posts no ledger. Yesterday’s Sale cannot Void (Return is 5.5)

3. **And** Void is local-first then Sync (`kind` void / `voidOutbox`, AD-14). Idempotent on `void_id`. Cashier Instant Checkout is unchanged (no `SALE_INSUFFICIENT_STOCK`). No Cloudinary. No `shift_id` (Expected Cash from cash Void waits Epic 6)

4. **And** Indonesian UI. Manager PIN is device-local (`__manager__`), distinct from cashier PIN. Dashboard lists voided synced sales but has no Void action

## Tasks / Subtasks

- [x] Task 1: Domain `postVoid` (AC: #1–#2)
  - [x] complete + same day + not already voided/returned; lines qty ≥ 1
  - [x] Spec `packages/domain/src/post-void.spec.ts`

- [x] Task 2: Local-db + API (AC: #1, #3)
  - [x] IndexedDB v7 `voidOutbox`; `voidedAt`/`voidId` on complete Sale (status stays `complete`)
  - [x] Restore local catalog qty; enqueue void; never delete the sale
  - [x] `sale_voids` table; `POST /sales/void`; STOCK IN `source_type=void`; cashier-only
  - [x] Day Close totals exclude voided; pending includes unsynced voids

- [x] Task 3: Cashier UI + README (AC: #3–#4)
  - [x] `/void` — today’s complete sales; PIN manajer enroll/verify; **Void**
  - [x] Flush voids after sales. Dashboard Penjualan shows Void, no button

## Dev Notes

### Scope boundary

| In | Out |
|----|-----|
| Same-day Void of complete Sale | Return / Refund (5.5) |
| Manager PIN on device | Shift Expected Cash (Epic 6) |
| STOCK IN sellable | Silent delete of Sale |

### Architecture

| Rule | Implication |
|------|-------------|
| AD-2 | Status remains `complete`; Void is a reverse record |
| AD-4 | Only `PostVoid` inserts void movements |
| AD-14 | Void uses outbox; not a live Dashboard POST |
| AD-16 | No `shift_id` yet |
| AD-3 | Idempotent on `void_id` |

### Previous story intelligence

- `discardIncompleteSale` must stay the Checkout cancel path
- Hold/park (5.3) is not a Sale — cannot Void a parked cart
- `completeSale` decrements local catalog; Void must increment it back
- Flush sales **before** voids so server has the Sale to reverse

### References

- [Source: `epics.md` Story 5.4]
- [Source: `prd.md` FR-63]
- [Source: `ARCHITECTURE-SPINE.md` AD-2, AD-4, AD-14]

## Dev Agent Record

### Agent Model Used

Cursor Grok 4.6 (dev-story)

### Debug Log References

- Domain 24/24, local-db 19/19, API Jest 66/66. Cashier + dashboard `tsc --noEmit` clean.

### Completion Notes List

- `postVoid` allows only a complete same-day sale that is not already voided/returned. Incomplete cancel stays `VOID_NOT_ALLOWED`.
- Local Void writes `voidedAt`/`voidId` (status stays `complete`), restores catalog qty, enqueues `voidOutbox`. Sync: sales then `POST /sales/void`. Idempotent on `void_id`. `sale_voids` keeps the Sale row.
- Cashier `/void` + manager PIN (`__manager__`, must differ from cashier PIN). Dashboard Penjualan shows Void status; daily total excludes voided. Cash Expected Cash waits Epic 6.

### File List

- packages/domain/src/index.ts
- packages/domain/src/post-void.spec.ts
- packages/types/src/index.ts
- packages/local-db/package.json
- packages/local-db/tsconfig.json
- packages/local-db/src/db.ts
- packages/local-db/src/day-bounds.ts
- packages/local-db/src/void-sale.ts
- packages/local-db/src/void-sale.spec.ts
- packages/local-db/src/sales.ts
- packages/local-db/src/pin-material.ts
- packages/local-db/src/index.ts
- apps/api/src/db/schema.ts
- apps/api/drizzle/0011_sale_voids.sql
- apps/api/drizzle/meta/_journal.json
- apps/api/src/sales/sales.service.ts
- apps/api/src/sales/sales.service.spec.ts
- apps/api/src/sales/sales.controller.ts
- apps/api/src/sales/sales.controller.spec.ts
- apps/cashier/src/lib/flush-sync.ts
- apps/cashier/src/lib/preferences.ts
- apps/cashier/src/app/menu/page.tsx
- apps/cashier/src/app/void/page.tsx
- apps/cashier/src/app/day-close/page.tsx
- apps/cashier/src/components/app-shell.tsx
- apps/dashboard/src/app/sales/page.tsx
- README.md
- pnpm-lock.yaml

## Senior Developer Review (AI)

**Outcome:** Changes Requested → patched
**Date:** 2026-08-13

Layers: Blind Hunter + Edge Case Hunter + Acceptance Auditor.

### Action Items

- [x] Incomplete cancel is not Void (`postVoid` + `discardIncompleteSale` unchanged)
- [x] Sale row kept (`sale_voids`); silent delete impossible
- [x] STOCK IN sellable `source_type=void`; idempotent on `void_id`
- [x] Flush sales before voids; `VOID_SALE_NOT_FOUND` retries after sale sync
- [x] Manager PIN skipped by cashier `getAnyPinMaterial` (must not unlock the till)
- [x] Manager PIN must differ from cashier PIN on enroll
- [x] Day Close totals exclude voided; dashboard has status only

Dismissed: Return (5.5); Shift Expected Cash (Epic 6); API re-check of local calendar (cashier already gates; UTC-day mismatch would strand the outbox).

## Change Log

- 2026-08-13: Same-day Void of complete sales via PostVoid STOCK IN; manager PIN; sale not deleted (Story 5.4).
