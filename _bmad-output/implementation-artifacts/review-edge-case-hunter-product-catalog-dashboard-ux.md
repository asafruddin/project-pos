# Edge Case Hunter review: Product catalog dashboard UX

Review the implementation diff from baseline commit `f8ca16b8cc4018ebc41dc907fd0028524c0faf0a` using the `bmad-review-edge-case-hunter` skill.

Focus on the changed files:

- `apps/dashboard/src/app/product-form.tsx`
- `apps/dashboard/src/app/products-panel.tsx`
- `packages/ui/src/organisms/form-chrome.tsx`

Run `git diff f8ca16b8cc4018ebc41dc907fd0028524c0faf0a` and inspect the untracked implementation spec as context. Walk create-with-image, failed upload, no-image, empty-filter, mobile, permission, and keyboard paths. Report only unhandled edge cases with file/line references.
