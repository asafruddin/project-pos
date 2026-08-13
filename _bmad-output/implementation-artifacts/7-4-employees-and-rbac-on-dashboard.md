---
baseline_commit: 63dcb8c4f2c623ef6b1dad569ec32d03221577ba
---

# Story 7.4: Employees and RBAC on Dashboard

Status: done

## Story

As an Owner or Admin,
I want users, seeded roles, and a Permission matrix only on Dashboard, enforced by the API,
so that Cashier tokens cannot manage users or Refund, and Phase 1 `cashier` / `catalog_admin` still map to Cashier and Admin.

## Acceptance Criteria

1. **Given** Owner or Admin on Dashboard  
   **When** they open Employees / Access  
   **Then** they can create, deactivate, reset password, assign role, and assign Store #1 (FR-98). Cashier PWA has no user-create UI. API rejects user-admin from cashier-only tokens. Deactivated users cannot Account Login

2. **And** seeded roles are Owner, Admin (`catalog_admin`), Store Manager, Supervisor, Cashier, Inventory Staff, Purchasing Staff (FR-99). Custom roles are out. Only Owner and Admin can open Employees/Access. Store Manager cannot create admins or edit the Permission matrix

3. **And** Permissions are resource × action. Changing a role’s Permissions changes API authorization on the **next request** (loaded from DB in JWT validate, not frozen in the token). UI hide/show is not sufficient (FR-100 / AD-17)

4. **And** default matrix (FR-101): Cashier sell / Void (PIN approval) / Shift / limited reports — cannot Refund, adjust Stock, or change price. Supervisor = cashier + Void without manager PIN; still cannot Refund / Stock Adjustment / price / users. Store Manager = sell, Void, Refund, Stock Adjustment, price, reports. Admin = manager + manage users. Owner = same daily set as Admin. Cashier Refund → API deny; Manager Refund → API allow; Supervisor Refund → API deny

5. **And** Cashier PWA uses the signed-in user’s Permissions for sell / Void / Shift. POS PIN does not grant extra Permissions. Manager PIN for Void is an approval, not a role rewrite (FR-102)

6. **And** existing `cashier` accounts still cannot edit catalog; existing `catalog_admin` accounts still can (FR-103). Instant Checkout is unchanged

## Tasks / Subtasks

- [x] Task 1: Domain grants, assign-role rules, default matrix (AC: #2–#4, #6)
- [x] Task 2: Schema + PermissionsGuard + users/RBAC API; replace `@Roles("catalog_admin")` (AC: #1–#6)
- [x] Task 3: Dashboard Employees / Access; nav + cashier login by permission (AC: #1, #5)

## Dev Notes

### 2D subset `[ASSUMPTION]`

| In | Out (later) |
|----|-------------|
| 7 seeded roles; `cashier` → Cashier, `catalog_admin` → Admin | Custom role builder |
| Store #1 assignment only | Multi-Store picker (7.5) |
| Permission rows in DB, loaded every request | JWT-embedded frozen grants |
| Owner + Admin edit matrix | Store Manager user-admin |
| Supervisor skips device manager PIN on Void | New approval workflow |

### Architecture

| Rule | Implication |
|------|-------------|
| AD-17 | `PermissionsGuard` on mutating endpoints; UI hide is not enough |
| AD-11 / FR-103 | Keep JWT/DB value `catalog_admin` as Admin; `cashier` as Cashier |
| AD-15 | Nest `users` (Identity); no Cloudinary; no ledger writes |
| AD-6 / FR-102 | POS PIN ≠ extra Permissions |
| AD-19 | Assign Store = Store #1 |

### Current code (preserve)

- Seeded `admin` / `cashier` demo users and passwords
- Instant Checkout cash path; Sync still works for `sales:create`
- Catalog GET still omits `cost_minor` without `products:view_cost`

### References

- [Source: `epics.md` Story 7.4]
- [Source: `prd.md` FR-98–FR-103]
- [Source: `ARCHITECTURE-SPINE.md` AD-11, AD-17]

## Dev Agent Record

### Agent Model Used

Cursor Grok 4.6

### Debug Log References

- Migration `0019_rbac` applied; seed created `owner` / updated `admin` + `cashier` and filled `role_permissions`.
- Restart `pnpm dev:api` so `UsersModule` + JWT validate load grants from DB.

### Completion Notes List

- JWT still carries `sub` + `role` only. `JwtStrategy.validate` reloads the user, rejects `active=false`, and attaches DB grants so matrix edits apply on the next request.
- Empty matrix after seed is empty grants (not a silent restore of defaults). Unseeded table still falls back to role defaults.
- Shift open/cash/close use `shifts:create` / `shifts:update` so managers who can sell can also run a Shift (AD-16).
- Supervisor `sales:void_unattended` skips the device manager PIN on Cashier Void; API Void still requires `sales:void`. POS PIN does not add grants.
- Employees stays Owner/Admin even if the matrix is edited (`canOpenEmployees`). Store Manager cannot assign Admin/Owner or edit the matrix.
- Review fixes: customer create/update and return exchange gated; clearing a role no longer restores defaults; Dashboard pages use permissions instead of `role === catalog_admin`.

### File List

- `packages/domain/src/index.ts`
- `packages/domain/src/rbac.spec.ts`
- `packages/types/src/index.ts`
- `apps/api/drizzle/0019_rbac.sql`
- `apps/api/src/db/schema.ts`
- `apps/api/src/db/seed.ts`
- `apps/api/src/auth/jwt.strategy.ts`
- `apps/api/src/auth/auth.service.ts`
- `apps/api/src/auth/permissions.guard.ts`
- `apps/api/src/auth/permission.decorator.ts`
- `apps/api/src/auth/load-permissions.ts`
- `apps/api/src/users/`
- `apps/api/src/app.module.ts`
- `apps/dashboard/src/app/employees/`
- `apps/dashboard/src/app/employees-panel.tsx`
- `apps/dashboard/src/components/dashboard-shell.tsx`
- `apps/cashier/src/lib/auth-token.ts`
- `apps/cashier/src/app/login/login-form.tsx`
- `apps/cashier/src/app/void/page.tsx`

## Review

All-layer review (Blind Hunter / Edge Case / Acceptance Auditor) ran in-session after tests were green.

### Findings fixed

- Empty permission matrix restored role defaults (`loadRolePermissions` / `listRoles`).
- Shift mutations still required `role === cashier`, blocking managers who can sell.
- Promo mutate allowed `promotions:view` (cashier default).
- Dashboard product/stock/opname/promo/reports still keyed off `catalog_admin`.
- `POST /customers`, `PATCH /customers/:id`, and return exchange had no permission metadata.
- Create-user dropdown listed Owner for Admin.

### Deferred (2D)

- Employees matrix is a textarea, not a checkbox grid.
- Cashier PWA caches grants in localStorage until re-login; API still reloads every request.
- Duplicate `hasPermission` in domain and types (Dashboard has no domain dep).
- `RolesGuard` remains for leftover specs; mutating routes use `PermissionsGuard`.
