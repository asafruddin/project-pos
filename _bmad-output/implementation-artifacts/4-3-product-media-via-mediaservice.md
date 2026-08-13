---
baseline_commit: 63dcb8c4f2c623ef6b1dad569ec32d03221577ba
---

# Story 4.3: Product Media via MediaService

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a catalog_admin,
I want to upload primary + gallery images through the API,
so that Cloudinary is never on the cashier transaction path.

## Acceptance Criteria

1. **Given** Cloudinary credentials in API secrets (`cloudinary` npm 2.10.x, v2 API)  
   **When** I upload / reorder / set-primary / delete images (FR-39–FR-43)  
   **Then** only `MediaService` (and its Cloudinary adapter) imports the Cloudinary SDK (AD-12)

2. **And** POS DB stores references: `public_id`, `secure_url`, width, height, format, bytes, alt, sort, primary — not pixel-size duplicates

3. **And** delete unlinks the catalog row and deletes the provider object; if provider delete fails, enqueue a retry (no orphans)

4. **And** reorder and set-primary are DB-only (no re-upload)

5. **And** publishing / saving without a primary image **warns**, does not hard-block (FR-40)

6. **And** Catalog and Sales modules do not `import "cloudinary"`. Checkout / payment / Receipt / Sync make no Media Provider call

7. **And** Story 4.1 ledger and 4.2 catalog fields still work. No cashier durable image cache (that's 4.4). No Opname (4.6)

## Tasks / Subtasks

- [x] Task 1: Schema (AC: #2, #3)
  - [x] `product_images`: `image_id` UUID PK, `product_id` FK → products, `public_id` text NOT NULL unique, `secure_url` text NOT NULL, `width`/`height`/`bytes` int NULL, `format` text NULL, `alt_text` text NULL, `sort_order` int NOT NULL default 0, `is_primary` boolean NOT NULL default false, timestamps
  - [x] Partial unique: one primary per product (`WHERE is_primary = true`)
  - [x] `media_delete_retries`: `retry_id` UUID PK, `public_id` text NOT NULL, `attempts` int NOT NULL default 0, `last_error` text NULL, `created_at`
  - [x] Migration `apps/api/drizzle/0007_*.sql`; do not edit 0000–0006

- [x] Task 2: Types (AC: #1, #2)
  - [x] `ProductImage` in `@pos-apps/types`
  - [x] `Product.images: ProductImage[]` (empty array default)
  - [x] `Product.has_primary_image: boolean` for Dashboard warn

- [x] Task 3: MediaService isolation (AC: #1, #3, #6)
  - [x] Add `cloudinary@2.10.0` to `apps/api` only
  - [x] `apps/api/src/media/cloudinary.adapter.ts` is the **only** file that imports `cloudinary`
  - [x] `MediaService`: `uploadImage(buffer, folder)`, `destroyImage(publicId)`, `deliveryUrl(publicId)` with `q_auto,f_auto`, `retryPendingDeletes()`
  - [x] Folder: `pos/products/{productId}/`
  - [x] Missing credentials → `{ code: "MEDIA_NOT_CONFIGURED" }` 503 on upload/delete-provider (DB unlink still proceeds on delete if already stored)
  - [x] Env: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`

- [x] Task 4: API (AC: #1–#5)
  - [x] `POST /catalog/products/:productId/images` multipart field `file` (jpeg/png/webp/gif, max 8 MiB), optional `alt_text`. First image becomes primary
  - [x] `PATCH /catalog/products/:productId/images/reorder` `{ image_ids: uuid[] }`
  - [x] `PATCH /catalog/products/:productId/images/:imageId` `{ is_primary?: true, alt_text? }` — set-primary unsets siblings in one TX
  - [x] `DELETE /catalog/products/:productId/images/:imageId` — delete DB row then provider destroy; on destroy fail insert `media_delete_retries`
  - [x] `GET /catalog/products` includes `images` + `has_primary_image`. Cashier GET still strips `cost_minor`
  - [x] Roles: mutate images = `catalog_admin` (same as 1.4). GET list unchanged
  - [x] Create/update product **must not** 400 for missing primary

- [x] Task 5: Dashboard (AC: #5)
  - [x] On an existing product: upload, gallery thumbs, **Utama**, **Hapus**, reorder up/down
  - [x] Indonesian labels. Warn (not block) when Status Aktif and no primary: copy like “Produk aktif tanpa gambar utama. Kasir tetap bisa menjual.”
  - [x] Multipart must not force `Content-Type: application/json`
  - [x] No cashier Menu image cache (4.4)

- [x] Task 6: Tests + README (AC: #6, #7)
  - [x] MediaService unit: upload delegates to adapter; destroy fail → retry row; set-primary is DB-only (adapter.destroy not called)
  - [x] Grep/test: `cloudinary` import only in adapter
  - [x] Catalog/Sales specs still pass
  - [x] README: media routes, env vars, isolation rule

## Dev Notes

### Scope boundary

| In | Out |
|----|-----|
| Upload/reorder/primary/delete via API | Cashier durable image cache (4.4) |
| Cloudinary adapter + retry orphans | Category/brand/store/promo folders as a 2A gate |
| Dashboard gallery + warn-not-block | Instant Checkout changes |
| `product_images` refs | Separate 150/400/800px stored files |

### Architecture

| Rule | Implication |
|------|-------------|
| AD-12 | Only `cloudinary.adapter.ts` imports the SDK |
| FR-40 | Dashboard warns; API never 400s for missing primary |
| FR-43 | DB unlink first; provider destroy or `media_delete_retries` |
| AD-4 | No qty writer |

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` Story 4.3]
- [Source: `prd.md` FR-39–FR-43]
- [Source: `ARCHITECTURE-SPINE.md` AD-12]
- [Source: `_bmad-output/implementation-artifacts/4-2-catalog-fields-beyond-name-and-price.md`]

## Dev Agent Record

### Agent Model Used

Cursor Grok 4.6 (dev-story)

### Debug Log References

- API Jest 36/36, local-db 5/5, domain 10/10 after MediaService + isolation spec.

### Completion Notes List

- `cloudinary@2.10.0` in `apps/api` only. Sole SDK import: `cloudinary.adapter.ts`.
- `product_images` + `media_delete_retries`. Upload folder `pos/products/{productId}`. Delivery `q_auto,f_auto`.
- Delete unlinks DB then destroy; destroy fail → retry row. Insert fail after upload → destroy or retry (no orphans).
- Reorder / set-primary are DB-only. First image is primary. Missing credentials → `MEDIA_NOT_CONFIGURED` 503 on upload.
- Dashboard: gallery on saved products; warn (not block) when Aktif without primary. FormData does not force JSON Content-Type.
- Cashier image cache deferred to 4.4. GET may include image URLs; checkout still has no Cloudinary call.

### File List

- apps/api/package.json
- pnpm-lock.yaml
- apps/api/drizzle/0007_product_media.sql
- apps/api/drizzle/meta/_journal.json
- apps/api/src/db/schema.ts
- apps/api/src/app.module.ts
- apps/api/src/media/cloudinary.adapter.ts
- apps/api/src/media/media.module.ts
- apps/api/src/media/media.service.ts
- apps/api/src/media/media.service.spec.ts
- apps/api/src/media/media-isolation.spec.ts
- apps/api/src/catalog/catalog.module.ts
- apps/api/src/catalog/catalog.service.ts
- apps/api/src/catalog/catalog.controller.ts
- apps/api/src/catalog/catalog.service.spec.ts
- apps/api/src/catalog/catalog.controller.spec.ts
- apps/api/src/catalog/dto/product-image.dto.ts
- packages/types/src/index.ts
- apps/dashboard/src/app/products-panel.tsx
- .env.example
- README.md

## Senior Developer Review (AI)

**Outcome:** Changes Requested → patched
**Date:** 2026-08-13

Layers: Blind Hunter + Edge Case Hunter + Acceptance Auditor (implemented in-session after 4.2 review pattern).

### Action Items

- [x] Isolation: only `cloudinary.adapter.ts` imports `cloudinary` (spec walks `src/`)
- [x] Destroy failure enqueues `media_delete_retries`; catalog row already unlinked
- [x] Set-primary / reorder never call adapter upload/destroy
- [x] Insert-after-upload failure destroys provider object or enqueues retry
- [x] Dashboard warn-not-block; FormData without JSON Content-Type
- [x] Cashier GET still omits `cost_minor`; no Local DB image cache (4.4)

Dismissed: durable cashier image bytes (Story 4.4); category/brand/store folders (not a 2A gate).

## Change Log

- 2026-08-13: Product Media via MediaService + Cloudinary adapter, orphan retry, Dashboard gallery (Story 4.3).
