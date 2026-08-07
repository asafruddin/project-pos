---
baseline_commit: fbc257ecf080138460d44c02f91a2034e90dd7b8
---

# Story 1.3: Create and edit products

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a catalog_admin,
I want to create and edit products (name, price, Stock qty) on the Dashboard,
so that the coffee shop catalog and Stock levels exist on the server for Cashier pull and sales later.

## Acceptance Criteria

1. **Given** I am logged in on Dashboard as `catalog_admin` with a valid Bearer token  
   **When** I create a product with name, price, and Stock qty  
   **Then** the API persists it with `product_id` (UUID v4) and price as integer **minor units** (NFR6)

2. **And** I can edit name, price, and Stock qty for an existing product

3. **And** Stock qty changes go through an **`AdjustStock`-style** path (not Sale Sync / `AcceptCompleteSale`) (AD-4)

4. **And** Dashboard shows a simple product list with name, price, and Stock qty

5. **And** product form/list use shadcn patterns on desktop Dashboard layout (UX-DR1, UX-DR12)

6. **And** prices display formatted for locale (**IDR** / `id-ID`), not raw minor units (UX-DR11, NFR6)

7. **And** create/edit only the `products` table (Stock as `stock_qty` on product) — **no Sales schema**

8. **And** unauthenticated requests to mutate products are rejected (`401` + `{ code, message }`)

## Tasks / Subtasks

- [x] Task 1: Drizzle `products` schema + migration (AC: #1, #7)
  - [x] Add `products` to `apps/api/src/db/schema.ts`: `product_id` UUID PK, `name` text NOT NULL, `price_minor` integer NOT NULL (≥0), `stock_qty` integer NOT NULL (≥0), timestamps as needed
  - [x] CHECK constraints (or equivalent) for non-negative `price_minor` / `stock_qty`
  - [x] Generate + apply migration (`db:generate` / `db:migrate`); no Sales tables
  - [x] Optional seed: 1–2 demo products for Dashboard smoke (document in README)

- [x] Task 2: `packages/domain` AdjustStock pure helper (AC: #3)
  - [x] Implement pure `adjustStock` (or `setStockQty`) in `packages/domain` — no Nest/Drizzle/HTTP
  - [x] Reject negative resulting qty; return new qty or typed error result
  - [x] Unit-test the pure function

- [x] Task 3: Shared types in `@pos-apps/types` (AC: #1, #2)
  - [x] Export product DTOs: create/update request, product response, AdjustStock request, list response
  - [x] Money fields named `price_minor` (integer); never float
  - [x] No Nest/Drizzle imports in types package (AD-5)

- [x] Task 4: Nest `CatalogModule` API (AC: #1–3, #8)
  - [x] Module under `apps/api/src/catalog/` (controller, service, DTOs with class-validator)
  - [x] `GET /catalog/products` — list (JwtAuthGuard)
  - [x] `POST /catalog/products` — create with name, `price_minor`, initial `stock_qty` (JwtAuthGuard)
  - [x] `PATCH /catalog/products/:productId` — update name and/or `price_minor` (JwtAuthGuard)
  - [x] `PUT /catalog/products/:productId/stock` — set/adjust qty via domain `AdjustStock` (JwtAuthGuard); **do not** go through Sync
  - [x] Errors via existing `ApiExceptionFilter` → `{ code, message }` (e.g. `CATALOG_NOT_FOUND`, `CATALOG_INVALID_STOCK`)
  - [x] **Do not** implement cashier→403 role guard yet (Story 1.4) — but structure endpoints so a RolesGuard can wrap mutations cleanly
  - [x] Keep `GET /health`, `/auth/login`, `/auth/me` working

- [x] Task 5: Dashboard products UI (AC: #4–6)
  - [x] Indonesian-first copy: page **Produk**, CTA **Tambah produk**, labels **Nama produk** / **Harga** / **Stok**, save **Simpan**, empty state calm (UX-DR2 style)
  - [x] After login home (or `/products`): list name + formatted IDR price + stock qty; create + edit forms (shadcn Input/Button; table OK)
  - [x] Format money with `id-ID` currency IDR from `price_minor` (divide by 100 for display **or** treat minor as rupiah satuan — **pick one, document it**: Phase 1 coffee shop → treat `price_minor` as **integer rupiah** (no decimals) unless architecture already implies cents; architecture says “integer minor units” — **use integer IDR (Rp) with no fractional subunit** for Phase 1 demo and document in README)
  - [x] Bearer token from existing `auth-token` helper on all catalog API calls
  - [x] Show API `message` on failure; never echo secrets
  - [x] Desktop layout: simple sidebar or nav to Produk + Keluar (UX-DR12 lite — full sidebar polish OK but not required beyond usable desktop chrome)
  - [x] **Do not** build Cashier catalog pull / local-db (Epic 2)

- [x] Task 6: Docs + tests (AC: #1, #3, #8)
  - [x] README: product endpoints, migrate, money convention, demo products if seeded
  - [x] API tests: create success, unauthenticated mutate → 401, AdjustStock rejects negative, not-found code
  - [x] Domain unit tests for AdjustStock

## Dev Notes

### Scope boundary (critical)

| In scope | Out of scope |
|----------|----------------|
| `products` + `stock_qty` on server | Sales / SALE_LINE tables |
| CatalogModule CRUD + AdjustStock path | `AcceptCompleteSale` / Sync |
| Dashboard product list/create/edit | Cashier Menu / local-db pull (2.3) |
| JwtAuthGuard on catalog routes | Cashier role **403** enforcement (1.4) — leave hooks only |
| IDR display formatting | Charts, analytics, modifiers |

### Architecture compliance

| Rule | Implication |
|------|-------------|
| AD-4 | Stock edits = `AdjustStock` path only; never invent a second Stock writer for Sales |
| AD-5 | DTOs in `@pos-apps/types`; domain pure; Nest orchestrates |
| AD-9 | Server catalog is source for later Cashier pull — persist durable products now |
| AD-10 | Price edits do not rewrite historical Sale lines (no Sales yet) |
| AD-11 | Full cashier forbid is Story 1.4; 1.3 must reject anonymous writes |
| NFR6 | UUID v4 `product_id`; integer `price_minor`; ISO dates if returned |
| Error shape | `{ code, message }` via `ApiExceptionFilter` |

[Source: `_bmad-output/planning-artifacts/architecture/.../ARCHITECTURE-SPINE.md` — AD-4, AD-5, AD-9–11, ERD PRODUCT]  
[Source: `_bmad-output/planning-artifacts/epics.md` — Story 1.3]  
[Source: UX EXPERIENCE.md — Products/Stock IA, Flow 4]

### Data model (exact)

```text
products
  product_id   uuid PK default gen_random_uuid()
  name         text NOT NULL
  price_minor  integer NOT NULL  -- Phase 1: integer rupiah (Rp)
  stock_qty    integer NOT NULL  -- server Stock truth
  created_at   timestamptz NOT NULL default now()
  updated_at   timestamptz NOT NULL default now()
```

No separate `stock` table (ERD puts `stock_qty` on PRODUCT).

### API contract (implement exactly)

| Method | Path | Auth | Body / notes |
|--------|------|------|----------------|
| GET | `/catalog/products` | Bearer | → `{ products: Product[] }` |
| POST | `/catalog/products` | Bearer | `{ name, price_minor, stock_qty }` |
| PATCH | `/catalog/products/:productId` | Bearer | `{ name?, price_minor? }` — **not** stock |
| PUT | `/catalog/products/:productId/stock` | Bearer | `{ stock_qty }` absolute target qty via AdjustStock |

`Product`: `{ product_id, name, price_minor, stock_qty, created_at?, updated_at? }`

### Money display (Dashboard)

- Store/API: integer `price_minor` = **rupiah** (Phase 1 coffee shop; no `÷100` unless you introduce subunits later).
- Display: `new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(price_minor)`
- Never show raw integers without currency formatting in UI.

### Reuse from Story 1.2 (do not regress)

- `JwtAuthGuard` + `AUTH_*` codes; `ApiExceptionFilter`; `ConfigModule` + `apps/api/.env`
- Dashboard `localStorage` session (`auth-token.ts`); login “Masuk”; `/auth/me` gate
- Drizzle migrate with dotenv in `drizzle.config.ts`; role CHECK on users
- Pool shutdown via `DbShutdownService`

### Files to touch

**UPDATE:** `apps/api/src/app.module.ts`, `apps/api/src/db/schema.ts`, `packages/types/src/index.ts`, `apps/dashboard/src/app/page.tsx` (or add `/products` + nav), `README.md`, possibly `packages/domain/src/*`

**NEW:** `apps/api/src/catalog/*`, migration `0002_products.sql` (or next idx), Dashboard product components / `lib/format-money.ts`, domain AdjustStock + tests

### Anti-patterns (will fail review)

- Float prices or string money in API
- Mutating `stock_qty` only inside PATCH without AdjustStock domain call
- Sales schema “just in case”
- Cashier app / Serwist / local-db catalog work
- UI-only “security” with open unauthenticated POST
- Hardcoding JWT/DB secrets
- English-only primary chrome for product page titles/CTAs

### Testing requirements

- Domain: AdjustStock happy path + negative rejection
- API: create → list contains product; PATCH updates name/price; PUT stock; missing Bearer → 401 `{ code, message }`; unknown id → not-found code
- Manual: login as `admin` → create product → see IDR-formatted price on list

### Previous story intelligence (1.2)

- Auth + Drizzle patterns are established; extend schema — don’t reinvent DB client
- Review deferred: rate limiting; JWT DB re-load on every request — leave deferred
- Username login is **case-sensitive** exact match
- Demo users: `admin` / `Admin123!` (`catalog_admin`), `cashier` / `Cashier123!`

### Project Structure Notes

- Nest feature module = `apps/api/src/catalog/`
- Dashboard App Router under `apps/dashboard/src/app/`
- Shared contracts only in `packages/types`
- Pure stock math in `packages/domain`

### References

- Epics: `_bmad-output/planning-artifacts/epics.md` — Story 1.3 / Epic 1
- Architecture: `ARCHITECTURE-SPINE.md` — AD-4, AD-5, AD-9–11, PRODUCT ERD
- UX: `ux-pos-apps-2026-08-06/EXPERIENCE.md` — Products/Stock, Flow 4
- Prior: `_bmad-output/implementation-artifacts/1-2-account-login-with-roles.md`

## Dev Agent Record

### Agent Model Used

Cursor Grok 4.5 (dev-story)

### Debug Log References

### Completion Notes List

- CatalogModule: GET/POST/PATCH products + PUT stock via domain adjustStock
- products table migration 0002; seed Espresso/Latte when empty
- Dashboard Produk panel with IDR formatting and sidebar chrome
- Tests: domain adjustStock (node:test), catalog service/controller Jest

### File List

- packages/types/src/index.ts
- packages/domain/src/index.ts
- packages/domain/src/adjust-stock.spec.ts
- packages/domain/package.json
- packages/domain/tsconfig.json
- apps/api/src/db/schema.ts
- apps/api/src/db/seed.ts
- apps/api/drizzle/0002_products.sql
- apps/api/drizzle/meta/_journal.json
- apps/api/src/catalog/**
- apps/api/src/app.module.ts
- apps/dashboard/src/app/page.tsx
- apps/dashboard/src/app/products-panel.tsx
- apps/dashboard/src/lib/format-money.ts
- README.md
- pnpm-lock.yaml

### Review Findings

- [x] [Review][Patch] Reload list after partial edit failure; clear session on 401; block ProductsPanel until `me` ready; Max int bounds; reject blank numeric fields
- [x] [Review][Defer] Full HTTP e2e without Bearer — covered by JwtAuthGuard unit + live smoke; add supertest later if desired

## Change Log

- 2026-08-07: Story context created (ready-for-dev)
- 2026-08-07: Implemented catalog products + AdjustStock + Dashboard Produk UI; status → review
- 2026-08-07: Code review patches applied; status → done
