---
title: 'Product catalog dashboard image and list UX'
type: 'feature'
created: '2026-08-17'
status: 'in-review'
baseline_commit: 'f8ca16b8cc4018ebc41dc907fd0028524c0faf0a'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The dashboard product workflow only supports image upload after a product exists, product images are not visible in the product list, and the list has limited ways to find or organize products. The product form actions also need a clearer right-aligned presentation.

**Approach:** Extend the existing product form to accept an image while creating a product and preserve the current gallery tools for edits. Refresh the product list with image thumbnails, useful catalog fields, client-side search/filter/sort controls using dropdowns, and a more informative empty state. Improve the form action bar with right-aligned, visually distinct Save and Cancel actions.

## Boundaries & Constraints

**Always:** Reuse the existing catalog image API and Product/ProductImage types; keep image upload restricted by existing permissions and accepted file types; preserve responsive mobile and desktop layouts; do not change product pricing, stock, or image API semantics.

**Ask First:** None.

**Never:** Do not add a second image storage path, fabricate product records, or remove existing image reorder/primary/delete functionality. Do not require server-side list query changes for dashboard-only filtering.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Create with image | Valid product fields and one selected image | Product is created, image is uploaded to that product, then dashboard returns to the list | Show API/upload error and keep the form visible |
| Create without image | Valid product fields and no image | Product is created normally | N/A |
| Filtered list empty | Search/filter combination matches no products | Clear no-results message and reset-filters action | N/A |
| Invalid image | Unsupported file or API rejection | Product save/upload does not silently succeed; show the returned error | Keep user input available where possible |

</frozen-after-approval>

## Code Map

- `apps/dashboard/src/app/product-form.tsx` -- product create/edit fields, image selection/upload, and form action layout.
- `apps/dashboard/src/app/products-panel.tsx` -- product list rendering, thumbnail display, filter/sort controls, and responsive rows.
- `packages/ui/src/organisms/form-chrome.tsx` -- shared FormActions styling and alignment used by product form.
- `apps/api/src/catalog/catalog.controller.ts` -- existing product/image endpoints; expected to remain the integration boundary.
- `packages/types/src/index.ts` -- Product and ProductImage response shapes consumed by the dashboard.

## Tasks & Acceptance

**Execution:**
- [x] `apps/dashboard/src/app/product-form.tsx` -- add a create-mode image picker with preview/replace behavior, upload the selected image after successful product creation, and update the action presentation -- so new products can be fully configured in one flow.
- [x] `apps/dashboard/src/app/products-panel.tsx` -- add thumbnails, SKU/category/brand/status/stock visibility, search and dropdown filter/sort state, and reset/no-results handling -- so the catalog is scannable and usable with real data.
- [x] `packages/ui/src/organisms/form-chrome.tsx` -- right-align the shared form actions and give Save/Cancel clearer hierarchy without breaking other forms -- so product actions have the requested UI.
- [x] `apps/dashboard/src/app/products-panel.tsx` and `apps/dashboard/src/app/product-form.tsx` -- validate the affected dashboard package with lint, typecheck/build as available, and manually verify create/edit/list responsive states -- TypeScript and diff checks pass; lint has pre-existing repository-wide effect-rule failures and build cannot fetch Google Fonts in the sandbox.

**Acceptance Criteria:**
- Given a user with product mutation permission, when they create a product with a valid image selected, then the product and image are both persisted and the product list shows the image thumbnail.
- Given a product with no image, when the list renders, then it shows a consistent placeholder and does not break the row/card layout.
- Given a populated product list, when the user enters a search term or selects status/category/stock filters and a sort dropdown, then only matching products are shown in the requested order.
- Given no products match the controls, when the list renders, then it shows a no-results state with a way to clear the controls.
- Given the product form is open, when the user reaches the action bar, then Save and Cancel are grouped on the right, Save is visually primary, and Cancel remains keyboard and mouse accessible.
- Given an image upload fails, when the response returns an error, then the form shows the error and does not navigate away as if the complete save succeeded.

## Design Notes

The create flow must retain the selected `File` in local component state because the API requires a product ID before upload. A successful create should then upload the file using the existing `/catalog/products/:productId/images` endpoint; an upload failure should be surfaced rather than hidden. List controls should be derived from returned product data, with stable sort tie-breakers so rows do not jump unpredictably.

## Verification

**Commands:**
- `pnpm --filter @pos-apps/dashboard lint` -- expected: no lint errors.
- `pnpm --filter @pos-apps/dashboard build` -- expected: production build succeeds.
