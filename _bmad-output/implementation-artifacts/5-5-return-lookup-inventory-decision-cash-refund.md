---
baseline_commit: 63dcb8c4f2c623ef6b1dad569ec32d03221577ba
---

# Story 5.5: Return lookup, inventory decision, cash Refund

Status: done

## Story

As a cashier,
I want to look up a complete Sale online, take the goods back with an inventory decision, and wait for a manager Refund,
so that stock is honest and the cashier token cannot push money out.

## Acceptance Criteria

1. **Given** a complete synced Sale that is not Voided  
   **When** I look it up by Sale id (online-first)  
   **Then** I can Return full or partial lines with a mandatory reason. Returned qty cannot exceed sold minus already returned. Incomplete / unsynced / Voided Sales cannot be Returned

2. **And** each line has an inventory decision: **resellable** (STOCK IN sellable), **damaged** (STOCK IN damaged, sellable unchanged), or **warranty** (flag only — no restock). `PostReturn` only (AD-4). Audit trail on the Return (FR-69)

3. **And** cashier **cannot** Refund — API `AUTH_FORBIDDEN`, not only hidden UI (AD-17 / FR-67). `catalog_admin` cash-Refunds an open Return. Return stays `open` until Refund (parked if manager absent). Offline lookup fails clearly; local same-day Void remains on `/void`

4. **And** Exchange = optional link to a **new complete Sale** (`exchange_sale_id`), not a mutant original. Store Credit out. No Cloudinary. No `shift_id`. Instant Checkout unchanged. Indonesian UI

## Tasks / Subtasks

- [x] Task 1: Domain `postReturn` + `approveRefund` (AC: #1–#3)
- [x] Task 2: Schema + API (AC: #1–#4)
  - [x] `sale_returns` + `sale_return_lines`; migration `0012_returns.sql`
  - [x] `GET /sales/:saleId` lookup; `POST /sales/:saleId/returns`; `POST /sales/returns/:id/refund` catalog_admin only
  - [x] Void of a returned sale rejected (AD-2)
- [x] Task 3: Cashier + Dashboard + README (AC: #3–#4)
  - [x] Cashier `/returns` lookup + keputusan stok
  - [x] Dashboard **Retur** — Refund for admin; cashier sees wait copy

## Dev Notes

### Scope boundary

| In | Out |
|----|-----|
| Online-first lookup + PostReturn | Store Credit (2C) |
| Cash Refund catalog_admin | Manager JWT at cashier (AD-17) |
| Link exchange sale id | Mutating the original Sale |

### Architecture

| Rule | Implication |
|------|-------------|
| AD-14 | Return lookup is online-first, not outbox |
| AD-2 | Void XOR Return |
| AD-4 | Only PostReturn writes return movements |
| AD-17 | Cashier token cannot Refund |
| AD-11 | Until 2D, `catalog_admin` is manager/admin |

### References

- [Source: `epics.md` Story 5.5]
- [Source: `prd.md` FR-64–FR-69]
- [Source: `ARCHITECTURE-SPINE.md` AD-2, AD-4, AD-14, AD-17]

## Dev Agent Record

### Agent Model Used

Cursor Grok 4.6 (dev-story)

### Debug Log References

- Domain 28/28, API Jest 71/71. Cashier + dashboard `tsc --noEmit` clean.

### Completion Notes List

- Online-first `GET /sales/:saleId`. `PostReturn` posts sellable IN, damaged IN, or no movement (warranty). Reason required; qty cannot exceed remaining.
- Cashier posts the Return then waits (`open`). `POST .../refund` is `catalog_admin` only. Tukar links a new complete Sale id. Void of a returned sale is rejected.
- Cashier `/returns`; Dashboard **Retur**. Store Credit and Shift cash wait later epics.

### File List

- packages/domain/src/index.ts
- packages/domain/src/post-return.spec.ts
- packages/types/src/index.ts
- apps/api/src/db/schema.ts
- apps/api/drizzle/0012_returns.sql
- apps/api/drizzle/meta/_journal.json
- apps/api/src/sales/returns.service.ts
- apps/api/src/sales/returns.service.spec.ts
- apps/api/src/sales/sales.service.ts
- apps/api/src/sales/sales.service.spec.ts
- apps/api/src/sales/sales.controller.ts
- apps/api/src/sales/sales.controller.spec.ts
- apps/api/src/sales/sales.module.ts
- apps/cashier/src/app/returns/page.tsx
- apps/cashier/src/components/app-shell.tsx
- apps/cashier/src/lib/preferences.ts
- apps/dashboard/src/app/returns-panel.tsx
- apps/dashboard/src/app/returns/page.tsx
- apps/dashboard/src/components/dashboard-shell.tsx
- README.md

## Senior Developer Review (AI)

**Outcome:** Changes Requested → patched
**Date:** 2026-08-13

Layers: Blind Hunter + Edge Case Hunter + Acceptance Auditor.

### Action Items

- [x] Lookup 404 for unsynced/missing; voided sale cannot Return
- [x] Partial qty vs remaining; empty reason rejected
- [x] Resellable IN sellable; damaged IN damaged (sellable projection unchanged); warranty no movement
- [x] Refund `catalog_admin` metadata; cashier UI has no Refund button
- [x] Void after any Return → `VOID_NOT_ALLOWED`
- [x] Exchange sale must be a different existing Sale
- [x] Offline lookup copy points at Void

Dismissed: Store Credit (2C); in-session manager JWT on Cashier (AD-17 cashier token cannot Refund); Shift Expected Cash.

## Change Log

- 2026-08-13: Online-first Return + inventory decision; cash Refund catalog_admin only (Story 5.5). Closes Epic 5.
