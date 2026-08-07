---
baseline_commit: fbc257ecf080138460d44c02f91a2034e90dd7b8
---

# Story 1.4: Enforce catalog role on API

Status: done

## Story

As a shop owner,
I want only `catalog_admin` to mutate the catalog,
so that a cashier account cannot change products or Stock from the API or Dashboard.

## Acceptance Criteria

1. **Given** a user authenticated as `cashier` with a valid Bearer token  
   **When** they call any create/update/AdjustStock product endpoint  
   **Then** the API returns **403** with `{ code, message }` and no catalog/Stock data changes

2. **And** a `catalog_admin` can still create/edit products and AdjustStock as in Story 1.3

3. **And** Dashboard hides or disables create/edit/Stock-adjust UI for `cashier` (read-only list OK)

4. **And** role checks live on the **API** (not UI-only) (AD-11, FR32)

## Tasks / Subtasks

- [x] Task 1: `RolesGuard` / `@Roles('catalog_admin')` (AC: #1, #2, #4)
  - [x] Add reusable roles decorator + guard reading `AuthUser.role` from JWT
  - [x] Apply to `POST/PATCH /catalog/products` and `PUT …/stock` only (GET list may stay any authenticated role)
  - [x] 403 body `{ code: "AUTH_FORBIDDEN", message }` (Indonesian calm copy)
  - [x] Do not change product business logic

- [x] Task 2: Tests (AC: #1, #2)
  - [x] Unit/integration: cashier token → mutate rejected 403; catalog_admin → allowed (mock guard or service+guard)

- [x] Task 3: Dashboard read-only for cashier (AC: #3)
  - [x] If session role is `cashier`, hide Tambah/Ubah/Simpan form; show list read-only + short note
  - [x] `catalog_admin` keeps full UI from 1.3

- [x] Task 4: Docs
  - [x] README note: mutate requires `catalog_admin`; cashier read-only

## Dev Notes

### Scope

| In | Out |
|----|-----|
| API role 403 on catalog writes | Sales Sync, AcceptCompleteSale |
| Dashboard cashier read-only | New product fields |
| Reuse JwtAuthGuard + AuthUser | Cashier app changes |

### Implementation sketch

```ts
@Roles("catalog_admin")
@UseGuards(JwtAuthGuard, RolesGuard)
```

Apply on mutate handlers (or controller method level). GET stays `@UseGuards(JwtAuthGuard)` only.

### Reuse

- `apps/api/src/auth/roles.ts` `isRole` / `ACCOUNT_ROLES`
- `CurrentUser` / `AuthUser` from jwt.strategy
- Dashboard `getSession()?.role`

### Anti-patterns

- UI-only hide without API 403
- 401 instead of 403 for wrong role
- Blocking GET list for cashier (read OK)

### References

- Epics Story 1.4; AD-11; FR32; prior 1.3 CatalogModule

## Dev Agent Record

### Agent Model Used

Cursor Grok 4.5

### Completion Notes List

- RolesGuard + @Roles('catalog_admin') on catalog mutate routes; GET remains any auth role
- Dashboard read-only for cashier; README updated
- Tests + live smoke: cashier 403 AUTH_FORBIDDEN, admin 201, cashier list 200

### File List

- apps/api/src/auth/roles.decorator.ts
- apps/api/src/auth/roles.guard.ts
- apps/api/src/auth/roles.guard.spec.ts
- apps/api/src/auth/auth.module.ts
- apps/api/src/catalog/catalog.controller.ts
- apps/api/src/catalog/catalog.controller.spec.ts
- apps/dashboard/src/app/products-panel.tsx
- apps/dashboard/src/app/page.tsx
- README.md

## Change Log

- 2026-08-07: Story created, implemented, reviewed (smoke), done
