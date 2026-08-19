# Edge Case Hunter Review: Product List UI Revamp

Invoke the `bmad-review-edge-case-hunter` skill on the current diff.

Review scope:

- Baseline commit: `b58e78a06e18dec12e12203d61f7643da54db9df`
- Primary change: `apps/dashboard/src/app/products-panel.tsx`
- Spec: `_bmad-output/implementation-artifacts/spec-product-list-ui-revamp.md`

Inspect the full diff with:

```bash
git diff b58e78a06e18dec12e12203d61f7643da54db9df -- apps/dashboard/src/app/products-panel.tsx
```

Walk every responsive branch and state: grid/list/table, mobile widths, long names, missing images, low/out stock, inactive products, read-only users, empty results, and pagination boundaries. Return only unhandled edge cases.
