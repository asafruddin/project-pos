---
baseline_commit: 63dcb8c4f2c623ef6b1dad569ec32d03221577ba
---

# Story 7.2: Promotions, Coupons, Vouchers

Status: done

## Story

As a cashier,
I want auto Promotions, one Coupon, a Voucher, and a manager-approved extra discount from shared rules,
so that Instant Checkout still completes at list price when Promotions are down.

## Acceptance Criteria

1. **Given** eligible auto Promotions  
   **When** the Cart Panel totals  
   **Then** discounts evaluate once in `packages/domain` and match Dashboard (FR-87–FR-88). Inactive / out-of-window Promotions do not apply. Line `price_minor` is not re-priced (AD-10)

2. **And** Cashier can enter one Coupon. Invalid Coupon is a clear error; the Sale can proceed without it (FR-89). Voucher remaining is stored; over-apply leaves remaining; no voucher cash-out (FR-90). Used-up Voucher cannot be reused

3. **And** Cashier cannot apply an arbitrary extra discount; manager PIN on device can (FR-91). There is no cashier discount API. Approved discount is on the Sale snapshot / Receipt

4. **And** if evaluation is unavailable, Instant Checkout completes at catalog/Store list price (or last-cached auto rules) (FR-92 / AD-18). Offline: cached autos may apply; Coupon missing from cache is refused clearly; Voucher apply is online-only (no CRDT)

## Tasks / Subtasks

- [x] Task 1: Domain `evaluatePromotions` / voucher / manager discount / payable stack (AC: #1–#4)
- [x] Task 2: Schema + Promotions API + Sync snapshot + Voucher debit / Void restore (AC: #1–#4)
- [x] Task 3: Cashier coupon / voucher / manager PIN; Dashboard campaign editor (AC: #1–#4)

## Dev Notes

### 2D subset `[ASSUMPTION]`

PRD lists BXGY/bundle/category laundry; rubric said name a gate subset:

| In | Out (later) |
|----|-------------|
| `percent` / `fixed` | buy-X-get-Y, bundle |
| Optional `product_ids`, `customer_group`, `min_subtotal_minor` | Category tree targeting |
| Date window + happy-hour `hour_start`/`hour_end` (local hour) | Device vs Store clock split |
| Auto-apply + `exclusive` (exclusive = single largest; else sum) | Complex stack matrix |
| One Coupon code | Multi-coupon |
| Voucher remaining, online apply | Voucher cash-out |
| Manager extra discount via existing manager PIN | Dashboard approval workflow |

### Payable (sale-level, not line re-price)

`line_total − promo − manager − voucher − loyalty = payable`  
Split tenders must match payable. Loyalty earn still uses amount paid.

If cashier sent discounts and server skips (rules/voucher down): **keep cashier sale amount**, do not reject.

### Architecture

| Rule | Implication |
|------|-------------|
| AD-18 | Eval once in domain; unavailable → skip, never block Pay |
| AD-10 | Discount is sale-level |
| AD-14 | Voucher remaining like redeem — online-only debit |
| AD-15 | Nest `promotions` module; no Cloudinary / stock ledger / `shift_id` |
| AD-3 | Cash sale without Customer still accepts |

### Current code (preserve)

- Instant Checkout cash-only without Customer
- Loyalty redeem online; earn after Sync
- Shift gate; customer/group price already on line snapshots

### References

- [Source: `epics.md` Story 7.2]
- [Source: `prd.md` FR-87–FR-92]
- [Source: `ARCHITECTURE-SPINE.md` AD-10, AD-14, AD-18]

## Dev Agent Record

### Agent Model Used

Cursor Grok 4.6 (dev-story)

### Debug Log References

- 2D subset named in story (percent/fixed, one coupon, voucher, happy hour, manager PIN). BXGY/bundle deferred.
- Migration `0018_promotions` applied.

### Completion Notes List

- Shared domain eval: auto + exclusive stack, invalid coupon reported without blocking Pay, voucher cap, manager cap, `stackSaleDiscounts`.
- Nest `promotions` + `vouchers` controllers. PATCH promotions is `catalog_admin`. Cashier may GET promotions and lookup voucher by code.
- Sync keeps cashier payable if voucher/rules skip (AD-18). Void restores voucher remaining.
- Cashier: cached autos, coupon field, online voucher, manager PIN for extra discount.
- Review (Blind Hunter / Edge Case / Acceptance Auditor): invalid coupon no longer aborts Instant Checkout; voucher debit is online-only; line prices unchanged. No remaining blocking defects.

### File List

- packages/domain/src/index.ts
- packages/domain/src/promotions.spec.ts
- packages/types/src/index.ts
- packages/local-db/src/db.ts
- packages/local-db/src/sales.ts
- packages/local-db/src/promotions.ts
- packages/local-db/src/promotions.spec.ts
- packages/local-db/src/index.ts
- packages/local-db/package.json
- apps/api/drizzle/0018_promotions.sql
- apps/api/drizzle/meta/_journal.json
- apps/api/src/db/schema.ts
- apps/api/src/app.module.ts
- apps/api/src/promotions/*
- apps/api/src/sales/sales.service.ts
- apps/cashier/src/components/cart-panel.tsx
- apps/cashier/src/app/menu/page.tsx
- apps/cashier/src/lib/preferences.ts
- apps/dashboard/src/app/promotions/page.tsx
- apps/dashboard/src/app/promotions-panel.tsx
- apps/dashboard/src/components/dashboard-shell.tsx

## Change Log

- 2026-08-13: Story drafted for implementation.
- 2026-08-13: Implemented 2D promo subset. Review applied. Status → done.
