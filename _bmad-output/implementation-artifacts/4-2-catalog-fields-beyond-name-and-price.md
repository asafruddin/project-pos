---
baseline_commit: pending
---

# Story 4.2: Catalog fields beyond name and price

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a catalog_admin,
I want SKU, barcode, description, category, brand, tags, status, cost, min/max, and Variants,
so that Cashier Menu can sell a Variant `product_id` without a live round-trip.

## Acceptance Criteria

1. **Given** I am `catalog_admin` on Dashboard  
   **When** I edit catalog fields (FR-33–FR-37)  
   **Then** I can maintain name, SKU, barcode, description, category, brand, tags, status (active/inactive), cost, selling price, optional compare-at, min/max, and track-stock

2. **And** inactive products are **not selectable** on Cashier Menu after catalog refresh (FR-33)

3. **And** when Variants exist, line `product_id` is the **Variant’s** id — parent is not added to Cart Panel (FR-37 / AD-13)

4. **And** missing optional fields (barcode, brand, SKU, images) never block Instant Checkout (FR-38)

5. **And** SKU is unique per catalog when present `[ASSUMPTION: unique per company]` — multiple NULL SKUs allowed

6. **And** Cashier Menu uses selling `price_minor`, never cost (FR-34). Cost is Dashboard `catalog_admin` only (GET list for cashier must not require cost; omit or null is fine)

7. **And** Story 4.1 ledger still applies: variant/simple product rows are the `product_id` on movements; parent rows are not sold. Do not invent a second qty writer.

8. **And** existing Instant Checkout / Sync / Day Close still work (SM-2). No Cloudinary (4.3). No Opname (4.6).

## Tasks / Subtasks

- [x] Task 1: Schema (AC: #1, #5, #7)
  - [x] `categories` (`category_id` UUID PK, `name` unique text) and `brands` (`brand_id` UUID PK, `name` unique text)
  - [x] Extend `products`: `sku` text NULL, `barcode` text NULL, `description` text NULL, `status` text NOT NULL default `active` CHECK (`active`|`inactive`), `cost_minor` int NULL ≥0, `compare_at_minor` int NULL ≥0, `min_qty` int NULL, `max_qty` int NULL, `track_stock` boolean NOT NULL default true, `parent_id` UUID NULL FK → products, `category_id` UUID NULL FK → categories, `brand_id` UUID NULL FK → brands, `tags` text[] NOT NULL default `'{}'`
  - [x] UNIQUE on `products.sku` (Postgres: multiple NULLs OK)
  - [x] Migration `apps/api/drizzle/0006_*.sql`; do not edit 0000–0005
  - [x] Existing rows: `status=active`, `track_stock=true`, other new fields NULL. Opening ledger from 4.1 unchanged

- [x] Task 2: Types (AC: #1–#3)
  - [x] Extend `Product` in `@pos-apps/types` with the new optional fields + `parent_id` + `status`
  - [x] `CreateProductRequest` / `UpdateProductRequest` include optional catalog fields; create still requires name, `price_minor`, `stock_qty` (4.1 opening movement)
  - [x] `ProductStatus = "active" | "inactive"`
  - [x] Variant create: `parent_id` set; parent itself is not sellable once it has ≥1 child

- [x] Task 3: API Catalog (AC: #1, #5, #6)
  - [x] DTOs with class-validator; SKU trim; duplicate SKU → `{ code: "CATALOG_SKU_CONFLICT", message }` 409
  - [x] Create/update persist new fields. Status default `active`
  - [x] Category/brand: create-or-assign by name **or** id — pick one and document. Block delete of category/brand still assigned (FR-36) if you add DELETE; if no DELETE this story, skip
  - [x] `GET /catalog/products` returns all products for Dashboard (including inactive + parents)
  - [x] Roles unchanged (1.4). Cashier GET list allowed — include `status` / `parent_id` so Local DB can filter. **Do not** send a requirement that cost is displayed on Cashier
  - [x] Create variant: `POST` with `parent_id` + name/price/stock; posts 4.1 `initial_stock` movement on the **variant** row
  - [x] Creating a parent-only row (no sellable price required if it won't be sold) — keep it simple: parents are normal products; Cashier hides them when they have children. Parent can keep price_minor ≥ 0

- [x] Task 4: Dashboard (AC: #1, #6)
  - [x] Indonesian labels: **SKU**, **Barcode**, **Deskripsi**, **Kategori**, **Merek**, **Tag**, **Status** (Aktif/Nonaktif), **Harga modal**, **Harga banding**, **Stok min**, **Stok max**
  - [x] Cost visible only when `canMutate` (catalog_admin). Cashier view-only list may hide **Harga modal**
  - [x] Variants: on a product, “Tambah varian” creates a child with `parent_id`. List shows parent name + variant name
  - [x] Status Nonaktif still listed on Dashboard
  - [x] shadcn; no Cloudinary upload (4.3)

- [x] Task 5: Cashier Local Database + Menu (AC: #2–#4)
  - [x] Bump `LOCAL_DB_VERSION` (v3 → v4). On upgrade, existing catalog rows: treat missing `status` as `active`, missing `parentId` as sellable
  - [x] `CatalogProductRecord` adds `status`, `parentId`, `sku?`, `categoryName?` (enough to filter/group). Cost **not** stored locally
  - [x] `replaceCatalog` writes new fields from `Product`
  - [x] `listCatalogProducts` (Menu) returns only **sellable**: `status === "active"` AND product is not a parent-of-variants (no other cached row has this id as `parentId`)
  - [x] Add-to-cart still uses `productId` of the listed (variant or simple) row — that id is the sale line and ledger id
  - [x] Missing SKU/barcode/brand must not block add-to-cart or checkout
  - [x] Category grouping on Menu is nice-to-have; filter by category **if** cheap, else skip (FR-36 “can filter” — add a simple category chips row if `categoryName` present)

- [x] Task 6: Tests + README (AC: #5, #8)
  - [x] API: duplicate SKU → 409; inactive product returned on Dashboard GET
  - [x] Domain/local-db: sellable filter hides inactive and parents-with-children
  - [x] AdjustStock / Sync still work on variant `product_id`
  - [x] README: catalog fields, SKU unique, parent vs variant, cashier filter rules

## Dev Notes

### Scope boundary

| In | Out |
|----|-----|
| Catalog fields FR-33–FR-37 | Product Media / Cloudinary (4.3) |
| Inactive hide on Menu after refresh | Image cache (4.4) |
| Variants as child `products.parent_id` | Damaged / Opname (4.5–4.6) |
| SKU unique when set | Store-specific price (FR-106 / 7.5) |
| | Shift (6.2) |

### Current state (must not break)

- `products` has name, price_minor, stock_qty (projection), timestamps. Ledger in `stock_movements` (Story 4.1)
- Cashier `replaceCatalog` copies `product_id`, name, price_minor, stock_qty only (`packages/local-db/src/catalog.ts`)
- Menu `listCatalogProducts()` shows every cached row (`apps/cashier/src/app/menu/page.tsx`)
- `PUT /stock` requires `reason` (4.1). Keep that
- IndexedDB v3 — bump to v4 with additive fields on catalog records (idb upgrade: recreate not required if you only add JS fields on put; **still bump version** so old records get defaults on next pull)

### Architecture

| Rule | Implication |
|------|-------------|
| AD-9 | Menu reads Local DB only after pull. Filter sellable **locally**, not via a live API round-trip at checkout |
| AD-10 | Line still snapshots `price_minor` at complete |
| AD-13 | Sellable id = variant/simple `product_id`. Parent is not sold |
| AD-4 | Variant create posts `initial_stock` via existing CatalogService.create path |
| FR-38 | Optional fields never required on Instant Checkout |

### Variant model (do not invent a second products table)

```text
products.parent_id  → products.product_id  NULL = simple or parent
Sellable iff status=active AND no other product has parent_id = this.product_id
```

A parent with variants: Dashboard edits parent metadata; cashier never lists the parent. Each variant has its own stock_qty projection + movements.

### Previous story intelligence (4.1)

- AdjustStock `{ stock_qty, reason }`; skip PUT when qty unchanged; Alasan before PATCH
- Negative projection possible; Dashboard `parseIntQty` on edit
- `insertStockMovement` helper; Store #1 on sales
- Tests must assert movement payload if you touch create-with-stock
- Do not reintroduce `SALE_INSUFFICIENT_STOCK`

### Git / stack

- drizzle-orm 0.45.1 / drizzle-kit 0.30.6; next migration `0006_*`
- Nest 11, Next 16 cashier/dashboard, `@pos-apps/local-db` idb
- No new npm packages

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` Story 4.2]
- [Source: `prd.md` FR-33–FR-38]
- [Source: `ARCHITECTURE-SPINE.md` AD-9, AD-13]
- [Source: `packages/local-db/src/catalog.ts` current pull]
- [Source: `_bmad-output/implementation-artifacts/4-1-store-stub-stock-ledger-and-opening-movements.md`]

## Dev Agent Record

### Agent Model Used

Cursor Grok 4.6 (dev-story)

### Debug Log References

- Domain 10/10, API Jest 30/30, local-db pin/day-close/sellable passing after catalog fields + review patches.

### Completion Notes List

- Categories/brands by name (`ensureNamed`). SKU unique → `CATALOG_SKU_CONFLICT`. Invalid/self `parent_id` → `CATALOG_INVALID_PARENT`. Category/brand unique clashes are not reported as SKU conflicts.
- Dashboard: SKU/barcode/deskripsi/kategori/merek/tag/status/modal/banding/min-max/lacak stok + **Tambah varian**. List shows parent · variant name. Inactive remains listed.
- Cashier Local DB v4 sellable filter; cart `pruneToSellable` after catalog refresh so inactive/parent rows leave the cart.
- No Cloudinary (4.3). Instant Checkout unchanged (FR-38).

### File List

- apps/api/drizzle/0006_catalog_fields.sql
- apps/api/drizzle/meta/_journal.json
- apps/api/src/db/schema.ts
- apps/api/src/catalog/catalog.service.ts
- apps/api/src/catalog/catalog.controller.ts
- apps/api/src/catalog/catalog.service.spec.ts
- apps/api/src/catalog/catalog.controller.spec.ts
- apps/api/src/catalog/dto/create-product.dto.ts
- apps/api/src/catalog/dto/update-product.dto.ts
- packages/types/src/index.ts
- packages/local-db/src/db.ts
- packages/local-db/src/catalog.ts
- packages/local-db/src/catalog-sellable.spec.ts
- packages/local-db/package.json
- apps/dashboard/src/app/products-panel.tsx
- apps/cashier/src/app/menu/page.tsx
- apps/cashier/src/components/cart-context.tsx
- README.md

## Senior Developer Review (AI)

**Outcome:** Changes Requested → patched
**Date:** 2026-08-13

Layers: Blind Hunter + Edge Case Hunter + Acceptance Auditor (all ran).

### Action Items

- [x] Cart prune after catalog refresh (`pruneToSellable`)
- [x] Invalid / self `parent_id` → `CATALOG_INVALID_PARENT` (FK 23503 + assert)
- [x] Unique violations mapped by constraint (SKU vs category vs brand)
- [x] Dashboard min/max invalid values no longer silently null; int32 bounds
- [x] DTO `@Min`/`@Max` on min/max qty
- [x] `track_stock` checkbox (**Lacak stok**)
- [x] **Tambah varian** + list parent · variant name
- [x] API tests: duplicate SKU 409; inactive on Dashboard GET; cashier omits cost
- [x] SQL CHECKs for `cost_minor` / `compare_at_minor` ≥ 0; schema `parentId` FK

Dismissed: Cloudinary (4.3); cashier durable image cache (4.4).

## Change Log

- 2026-08-13: Catalog fields, variants, sellable Menu filter, and review patches (Story 4.2).
