---
baseline_commit: 63dcb8c4f2c623ef6b1dad569ec32d03221577ba
---

# Story 4.6: Stock Opname

Status: done

## Story

As inventory staff,
I want to count, see variance, and get manager approval,
so that physical count becomes auditable Stock Adjustments.

## Acceptance Criteria

1. **Given** I am `catalog_admin` on Dashboard (FR-51)  
   **When** I create a Stock Opname for Store #1 and selected products  
   **Then** the draft lists those products with **system qty** = sellable ledger `SUM` at create time, and **Stock is unchanged**

2. **And** I can enter counted qty; variance = counted − system (FR-52). Saving counts without approve leaves Stock unchanged

3. **And** `catalog_admin` approve runs `ApplyOpname` (AD-4): each line posts a sellable movement so Overview matches **counted** qty; reject/cancel leaves Stock unchanged (FR-53)

4. **And** Cashier PWA has no Opname flow (FR-54). Instant Checkout still does not hard-block on qty (AD-4). No Cloudinary. No `shift_id`

5. **And** Indonesian UI. Cashier Dashboard role cannot mutate Opname (API 403)

## Tasks / Subtasks

- [x] Task 1: Domain `applyOpname` (AC: #3)
  - [x] Pure function: lines `{ product_id, counted_qty, current_qty }` → `qty_delta = counted − current`; counted integer ≥ 0; at least one line
  - [x] Spec `packages/domain/src/apply-opname.spec.ts`

- [x] Task 2: Schema + types + API (AC: #1–#3, #5)
  - [x] `stock_opnames` + `stock_opname_lines`; migration `0008_stock_opname.sql`
  - [x] Status `draft | approved | rejected | cancelled`. Store #1 only
  - [x] `POST /inventory/opnames` `{ product_ids }` snapshots sellable SUM; no movements
  - [x] `PATCH /inventory/opnames/:id/counts` `{ lines: [{ product_id, counted_qty }] }` draft only
  - [x] `POST .../approve` `ApplyOpname` + movements `source_type=opname` `source_id=opname_id` `reason=opname stok`; `stock_qty` = counted
  - [x] `POST .../reject` and `POST .../cancel` draft → terminal; no movements
  - [x] `GET` list + detail. All Opname routes `catalog_admin`. Unknown → `OPNAME_NOT_FOUND`. Non-draft mutate → `OPNAME_NOT_DRAFT`

- [x] Task 3: Dashboard (AC: #1–#5)
  - [x] Nav **Opname stok** → `/opname` (catalog_admin only)
  - [x] Create (select products), enter **Dihitung**, show **Selisih**, **Simpan**, **Setujui** / **Tolak** / **Batalkan**
  - [x] No cashier Menu / checkout change

- [x] Task 4: Tests + README (AC: #1–#4)
  - [x] Draft create/save does not insert movements
  - [x] Approve posts deltas; overview sellable becomes counted
  - [x] Reject/cancel inserts nothing
  - [x] README Opname routes

## Dev Notes

### Scope boundary

| In | Out |
|----|-----|
| Draft count + approve/reject/cancel | Count-on-POS |
| ApplyOpname sellable only | Damaged/in-transit count |
| Store #1 | Multi-store (7.5) |

### Architecture

| Rule | Implication |
|------|-------------|
| AD-4 | Only `ApplyOpname` (plus existing named commands) writes qty |
| AD-13 | Snapshot and approve current qty from ledger SUM sellable |
| AD-19 | Store #1 |
| AD-11 | Approver is `catalog_admin` until 2D |

### Approve vs snapshot

Display variance against **create-time** system qty (FR-52). On approve, re-read current sellable SUM and post `counted − current` so Overview matches counted even if sales landed after create (FR-53).

### Previous story intelligence

- 4.5 Overview / MarkDamaged: reason required; ledger SUM; cashier may view overview but not mutate
- Do not reintroduce `SALE_INSUFFICIENT_STOCK`
- Alasan copy already used; Opname approve uses server reason `opname stok`

### References

- [Source: `epics.md` Story 4.6]
- [Source: `prd.md` FR-51–FR-54, UJ-5]
- [Source: `ARCHITECTURE-SPINE.md` AD-4, AD-11, AD-13]
- [Source: `EXPERIENCE.md` Flow 6]

## Dev Agent Record

### Agent Model Used

Cursor Grok 4.6 (dev-story)

### Debug Log References

- API Jest 51/51 (opname 6), domain 14/14 (incl. apply-opname), local-db 10/10.

### Completion Notes List

- Draft create snapshots sellable `SUM` at Store #1; save counts / reject / cancel insert no movements.
- Approve runs `applyOpname` against current ledger SUM so Overview matches counted; movements `source_type=opname`, reason `opname stok`.
- Dashboard **Opname stok** is catalog_admin only. Cashier PWA unchanged. No Cloudinary. No `shift_id`.

### File List

- packages/domain/src/index.ts
- packages/domain/src/apply-opname.spec.ts
- packages/types/src/index.ts
- apps/api/src/db/schema.ts
- apps/api/drizzle/0008_stock_opname.sql
- apps/api/drizzle/meta/_journal.json
- apps/api/src/inventory/opname.service.ts
- apps/api/src/inventory/opname.service.spec.ts
- apps/api/src/inventory/inventory.controller.ts
- apps/api/src/inventory/inventory.controller.spec.ts
- apps/api/src/inventory/inventory.module.ts
- apps/api/src/inventory/dto/create-opname.dto.ts
- apps/api/src/inventory/dto/save-opname-counts.dto.ts
- apps/dashboard/src/app/opname-panel.tsx
- apps/dashboard/src/app/opname/page.tsx
- apps/dashboard/src/components/dashboard-shell.tsx
- README.md

## Senior Developer Review (AI)

**Outcome:** Changes Requested → patched
**Date:** 2026-08-13

Layers: Blind Hunter + Edge Case Hunter + Acceptance Auditor.

### Action Items

- [x] `loadDetail` uses one `getDb()` handle (header + lines)
- [x] Draft create/save/reject do not call `insertStockMovement`
- [x] Approve posts `counted − current` sellable; zero delta skips insert but still sets `stock_qty`
- [x] Opname API is `catalog_admin`; cashier Dashboard has no Opname nav
- [x] Instant Checkout / Cloudinary / `shift_id` untouched

Dismissed: count-on-POS; damaged-bucket opname; multi-store.

## Change Log

- 2026-08-13: Stock Opname draft/count/approve via ApplyOpname; Dashboard Opname stok (Story 4.6). Closes Epic 4.
