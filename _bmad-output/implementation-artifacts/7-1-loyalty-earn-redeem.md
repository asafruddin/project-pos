---
baseline_commit: 63dcb8c4f2c623ef6b1dad569ec32d03221577ba
---

# Story 7.1: Loyalty earn/redeem

Status: done

## Story

As a cashier,
I want attached Customers to earn and redeem Points from shared rules,
so that Instant Checkout still completes when Loyalty is down or the Customer has no account.

## Acceptance Criteria

1. **Given** an attached Customer  
   **When** a complete Sale Syncs  
   **Then** Points are earned per `packages/domain` rules (FR-83). Offline complete Sales do **not** invent Points locally — earn runs after Sync. No Loyalty Account: Sale still completes (FR-82)

2. **And** Cashier can redeem Points **when online**, reducing payable. Insufficient / expired Points are refused. Redeem is written to an auditable ledger (FR-84 / FR-85). Cashier has no rule editor

3. **And** if the program/rules are missing or disabled, Instant Checkout still completes and skips earn/redeem (FR-86 / AD-18). Redeem is online-only (AD-14) — no CRDT

4. **And** `catalog_admin` configures earn rate, point value, tiers, and optional expiration on Dashboard. Sync does not re-price lines (AD-10). Shift gate unchanged

## Tasks / Subtasks

- [x] Task 1: Domain `evaluateLoyaltyEarn` / `evaluateLoyaltyRedeem` / `resolveLoyaltyTier` (AC: #1–#3)
- [x] Task 2: Schema + Loyalty API + earn/redeem on Sale Sync / Void reverse (AC: #1–#4)
- [x] Task 3: Cashier points + online redeem; Dashboard program + ledger (AC: #2–#4)

## Dev Notes

### Scope boundary

| In | Out |
|----|-----|
| Earn after Sync; redeem online; tiers + expire_days | Promotions / coupons (7.2) |
| Ledger audit; Dashboard program editor | Clawback on Return |
| Fail-open skip | Local invent of Points; card tender |

### Architecture

| Rule | Implication |
|------|-------------|
| AD-18 | Eval once in domain; unavailable → skip, never block Pay |
| AD-14 | Redeem online-first; earn after Sale Sync |
| AD-10 | Discount is sale-level, not a line re-price |
| AD-3 | Cash sale without Customer still accepts |
| AD-15 | Nest `loyalty` module; no Cloudinary |

### Defaults `[ASSUMPTION]`

- 1 point per Rp 10.000 paid (`earn_per_minor = 10000`)
- 1 point = Rp 100 off (`point_value_minor = 100`)
- Tiers: Reguler (0, 1×), Silver (100 lifetime, 1.2×), Gold (500, 1.5×)
- `expire_days` null = no expiry. FIFO remaining on earn rows when set

### Current code (preserve)

- Instant Checkout cash-only without Customer
- Split tender sums to **payable after loyalty discount**
- Store Credit still requires Customer

### References

- [Source: `epics.md` Story 7.1]
- [Source: `prd.md` FR-82–FR-86]
- [Source: `ARCHITECTURE-SPINE.md` AD-14, AD-18]

## Dev Agent Record

### Agent Model Used

Cursor Grok 4.6 (dev-story)

### Debug Log References

- Domain `tsc` required `typeof number` guards in `normalizeLoyaltyProgram` (`Number.isInteger` does not narrow).
- Local meta store is `string`-typed; program cache is JSON in `meta.loyaltyProgram`.
- Migration `0017_loyalty` applied.

### Completion Notes List

- Earn after Sync in `applySaleLoyalty`; local complete stores redeem snapshot only (no local earn).
- Redeem is cashier-online; Sync fail-opens skip debit but keeps cashier payable (AD-18). Insufficient is refused in domain eval on cashier.
- Void reverses earn/redeem and restores FIFO remaining on earn lots.
- Split tenders must match **line total − loyalty discount**. Line `price_minor` unchanged (AD-10).
- Review (Blind Hunter / Edge Case / Acceptance Auditor): fixed redeem double-subtract on earn update; FIFO restore on void; payable-before-split; meta JSON cache. No remaining blocking defects.

### File List

- packages/domain/src/index.ts
- packages/domain/src/loyalty.spec.ts
- packages/types/src/index.ts
- packages/local-db/src/db.ts
- packages/local-db/src/sales.ts
- packages/local-db/src/customers.ts
- packages/local-db/src/customers.spec.ts
- packages/local-db/src/loyalty.ts
- packages/local-db/src/loyalty.spec.ts
- packages/local-db/src/index.ts
- packages/local-db/package.json
- apps/api/drizzle/0017_loyalty.sql
- apps/api/drizzle/meta/_journal.json
- apps/api/src/db/schema.ts
- apps/api/src/app.module.ts
- apps/api/src/loyalty/*
- apps/api/src/sales/sales.service.ts
- apps/api/src/sales/sales.service.spec.ts
- apps/api/src/customers/customers.service.ts
- apps/cashier/src/components/cart-panel.tsx
- apps/cashier/src/components/customer-attach.tsx
- apps/cashier/src/app/menu/page.tsx
- apps/cashier/src/app/customers/page.tsx
- apps/cashier/src/lib/preferences.ts
- apps/dashboard/src/app/loyalty/page.tsx
- apps/dashboard/src/app/loyalty-panel.tsx
- apps/dashboard/src/app/customers-panel.tsx
- apps/dashboard/src/components/dashboard-shell.tsx

## Change Log

- 2026-08-13: Story drafted for implementation.
- 2026-08-13: Implemented earn-after-Sync, online redeem, Dashboard program/ledger. Review fixes applied. Status → done.
