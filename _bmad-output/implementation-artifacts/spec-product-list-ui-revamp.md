---
title: 'Revamp dashboard product list UI and bottom pagination'
type: 'feature'
created: '2026-08-19'
status: 'in-review'
review_loop_iteration: 0
baseline_commit: 'b58e78a06e18dec12e12203d61f7643da54db9df'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The dashboard product list is visually flat and the pagination controls sit directly after the content instead of forming a stable bottom action area. Product identity, price, stock, and status need clearer hierarchy across responsive views.

**Approach:** Refresh the product cards/table rows with stronger visual grouping, image treatment, status/stock badges, and clearer actions while retaining the existing product data, filters, sort, view toggle, links, and pagination behavior. Structure the result area as a flexible column so pagination stretches across the available width and aligns to the bottom of the list surface.

## Boundaries & Constraints

**Always:** Preserve existing API/data behavior, responsive grid/list/table modes, Indonesian labels, permission-gated actions, accessibility labels, dark mode tokens, and current pagination calculations.

**Ask First:** Any change to product fields, API contracts, page size, filter semantics, navigation destinations, or shared UI primitives.

**Never:** Do not rewrite unrelated dashboard forms, change backend behavior, add new dependencies, or remove the existing mobile/table responsive fallback.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|----------------------------|----------------|
| HAPPY_PATH | Products with image, metadata, stock, status, and actions | Each view clearly presents identity, price, stock, status, and available actions; pagination spans the list width and remains bottom-aligned | N/A |
| NO_IMAGE | Product has no image | Existing placeholder remains visible with accessible label | N/A |
| LOW_OR_OUT_STOCK | Product is at/below minimum or has zero stock | Stock state is visually distinguishable without changing filter behavior | N/A |
| READ_ONLY | `canMutate` is false | Mutation actions remain hidden and layout stays balanced | N/A |
| EMPTY_PAGE | Filters produce no visible products | Existing empty state and reset action remain intact | N/A |

</frozen-after-approval>

## Code Map

- `apps/dashboard/src/app/products-panel.tsx` -- owns product fetching, filtering, responsive product renderings, actions, and pagination layout.
- `apps/dashboard/src/app/globals.css` -- provides dashboard color/shadow tokens used by the refreshed UI; no changes expected unless an existing token is insufficient.

## Tasks & Acceptance

**Execution:**
- [x] `apps/dashboard/src/app/products-panel.tsx` -- refresh product cards, mobile rows, and desktop table hierarchy with existing Tailwind/design tokens; add consistent stock/status treatments and clearer action grouping without changing behavior.
- [x] `apps/dashboard/src/app/products-panel.tsx` -- make the product-results region a flexible column and style pagination as a full-width bottom action row with responsive stacking.

**Acceptance Criteria:**
- Given products are loaded, when the dashboard renders in grid, mobile list, or desktop table mode, then product name, price, stock, status, and metadata have clear visual hierarchy and no existing information or action is lost.
- Given a product has no image, low stock, zero stock, inactive status, or no mutation permission, when its row/card renders, then the appropriate existing placeholder/state is clear and the layout remains aligned.
- Given one or more pages of products, when the pagination renders, then the results summary and controls occupy the full available width, controls stretch appropriately on small screens, and the action row is aligned to the bottom of the results surface.
- Given filters, sorting, page changes, or reset are used, when the list updates, then existing filtering and pagination behavior is unchanged.

## Verification

**Commands:**
- `pnpm --filter @pos-apps/dashboard lint` -- expected: success.
- `pnpm --filter @pos-apps/dashboard build` -- expected: success.

**Manual checks:**
- Inspect `/products` at mobile, tablet, and desktop widths in both light and dark themes; verify grid/list toggle, action visibility, image placeholder, low/out stock states, and bottom pagination alignment.
