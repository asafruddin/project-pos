---
baseline_commit: 63dcb8c4f2c623ef6b1dad569ec32d03221577ba
---

# Story 5.1: Suppliers and Purchase Order lifecycle

Status: done

## Story

As purchasing staff,
I want Suppliers and a Purchase Order lifecycle,
so that I can order goods without changing Stock until Goods Receipt (5.2).

## Acceptance Criteria

1. **Given** I am `catalog_admin` on Dashboard (FR-55)  
   **When** I create/edit a Supplier (name, contacts, payment terms, supplied products + cost)  
   **Then** the Supplier list is searchable and a cashier token cannot mutate (API 403)

2. **And** Purchase Order states are Draft → Submitted → Approved → Partially Received → Completed (FR-56). Invalid skips (e.g. Draft → Completed) are rejected. Abandoned Draft (and unapproved Submitted) can be cancelled; cancel does **not** change Stock

3. **And** I can create a PO against a Supplier with lines (product, qty, cost) and submit it (FR-57). Submit does **not** change Stock. Submitted POs are visible to the approver

4. **And** `catalog_admin` approve moves Submitted → Approved with auditable approver (FR-58). Unapproved POs cannot be received (no receive endpoint in this story)

5. **And** Indonesian UI. Purchasing is a **PurchasingModule** (AD-15), not stuffed into Catalog. No `ReceiveGoods`. No Cloudinary. No `shift_id`. Instant Checkout unchanged

## Tasks / Subtasks

- [x] Task 1: Domain PO lifecycle (AC: #2, #3)
  - [x] `transitionPurchaseOrder({ from, to })` allow-list; Indonesian `PO_INVALID_TRANSITION`
  - [x] `validatePurchaseOrderLines` — unique `product_id`, qty integer ≥ 1, `cost_minor` integer ≥ 0
  - [x] Spec `packages/domain/src/purchase-order.spec.ts`

- [x] Task 2: Schema + Purchasing API (AC: #1–#4)
  - [x] Tables: `suppliers`, `supplier_products`, `purchase_orders`, `purchase_order_lines` (`received_qty` default 0 for 5.2). Migration `0009_purchasing.sql`
  - [x] `PurchasingModule` + controller under `/purchasing`. All routes `catalog_admin`
  - [x] Suppliers: list `?q=`, create, patch, get (includes supplied products + PO history)
  - [x] POs: list, create, patch lines (draft only), submit, approve, cancel
  - [x] Status check includes all five live states + `cancelled`. 5.1 API never transitions to `partially_received` / `completed`
  - [x] Unknown supplier → `SUPPLIER_NOT_FOUND`. Unknown PO → `PO_NOT_FOUND`. Unknown product → `CATALOG_NOT_FOUND`

- [x] Task 3: Dashboard (AC: #1, #3, #5)
  - [x] Nav **Pembelian** → `/purchasing` (`catalog_admin` only)
  - [x] Supplier search + form. PO create/submit/approve/cancel. Labels: Draf / Diajukan / Disetujui / Dibatalkan
  - [x] No cashier Menu change. No Goods Receipt UI

- [x] Task 4: Tests + README (AC: #2–#4)
  - [x] Invalid skip rejected; submit/approve do not import/call `insertStockMovement`
  - [x] Cancel draft leaves no movements
  - [x] README purchasing routes

## Dev Notes

### Scope boundary

| In | Out |
|----|-----|
| Supplier CRUD + search | Goods Receipt / STOCK IN (5.2) |
| Draft → Submitted → Approved | Invoice/payment status (FR-61 / 5.2) |
| Cancel draft/submitted | Partially Received / Completed transitions |
| PurchasingModule | Catalog/Inventory stuffing |

### Architecture

| Rule | Implication |
|------|-------------|
| AD-15 | New `PurchasingModule`; do not add PO tables to CatalogModule |
| AD-4 | This story must not INSERT `stock_movements` |
| AD-11 | Approver = `catalog_admin` |
| AD-19 | `store_id` = Store #1 on POs |

### State allow-list (domain)

- `draft` → `submitted` \| `cancelled`
- `submitted` → `approved` \| `cancelled`
- `approved` → `partially_received` \| `completed` (domain only; no 5.1 endpoint)
- `partially_received` → `completed` (domain only)
- Terminal: `completed`, `cancelled`

### Previous story intelligence

- Opname: class-level JWT + method `RolesGuard`; Indonesian errors; cashier nav hidden
- Do not reintroduce `SALE_INSUFFICIENT_STOCK`
- Cost is integer rupiah (`cost_minor`)

### References

- [Source: `epics.md` Story 5.1]
- [Source: `prd.md` FR-55–FR-58]
- [Source: `ARCHITECTURE-SPINE.md` AD-4, AD-11, AD-15, AD-19]
- [Source: `EXPERIENCE.md` Flow 7 — GR is 5.2; this story stops at Approved]

## Dev Agent Record

### Agent Model Used

Cursor Grok 4.6 (dev-story)

### Debug Log References

- API Jest 59/59, domain 19/19. Isolation spec: purchasing does not import stock-ledger or cloudinary.

### Completion Notes List

- `PurchasingModule` owns suppliers + POs. Status machine in `packages/domain`. Submit/approve/cancel never post movements.
- Supplier search `?q=` on name/contact/phone. Get includes supplied products + PO history.
- Dashboard **Pembelian** is catalog_admin only. Goods Receipt deferred to 5.2 (`received_qty` stays 0).

### File List

- packages/domain/src/index.ts
- packages/domain/src/purchase-order.spec.ts
- packages/types/src/index.ts
- apps/api/src/db/schema.ts
- apps/api/drizzle/0009_purchasing.sql
- apps/api/drizzle/meta/_journal.json
- apps/api/src/app.module.ts
- apps/api/src/purchasing/purchasing.module.ts
- apps/api/src/purchasing/purchasing.controller.ts
- apps/api/src/purchasing/purchasing.controller.spec.ts
- apps/api/src/purchasing/purchasing-isolation.spec.ts
- apps/api/src/purchasing/supplier.service.ts
- apps/api/src/purchasing/supplier.service.spec.ts
- apps/api/src/purchasing/purchase-order.service.ts
- apps/api/src/purchasing/purchase-order.service.spec.ts
- apps/api/src/purchasing/dto/purchasing.dto.ts
- apps/dashboard/src/app/purchasing-panel.tsx
- apps/dashboard/src/app/purchasing/page.tsx
- apps/dashboard/src/components/dashboard-shell.tsx
- README.md

## Senior Developer Review (AI)

**Outcome:** Changes Requested → patched
**Date:** 2026-08-13

Layers: Blind Hunter + Edge Case Hunter + Acceptance Auditor.

### Action Items

- [x] Isolation: purchasing sources do not import `stock-ledger` / Cloudinary
- [x] Domain rejects Draft → Completed and cancel-from-Approved
- [x] Submit without lines → `PO_INVALID_LINE`; unknown supplier → `SUPPLIER_NOT_FOUND`
- [x] Supplier form includes contacts + supplied products; list is searchable
- [x] No receive endpoint; Instant Checkout unchanged

Dismissed: Goods Receipt / invoice status (5.2); editing PO lines after create (PATCH exists; create-with-lines covers FR-57).

## Change Log

- 2026-08-13: Suppliers + Purchase Order lifecycle in PurchasingModule; stock unchanged until 5.2 (Story 5.1).
