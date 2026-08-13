---
baseline_commit: 63dcb8c4f2c623ef6b1dad569ec32d03221577ba
---

# Story 5.2: Goods Receipt posts STOCK IN

Status: done

## Story

As purchasing staff,
I want to receive goods against an Approved Purchase Order,
so that Stock IN hits the ledger without a general ledger.

## Acceptance Criteria

1. **Given** an Approved PO (FR-59)  
   **When** I record a Goods Receipt (partial OK)  
   **Then** partial → `partially_received` with remaining qty open; full receipt of all lines → `completed`

2. **And** each received line posts STOCK IN sellable via `ReceiveGoods` only (AD-4 / FR-60). Overview sellable increases by received qty. Unapproved PO cannot be received

3. **And** I can set invoice reference + payment status (`unpaid` \| `partial` \| `paid`) without GL (FR-61). PO may be Completed for Stock while still unpaid

4. **And** over-receive vs remaining ordered qty is rejected. Dashboard only (online-first). Cashier Instant Checkout unchanged. No Cloudinary. No `shift_id`

5. **And** Indonesian UI. `catalog_admin` only

## Tasks / Subtasks

- [x] Task 1: Domain `receiveGoods` (AC: #1–#2, #4)
  - [x] Lines `{ receive_qty, ordered_qty, received_qty }`; qty integer ≥ 1; qty ≤ remaining
  - [x] PO must be `approved` or `partially_received`; result status completed vs partially_received
  - [x] Spec `packages/domain/src/receive-goods.spec.ts`

- [x] Task 2: Schema + API (AC: #1–#3)
  - [x] `goods_receipts` + `goods_receipt_lines`; PO `invoice_ref` + `payment_status` (default `unpaid`). Migration `0010_goods_receipt.sql`
  - [x] `POST /purchasing/purchase-orders/:poId/receipts` `{ lines: [{ product_id, qty }] }` — TX: increment `received_qty`, STOCK IN `source_type=goods_receipt`, `stock_qty += qty`, status
  - [x] `PATCH /purchasing/purchase-orders/:poId/invoice` `{ invoice_ref?, payment_status? }` — no movements
  - [x] Draft/submitted/cancelled/completed → `PO_NOT_RECEIVABLE`. Over-receive → `GR_INVALID`
  - [x] Only `goods-receipt.service.ts` in Purchasing imports `insertStockMovement`

- [x] Task 3: Dashboard (AC: #1, #3, #5)
  - [x] On Disetujui / Diterima sebagian: **Terima** qty per line (show sisa), **Nomor faktur**, **Status bayar**
  - [x] No cashier Menu change

- [x] Task 4: Tests + README (AC: #1–#4)
  - [x] Partial then remaining → completed; movements posted
  - [x] Unapproved receive rejected; invoice patch posts no movements
  - [x] README GR + invoice routes

## Dev Notes

### Scope boundary

| In | Out |
|----|-----|
| ReceiveGoods STOCK IN | Hold/Void/Return (5.3–5.5) |
| Invoice ref + payment status | Bank/GL |
| Partial receive | Offline Dashboard receiving |

### Architecture

| Rule | Implication |
|------|-------------|
| AD-4 | Only `ReceiveGoods` inserts GR movements |
| AD-13 | sellable SUM increases |
| AD-15 | Stay in PurchasingModule |
| AD-19 | Store #1 |

### Previous story intelligence

- 5.1: `received_qty` already 0; domain already allows `approved → partially_received \| completed`
- Isolation spec must allow ledger import **only** in `goods-receipt.service.ts`
- Reason copy: `penerimaan barang`

### References

- [Source: `epics.md` Story 5.2]
- [Source: `prd.md` FR-59–FR-61, UJ-6]
- [Source: `ARCHITECTURE-SPINE.md` AD-4, AD-13, AD-15]

## Dev Agent Record

### Agent Model Used

Cursor Grok 4.6 (dev-story)

### Debug Log References

- API Jest 62/62, domain 22/22. Isolation: only `goods-receipt.service.ts` imports `insertStockMovement`.

### Completion Notes List

- `ReceiveGoods` posts sellable STOCK IN (`source_type=goods_receipt`, reason `penerimaan barang`). Partial → `partially_received`; all lines filled → `completed`.
- Over-receive and unapproved PO rejected. Invoice ref + payment status do not move stock; completed may stay unpaid.
- Dashboard **Terima** / **Nomor faktur** / **Status bayar** on Pembelian. Cashier Instant Checkout unchanged.

### File List

- packages/domain/src/index.ts
- packages/domain/src/receive-goods.spec.ts
- packages/types/src/index.ts
- apps/api/src/db/schema.ts
- apps/api/drizzle/0010_goods_receipt.sql
- apps/api/drizzle/meta/_journal.json
- apps/api/src/purchasing/goods-receipt.service.ts
- apps/api/src/purchasing/goods-receipt.service.spec.ts
- apps/api/src/purchasing/purchase-order.service.ts
- apps/api/src/purchasing/purchasing.controller.ts
- apps/api/src/purchasing/purchasing.controller.spec.ts
- apps/api/src/purchasing/purchasing.module.ts
- apps/api/src/purchasing/purchasing-isolation.spec.ts
- apps/api/src/purchasing/dto/purchasing.dto.ts
- apps/dashboard/src/app/purchasing-panel.tsx
- apps/dashboard/src/app/purchasing/page.tsx
- README.md

## Senior Developer Review (AI)

**Outcome:** Changes Requested → patched
**Date:** 2026-08-13

Layers: Blind Hunter + Edge Case Hunter + Acceptance Auditor.

### Action Items

- [x] Only `goods-receipt.service.ts` imports the stock ledger
- [x] Draft receive → `PO_NOT_RECEIVABLE`; over-receive → `GR_INVALID`
- [x] Partial receive posts positive sellable delta; invoice patch posts nothing
- [x] Status: approved+partial → `partially_received`; remaining filled → `completed`
- [x] Completed stock allowed while `payment_status=unpaid`

Dismissed: hold/park (5.3); Void (5.4); GL posting.

## Change Log

- 2026-08-13: Goods Receipt via ReceiveGoods posts STOCK IN; invoice status is not stock (Story 5.2).
