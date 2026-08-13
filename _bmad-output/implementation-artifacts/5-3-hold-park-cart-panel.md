---
baseline_commit: 63dcb8c4f2c623ef6b1dad569ec32d03221577ba
---

# Story 5.3: Hold/park Cart Panel

Status: done

## Story

As a cashier,
I want to park a Cart Panel before payment and resume it later,
so that I can serve another customer without losing the first cart.

## Acceptance Criteria

1. **Given** a Cart Panel with at least one line and Checkout not started  
   **When** I park it (**Tahan**)  
   **Then** the live cart clears, a parked record is stored on this device, and **no Sale** is created (not `incomplete`, not `complete`)

2. **And** park does **not** change Stock (local catalog qty or server ledger) and is **not** written to the Sync outbox (AD-14)

3. **Given** a parked cart  
   **When** I resume it (**Lanjutkan**) with an empty live cart  
   **Then** lines and totals restore from the parked snapshot (price at park time). Resume with a non-empty live cart is refused

4. **And** discarding a parked cart is not Void (5.4) and not Checkout cancel. Incomplete Checkout cancel remains `discardIncompleteSale`. Indonesian UI. Dashboard has no hold. No Cloudinary. No `shift_id`. Instant Checkout still never fail-closes with `SALE_INSUFFICIENT_STOCK`

5. **And** parked carts are device-local IndexedDB (not a multi-Register queue). They survive reload; Day Close / Shift ignore them

## Tasks / Subtasks

- [x] Task 1: local-db parked cart store (AC: #1–#2, #5)
  - [x] IndexedDB v6 `parkedCarts` — not `sales`, not `syncOutbox`
  - [x] `buildParkedCart` / park / resume / discard / list; empty or invalid lines rejected
  - [x] Spec: totals restore; isolation from sales/outbox

- [x] Task 2: Cashier Cart Panel (AC: #1, #3–#4)
  - [x] **Tahan** when lines exist and Checkout not started; **Lanjutkan** / **Buang** on parked list
  - [x] `replaceLines` restores parked qty even if catalog stock is lower (AD-4)
  - [x] Copy id + en. Hide Tahan during Checkout

- [x] Task 3: README (AC: #1–#5)
  - [x] Document Tahan / Lanjutkan; parked ≠ Sale ≠ outbox

## Dev Notes

### Scope boundary

| In | Out |
|----|-----|
| Device-local parked cart | Shared Register queue |
| Resume lines + totals | Void (5.4), Return (5.5) |
| Survive reload | Shift-close discard/block (Epic 6) |

### Architecture

| Rule | Implication |
|------|-------------|
| AD-14 | Hold is Cart Panel state, not outbox |
| AD-2 | Incomplete Sale is Checkout only, not overnight park |
| AD-4 | Park/resume never mutate qty; Instant Checkout not fail-closed |
| AD-1 | Park never POSTs `/sales/sync` |
| AD-16 | No `shift_id` |

### Previous story intelligence

- Cart is React state in `cart-context.tsx`; Checkout writes `sales` via `createIncompleteSale`
- Local DB is v5 (`catalogImages`). Bump to v6 for `parkedCarts`
- `completeSale` still decrements **local** catalog qty on Receipt — do not touch that path
- Do not reintroduce `SALE_INSUFFICIENT_STOCK`

### References

- [Source: `epics.md` Story 5.3]
- [Source: `prd.md` FR-62]
- [Source: `ARCHITECTURE-SPINE.md` AD-2, AD-14]
- [Source: `EXPERIENCE.md` Hold / park]

## Dev Agent Record

### Agent Model Used

Cursor Grok 4.6 (dev-story)

### Debug Log References

- local-db tests 16/16; cashier `tsc --noEmit` clean.

### Completion Notes List

- IndexedDB v6 `parkedCarts` holds device-local cart snapshots (no `saleId` / `status`). Park/resume/discard never touch `sales` or `syncOutbox`.
- Cashier **Tahan** / **Ditahan** / **Lanjutkan** / **Buang**. Resume restores parked prices and qty (cap = max(parked qty, catalog stock)). Busy live cart must be held or cleared first. Tahan hidden during Checkout.
- Buang is not Void; Checkout **Batal** still uses `discardIncompleteSale`.

### File List

- packages/local-db/src/db.ts
- packages/local-db/src/parked-carts.ts
- packages/local-db/src/parked-carts.spec.ts
- packages/local-db/src/index.ts
- packages/local-db/src/catalog.ts
- packages/local-db/package.json
- apps/cashier/src/components/cart-context.tsx
- apps/cashier/src/components/cart-panel.tsx
- apps/cashier/src/lib/preferences.ts
- README.md

## Senior Developer Review (AI)

**Outcome:** Changes Requested → patched
**Date:** 2026-08-13

Layers: Blind Hunter + Edge Case Hunter + Acceptance Auditor.

### Action Items

- [x] Parked store isolated from `sales` / `syncOutbox` / `catalogProducts`
- [x] Resume restores lines + `totalMinor`; empty/invalid park rejected
- [x] Tahan hidden during Checkout; Lanjutkan refused if live cart non-empty
- [x] Restore parked qty even when catalog stock is lower (AD-4)
- [x] `inFlight` guard so Bayar + Tahan cannot both fire
- [x] Load park, restore lines, then discard — catalog failure must not drop the hold

Dismissed: Void (5.4); shared Register queue; Shift-close vs parks (Epic 6); local `completeSale` stock check (pre-existing).

## Change Log

- 2026-08-13: Device-local hold/park on Cashier Cart Panel; not a Sale and not in the outbox (Story 5.3).
