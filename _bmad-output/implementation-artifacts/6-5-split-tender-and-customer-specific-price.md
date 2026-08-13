---
baseline_commit: 63dcb8c4f2c623ef6b1dad569ec32d03221577ba
---

# Story 6.5: Split tender and Customer-specific price

Status: done

## Story

As a cashier,
I want to split cash and Store Credit, and use a customer price when one exists,
so that Checkout still completes at catalog price when overrides are missing.

## Acceptance Criteria

1. **Given** a payable total  
   **When** I tender cash and/or Store Credit  
   **Then** the split must sum to the payable total. Methods other than cash and Store Credit are rejected. Cash-only with no Customer still completes (FR-110)

2. **And** Store Credit without a Customer is rejected. Store Credit cannot exceed the Customer’s cached/server balance. Debit happens on complete; Void restores the credit portion

3. **And** an attached Customer may use a customer or group selling price. Missing/invalid override **fails open** to catalog price and does not block Instant Checkout (FR-112 / AD-18). Unattached Sales use catalog price. Sync uses line snapshots (AD-10) — no re-price

4. **And** cash Expected Cash counts only the cash tender (store credit does not inflate the drawer). Indonesian UI. Shift gate unchanged

## Tasks / Subtasks

- [x] Task 1: Domain `evaluateSplitTender` + `resolveSellingPrice` (AC: #1–#3)
- [x] Task 2: Schema + API Store Credit, prices, Sync tenders (AC: #1–#4)
- [x] Task 3: Cashier checkout split + reprice; Dashboard credit/prices (AC: #1–#4)

## Dev Notes

### Scope boundary

| In | Out |
|----|-----|
| cash + Store Credit split; customer/group price | Card / QR / other methods |
| Issue/set Store Credit balance on Dashboard | Loyalty (7.1), Promotions (7.2) |
| Fail-open price eval in `packages/domain` | Re-pricing on Sync |

### Architecture

| Rule | Implication |
|------|-------------|
| AD-18 | Eval once in domain; decorations fail open |
| AD-10 | Complete snapshots `price_minor`; Sync must not re-price |
| AD-4 | Oversell still warns; do not add `SALE_INSUFFICIENT_STOCK` |
| FR-78 | Only **cash** tenders enter Expected Cash |
| AD-3 | Sale Sync does not wait on Customer row to accept a **cash** sale; store-credit sales may retry until Customer exists |

### Current code (preserve)

- `completeSale` / `POST /sales/sync` cash-only payment; keep brownfield `{ method: "cash", amount_minor }`
- Cart line `priceMinor` is the snapshot; attach Customer must reprice from catalog + overrides
- Pay still requires open Shift (6.2)

### References

- [Source: `epics.md` Story 6.5]
- [Source: `prd.md` FR-68 remainder, FR-110, FR-112]
- [Source: `ARCHITECTURE-SPINE.md` AD-10, AD-18]

## Dev Agent Record

### Agent Model Used

Cursor Grok 4.6 (dev-story)

### Debug Log References

- Domain 60, local-db 38, API Jest 92. Cashier + dashboard `tsc --noEmit` clean.
- Migration `0016_store_credit_prices` applied.

### Completion Notes List

- Instant Checkout remains cash-only (Store Credit defaults to 0). Card/QR rejected in domain.
- `resolveSellingPrice`: customer → group → store → catalog; invalid/missing fails open.
- Sync persists line snapshots and does not re-price. Store Credit debit is in the same sale/void tx; missing customer on a credit sale retries (customers flush first).
- Expected Cash uses `cashTenderTotal` only.

### File List

- packages/domain/src/index.ts
- packages/domain/src/split-tender.spec.ts
- packages/types/src/index.ts
- apps/api/src/db/schema.ts
- apps/api/drizzle/0016_store_credit_prices.sql
- apps/api/drizzle/meta/_journal.json
- apps/api/src/customers/customers.service.ts
- apps/api/src/customers/customers.controller.ts
- apps/api/src/customers/customers.controller.spec.ts
- apps/api/src/customers/customers.service.spec.ts
- apps/api/src/customers/dto/customer.dto.ts
- apps/api/src/sales/sales.service.ts
- apps/api/src/shifts/shifts.service.ts
- packages/local-db/src/db.ts
- packages/local-db/src/sales.ts
- packages/local-db/src/customers.ts
- packages/local-db/src/customers.spec.ts
- packages/local-db/src/shift-cash.ts
- packages/local-db/src/shift-cash.spec.ts
- packages/local-db/src/index.ts
- apps/cashier/src/components/cart-context.tsx
- apps/cashier/src/components/cart-panel.tsx
- apps/cashier/src/components/customer-attach.tsx
- apps/cashier/src/lib/preferences.ts
- apps/cashier/src/app/customers/page.tsx
- apps/dashboard/src/app/customers-panel.tsx
- apps/dashboard/src/app/customers/page.tsx
- _bmad-output/implementation-artifacts/sprint-status.yaml

## Change Log

- 2026-08-13: Story drafted for implementation.
- 2026-08-13: Implemented split tender (cash + Store Credit) and fail-open customer/group prices. Review: reset credit on customer change; unknown payment methods no longer coerce to cash; debit Store Credit after local stock check.

## Review

### Blind Hunter

- Unknown `payment.method` without tenders was coerced to cash → now returns no tenders (eval rejects).
- Local debit of Store Credit ran before the stock check; reordered so a stock throw cannot leave a committed credit debit if the IDB tx is ambiguous.

### Edge Case Hunter

- Detach/attach customer reused the previous Store Credit amount → reset `creditMinor` when `customerId` changes (Instant Checkout stays 0).
- Brownfield `{ method: "cash", amount_minor }` and void payloads without `payment` still yield cash 0 / skip restore.
- 100% Store Credit does not inflate FR-78 Expected Cash.

### Acceptance Auditor

- AC1: cash-only, no customer, Instant Checkout. Other methods rejected.
- AC2: Store Credit requires customer + balance; debit on complete; void restores.
- AC3: `resolveSellingPrice` fail-open; Sync uses snapshots (AD-10).
- AC4: cash tender only in Expected Cash; ID UI; Shift gate unchanged.
