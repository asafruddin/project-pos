---
title: 'Dashboard form pages'
type: 'feature'
created: '2026-08-14'
status: 'done'
baseline_commit: '2d5d0cf0129489d92c6ddd5452fb1934ae13a7d8'
review_loop_iteration: 0
context:
  - '{project-root}/apps/dashboard/src/app/product-form.tsx'
  - '{project-root}/apps/dashboard/src/app/products-panel.tsx'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-pos-apps-2026-08-06/DESIGN.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Dashboard create/edit forms sit inline on list pages with uneven labels, density, and actions, so they feel unlike the product form.

**Approach:** Extract shared form primitives from ProductForm. Move every Dashboard mutation form onto dedicated routes modeled on `/products/new` and `/products/[productId]/edit`. List pages keep search/filter toolbars and add Tambah/Ubah links. Restyle login and remaining toolbars with the same Field pattern. Preserve existing APIs, validation, and permission gates.

## Boundaries & Constraints

**Always:**
- Indonesian UI copy; English code identifiers.
- Shared kit from ProductForm: `FormSection` cards, `FormField` (label, optional hint, required asterisk), sticky `FormActions` with Simpan + Batal.
- List pages follow `products-panel.tsx`: header + Tambah; row Ubah navigates; no inline create/edit.
- Batal and back-link return to the parent list (`scroll={false}`).
- Same request URLs, payloads, and permission checks as today.
- New routes get `PAGE_COPY` in `dashboard-shell.tsx`; parent nav stays active via `match`.
- Thin pages like `products/new/page.tsx`: session + permission + form component.
- Replace employee `window.prompt` password reset with a field on the edit page.

**Ask First:**
- Adding edit screens for entities that today only create (promotions, vouchers, stores).
- Changing API contracts or permission names.
- Changing Cashier or the login split-shell layout beyond Field restyle.

**Never:**
- Change Cashier, API handlers, or workflow state machines (PO / opname / transfer).
- Invent fields, endpoints, or edit flows that the panel does not already have.
- Duplicate Field/Section markup per panel.
- Leave mutation forms on list pages after extraction.
- Use `window.prompt` / `alert` for form input.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Create | Authorized user submits valid create form | Same API as today; navigate to parent list | N/A |
| Edit load | Open `/…/[id]/edit` or detail form route | Fields filled from existing fetch | Missing entity → Indonesian error; no silent save |
| Validation | Empty required or invalid number | Stay on form | Inline `role="alert"` |
| API fail | Existing endpoint 4xx/5xx | Stay on form; pending clears | Show server message |
| No permission | Lacks mutate permission | Hide Tambah; form page explains like ProductForm | Do not call mutate API |
| Cancel | Batal or back link | Parent list; discard unsaved | N/A |
| Search toolbar | Submit search on list | Reload list; stay on list route | Keep current error copy |
| Login | Valid credentials on `/login` | Session saved; redirect `/` | Existing error copy |

</frozen-after-approval>

## Code Map

- `apps/dashboard/src/app/product-form.tsx` — visual source; local Field/Section to extract
- `apps/dashboard/src/app/products-panel.tsx` — list + Tambah/Ubah link pattern
- `apps/dashboard/src/app/products/new/page.tsx` — thin create wrapper
- `apps/dashboard/src/app/products/[productId]/edit/page.tsx` — `params: Promise<…>` + `use(params)`
- `apps/dashboard/src/components/dashboard-shell.tsx` — PAGE_COPY + nav match
- `apps/dashboard/src/components/ui/{input,label,button,skeleton}.tsx` — existing primitives
- Mutation panels: `customers-panel.tsx`, `employees-panel.tsx`, `loyalty-panel.tsx`, `opname-panel.tsx`, `promotions-panel.tsx`, `purchasing-panel.tsx`, `stores-panel.tsx`, `transfers-panel.tsx`, `stock-overview-panel.tsx`, `returns-panel.tsx`
- Toolbars/auth: `reports-panel.tsx`, `login/login-form.tsx`
- No mutation forms: `sales/page.tsx`, `shifts-panel.tsx`

## Tasks & Acceptance

**Execution:**
- [x] `apps/dashboard/src/components/ui/form.tsx` — add `FormField`, `FormSection`, `FormActions`, and select/textarea classes matching ProductForm
- [x] `apps/dashboard/src/app/product-form.tsx` — consume the shared kit
- [x] `apps/dashboard/src/components/dashboard-shell.tsx` — PAGE_COPY for every new route; parent nav stays active
- [x] Customers — extract to `/customers/new` and `/customers/[customerId]/edit` (prices stay a section on edit); list keeps search
- [x] Employees — `/employees/new`, `/employees/[userId]/edit` (password field, no prompt), `/employees/roles` for the matrix
- [x] Loyalty — `/loyalty/program`; `/loyalty` keeps the customer ledger selector
- [x] Opname — `/opname/new`, `/opname/[opnameId]` for counts + approve/reject/cancel
- [x] Promotions — `/promotions/new` and `/promotions/vouchers/new` only (no invented edit)
- [x] Purchasing — `/purchasing/suppliers/new`, `/purchasing/suppliers/[supplierId]/edit`, `/purchasing/orders/new`, `/purchasing/orders/[poId]` for status + receive + invoice; list keeps supplier search
- [x] Stores — `/stores/new`, `/stores/[storeId]/registers/new`, `/stores/prices`
- [x] Transfers — `/transfers/new`; status buttons may stay on the list (not forms)
- [x] Stock / returns — `/stock/[productId]/damage`, `/returns/[returnId]` for exchange + refund
- [x] `apps/dashboard/src/app/reports-panel.tsx` and `apps/dashboard/src/app/login/login-form.tsx` — FormField restyle only; keep routes

**Acceptance Criteria:**
- Given a Dashboard list with mutations, when the user clicks Tambah or Ubah, then they land on a dedicated form with sections, labeled fields, and sticky Simpan/Batal.
- Given a list page, when it loads, then it has no inline create/edit form (search/filter toolbars allowed).
- Given submit validation or API failure, when the user saves, then they stay on the form with Indonesian `role="alert"` text.
- Given promotions, vouchers, or stores that only create today, when this ships, then they still only create.
- Given employee password reset, when an admin sets a new password, then it is a form field on the edit page, not `window.prompt`.

## Design Notes

List CTA (copy from products-panel): `Link` to the create route, `scroll={false}`, `h-11` primary, Phosphor `PlusIcon`, Indonesian “Tambah …”.

Form page: back link + sticky footer like ProductForm. Use two columns (`lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]`) only when identity vs money/status is a natural split; otherwise one column of sections.

Read Next.js 16 docs in `apps/dashboard/node_modules/next/dist/docs/` before adding routes. Mirror `products/[productId]/edit/page.tsx`.

## Verification

**Commands:**
- `pnpm --filter @pos-apps/dashboard lint` — expected: no new lint errors
- `pnpm --filter @pos-apps/dashboard exec tsc --noEmit` — expected: no type errors

**Manual checks:**
- Each list: Tambah opens form; Simpan returns to list; Batal discards.
- Login and reports date range still work with labeled fields.

## Suggested Review Order

**Shared form kit**

- Entry point: Field, Section, sticky Simpan/Batal, and denied back-link.
  [`form.tsx:19`](../../apps/dashboard/src/components/ui/form.tsx#L19)

- Sticky actions now own `cancelHref` with `scroll: false`.
  [`form.tsx:88`](../../apps/dashboard/src/components/ui/form.tsx#L88)

**Product form as consumer**

- Product page uses the kit so the reference UI cannot drift.
  [`product-form.tsx:759`](../../apps/dashboard/src/app/product-form.tsx#L759)

**Routing chrome**

- Exact `PAGE_COPY` wins so `/opname/new` is not stolen by `[id]`.
  [`dashboard-shell.tsx:222`](../../apps/dashboard/src/components/dashboard-shell.tsx#L222)

- Parent nav stays active on nested form routes.
  [`dashboard-shell.tsx:229`](../../apps/dashboard/src/components/dashboard-shell.tsx#L229)

**List → dedicated form**

- Thin create page: session, permission, form component.
  [`page.tsx:7`](../../apps/dashboard/src/app/customers/new/page.tsx#L7)

- List keeps search toolbar and Tambah; no inline create/edit.
  [`customers-panel.tsx:89`](../../apps/dashboard/src/app/customers-panel.tsx#L89)

- Missing entity blocks save instead of PATCHing a blank form.
  [`customer-form.tsx:258`](../../apps/dashboard/src/app/customer-form.tsx#L258)

- Password lives on the employee edit page, not `window.prompt`.
  [`employees-panel.tsx:139`](../../apps/dashboard/src/app/employees-panel.tsx#L139)

**Workflow detail pages**

- PO receive/invoice stay on the detail route after save.
  [`purchase-order-detail.tsx:148`](../../apps/dashboard/src/app/purchase-order-detail.tsx#L148)

**Auth / toolbar restyle**

- Login uses FormField without changing the auth shell.
  [`login-form.tsx:71`](../../apps/dashboard/src/app/login/login-form.tsx#L71)

