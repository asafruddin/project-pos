---
baseline_commit: 63dcb8c4f2c623ef6b1dad569ec32d03221577ba
---

# Story 4.4: Catalog refresh caches images on Cashier

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a cashier,
I want Menu images from Local Database after catalog refresh,
so that airplane-mode still sells when the CDN is down.

## Acceptance Criteria

1. **Given** a successful catalog refresh (AD-9)  
   **When** the device is offline or Cloudinary is down  
   **Then** Cashier Menu renders cached primary images or a placeholder (FR-41)

2. **And** add-to-cart is never blocked by a missing/failed image (FR-40)

3. **And** Checkout, payment, Receipt, and Sync make **no** Media Provider request (FR-41 / FR-42 / SM-10)

4. **And** catalog refresh stores image **bytes** in Local Database (not live `<img src={cdn}>` after pull)

5. **And** Instant Checkout / Sync / Day Close still work (SM-2). No Opname (4.6). No Cloudinary SDK in cashier

## Tasks / Subtasks

- [x] Task 1: API bytes for pull (AC: #3, #4)
  - [x] `GET /catalog/products/:productId/images/:imageId/file` — authenticated (cashier OK, same as list). MediaService fetches delivery bytes server-side. Do **not** import `cloudinary` in Catalog/Sales
  - [x] Missing image → 404 `MEDIA_NOT_FOUND`. Provider down → 502 `MEDIA_UNAVAILABLE` (clear message). Never 500 as a sell-path blocker
  - [x] Response is the image body (`Content-Type` from format). No JSON wrapper

- [x] Task 2: Local DB image cache (AC: #1, #4)
  - [x] Bump `LOCAL_DB_VERSION` v4 → v5. New store `catalogImages` keyed by `productId`
  - [x] Record: `{ productId, publicId, mimeType, bytes: ArrayBuffer, cachedAt }`
  - [x] `cacheCatalogImages(products)` after `replaceCatalog`: for each product, cache primary (else first) image via the **API file** endpoint. Skip refetch if `publicId` unchanged. Drop cache rows for products no longer in the pull. Fetch failure → keep previous bytes if any, else no row
  - [x] Timeout (~8s) per image. Skip bodies larger than 2 MiB
  - [x] `getCatalogImageRecord(productId)` reads IndexedDB only — **no network**

- [x] Task 3: Cashier Menu (AC: #1–#3)
  - [x] After successful pull: `replaceCatalog` then `cacheCatalogImages` (best-effort; catalog rows still saved if image fetch fails)
  - [x] Tile shows cached image or placeholder. Button remains clickable without waiting for the image
  - [x] Never set `<img src>` to Cloudinary/`secure_url` on Menu, Cart, Checkout, Receipt
  - [x] Revoke object URLs on unmount

- [x] Task 4: Tests + README (AC: #2, #5)
  - [x] Pure cache sync: fetch primary; skip same `publicId`; failed fetch keeps old; missing image does not throw
  - [x] Isolation: `cloudinary` still only in adapter; cashier/local-db do not import it
  - [x] Sellable filter unchanged (4.2). README: pull caches bytes; airplane-mode Menu uses cache/placeholder

## Dev Notes

### Scope boundary

| In | Out |
|----|-----|
| Durable primary-image bytes after pull | Gallery on cashier |
| Placeholder + never block add-to-cart | Dashboard upload (4.3) |
| API file proxy so cashier never talks to CDN | Opname / stock screens (4.5–4.6) |

### Architecture

| Rule | Implication |
|------|-------------|
| AD-9 | Menu reads Local DB after pull. Image **bytes** are part of that cache |
| AD-12 | Only adapter imports SDK. File GET is MediaService `fetch(deliveryUrl)` |
| FR-38 / FR-40 | Missing image never blocks Instant Checkout |
| SM-10 | Checkout/pay/receipt/sync have no product `<img>` |

### References

- [Source: `epics.md` Story 4.4]
- [Source: `prd.md` FR-40–FR-42, SM-10]
- [Source: `ARCHITECTURE-SPINE.md` AD-9, AD-12]
- [Source: `_bmad-output/implementation-artifacts/4-3-product-media-via-mediaservice.md`]

## Dev Agent Record

### Agent Model Used

Cursor Grok 4.6 (dev-story)

### Debug Log References

- API Jest 38/38, local-db 10/10 (incl. catalog-images), domain 10/10.

### Completion Notes List

- `GET .../images/:imageId/file` streams bytes via MediaService (502 `MEDIA_UNAVAILABLE` if CDN fails). Cashier JWT allowed.
- IndexedDB v5 `catalogImages`. `syncCatalogImageCache` skips same `publicId`, keeps old bytes on fetch fail, drops rows not in the pull.
- Menu tiles use blob URLs from IndexedDB or a placeholder. Add-to-cart does not wait on the image. Cart/Checkout/Receipt still have no CDN `<img>`.
- Image cache errors after `replaceCatalog` are swallowed so pull still succeeds.

### File List

- apps/api/src/media/media.service.ts
- apps/api/src/media/media.service.spec.ts
- apps/api/src/catalog/catalog.controller.ts
- packages/local-db/src/db.ts
- packages/local-db/src/catalog.ts
- packages/local-db/src/catalog-images.ts
- packages/local-db/src/catalog-images.spec.ts
- packages/local-db/src/index.ts
- packages/local-db/package.json
- apps/cashier/src/app/menu/page.tsx
- apps/cashier/src/components/catalog-product-thumb.tsx
- README.md

## Senior Developer Review (AI)

**Outcome:** Changes Requested → patched
**Date:** 2026-08-13

Layers: Blind Hunter + Edge Case Hunter + Acceptance Auditor.

### Action Items

- [x] Cache failures must not fail catalog pull (`try/catch` after `replaceCatalog`)
- [x] Menu `<img>` uses object URLs from IndexedDB only (never `secure_url`)
- [x] Fetch timeout 8s; skip > 2 MiB; keep previous `publicId` bytes on failure
- [x] Isolation spec still only adapter imports `cloudinary`
- [x] Cart / Checkout / Receipt unchanged (no Media Provider)

Dismissed: cashier gallery; SW as image SoT (IndexedDB is).

## Change Log

- 2026-08-13: Catalog refresh caches primary image bytes in IndexedDB; Menu renders cache or placeholder (Story 4.4).
