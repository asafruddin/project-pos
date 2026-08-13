---
baseline_commit: 63dcb8c4f2c623ef6b1dad569ec32d03221577ba
---

# Story 6.1: Customer profile, attach, history

Status: done

## Story

As a cashier,
I want to create or attach a Customer on the Cart Panel and still complete a Sale without one,
so that purchase history exists after Sync without blocking Instant Checkout.

## Acceptance Criteria

1. **Given** an authorized user  
   **When** they create or edit a Customer  
   **Then** name plus one phone or email is required; other fields are optional. Duplicate exact phone **warns** and still creates (no auto-merge). Cashier can create; cashier **cannot** delete (`AUTH_FORBIDDEN`)

2. **And** cashier can search and attach a Customer before Checkout. Sale can complete **without** a Customer (FR-9–FR-12 unchanged). Attached Sale appears on that Customer’s history after Sync

3. **And** Dashboard and cashier (view) can see that Customer’s Sales, Returns, and total spending. History includes synced offline Sales after Sync. Cashier cannot see cost/margin on this view. Admin can assign a group; missing group does not block attach or Sale

4. **And** offline: previously cached Customer may be attached; **new** Customer create is queued (`customer_create` outbox, AD-14) and does not block the next Sale. Loyalty is not applied. No `shift_id`. Instant Checkout fail-open. Indonesian UI

## Tasks / Subtasks

- [x] Task 1: Domain `evaluateCustomerProfile` (AC: #1)
- [x] Task 2: Schema + CustomersModule (AC: #1–#3)
  - [x] `customers` table; `sales.customer_id` nullable (no FK — sale Sync never waits on Customer)
  - [x] CRUD + history; delete `catalog_admin` only; duplicate-phone warning
  - [x] `AcceptCompleteSale` stores optional `customer_id` without blocking
- [x] Task 3: Cashier local-first + Dashboard (AC: #2–#4)
  - [x] IndexedDB v8 customer cache + `customerCreateOutbox`
  - [x] Cart Panel attach/detach; flush customers → sales → voids
  - [x] Dashboard **Pelanggan**; cashier history view without cost

## Dev Notes

### Scope boundary

| In | Out |
|----|-----|
| Profile, group string, attach, history | Loyalty earn/redeem (7.1) |
| `customer_create` outbox | `customer_update` outbox (edit is online) |
| Optional attach, fail-open | Shift gate (6.2), Store Credit (6.5) |

### Architecture

| Rule | Implication |
|------|-------------|
| AD-14 | `customer_create` same envelope as Sale; Hold is not outbox |
| AD-15 | `CustomersModule` independent; no Cloudinary / ledger writes |
| AD-16 | No `shift_id` until 6.2 |
| AD-18 | Attach optional; Instant Checkout never waits on Customer |
| AD-3 | Sale Sync is never blocked by a queued create |

### References

- [Source: `epics.md` Story 6.1]
- [Source: `prd.md` FR-70–FR-74]
- [Source: `ARCHITECTURE-SPINE.md` AD-3, AD-14, AD-15, AD-18]

## Dev Agent Record

### Agent Model Used

Cursor Grok 4.6 (dev-story)

### Debug Log References

- Domain 33/33, local-db 24/24, API Jest 80/80. Cashier + dashboard `tsc --noEmit` clean.

### Completion Notes List

- `evaluateCustomerProfile`: name + phone or email; invalid email dropped when phone is present (fail-open). Duplicate exact phone warns and still creates.
- `CustomersModule` CRUD + history (no cost). Delete is `catalog_admin` only (`AUTH_FORBIDDEN`). Group assign is admin-only; missing group never blocks.
- `sales.customer_id` is nullable with no FK. Invalid/missing attach still accepts the Sale. Flush order: customer creates → sales → voids.
- Cashier IndexedDB v8 cache + `customerCreateOutbox`. Cart Panel attach is optional. Dashboard **Pelanggan**. Loyalty and Shift are out.

### File List

- packages/domain/src/index.ts
- packages/domain/src/customer-profile.spec.ts
- packages/types/src/index.ts
- packages/local-db/src/db.ts
- packages/local-db/src/customers.ts
- packages/local-db/src/customers.spec.ts
- packages/local-db/src/sales.ts
- packages/local-db/src/parked-carts.ts
- packages/local-db/src/index.ts
- packages/local-db/package.json
- apps/api/src/db/schema.ts
- apps/api/src/db/seed.ts
- apps/api/drizzle/0013_customers.sql
- apps/api/drizzle/meta/_journal.json
- apps/api/src/customers/*
- apps/api/src/app.module.ts
- apps/api/src/sales/sales.service.ts
- apps/api/src/sales/sales.service.spec.ts
- apps/cashier/src/lib/flush-sync.ts
- apps/cashier/src/lib/preferences.ts
- apps/cashier/src/components/cart-context.tsx
- apps/cashier/src/components/cart-panel.tsx
- apps/cashier/src/components/customer-attach.tsx
- apps/cashier/src/components/app-shell.tsx
- apps/cashier/src/app/menu/page.tsx
- apps/cashier/src/app/customers/page.tsx
- apps/dashboard/src/app/customers/page.tsx
- apps/dashboard/src/app/customers-panel.tsx
- apps/dashboard/src/components/dashboard-shell.tsx
- README.md

## Change Log

- 2026-08-13: Story drafted for implementation.
- 2026-08-13: Implemented FR-70–FR-74; review fixes (fail-open email, outbox ack, history merge).
