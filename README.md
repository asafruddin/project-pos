# POS Apps

Coffee-shop POS Phase 1 monorepo (Instant Checkout + Offline Mode).

## Stack

| Surface | Tech | Port |
|---------|------|------|
| Cashier | Next.js 16.3 App Router + Serwist PWA + shadcn/Tailwind | `3000` |
| Dashboard | Next.js 16.3 App Router + shadcn/Tailwind (online-only) | `3002` |
| API | NestJS 11.1 (`GET /health`, `POST /auth/login`) | `3001` |
| Database | PostgreSQL 16+ via `DATABASE_URL` (Drizzle ORM 0.45.x) | — |

Shared packages: `@pos-apps/domain`, `@pos-apps/types`, `@pos-apps/local-db`.

## Prerequisites

- Node.js 20+
- [pnpm](https://pnpm.io) 11.x (`packageManager` field pins the version)
- PostgreSQL reachable with a `DATABASE_URL` (local Docker or managed Neon/etc.)

## Install & build

```bash
pnpm install
cp .env.example apps/api/.env   # then fill DATABASE_URL + JWT_SECRET
pnpm --filter @pos-apps/api db:migrate
pnpm --filter @pos-apps/api db:seed
pnpm build
```

`pnpm build` runs Turborepo across packages and all three apps. Cashier production builds use **webpack** (`next build --webpack`) so `@serwist/next` can emit `apps/cashier/public/sw.js`.

## Auth (Story 1.2)

| Item | Value |
|------|--------|
| Login | `POST http://localhost:3001/auth/login` body `{ "login", "password" }` |
| Success | `{ access_token, token_type: "Bearer", user_id, role }` |
| Me | `GET /auth/me` with `Authorization: Bearer <token>` |
| Errors | `{ code, message }` JSON (e.g. `AUTH_INVALID_CREDENTIALS`) |

**Demo seed users** (from `pnpm --filter @pos-apps/api db:seed`):

| Username | Password | Role |
|----------|----------|------|
| `admin` | `Admin123!` | `catalog_admin` |
| `cashier` | `Cashier123!` | `cashier` |

Phase 1 login identifier is the `username` column (**case-sensitive** exact match after trim; may look like an email). Passwords are bcrypt-hashed; never logged in plaintext.

Dashboard stores the Bearer token in **`localStorage`** (keys `pos_apps_*`) for later API calls — fine for local demo; treat XSS carefully before production.

## Catalog (Story 1.3)

| Method | Path | Notes |
|--------|------|--------|
| GET | `/catalog/products` | Bearer required |
| POST | `/catalog/products` | `{ name, price_minor, stock_qty }` |
| PATCH | `/catalog/products/:productId` | `{ name?, price_minor? }` |
| PUT | `/catalog/products/:productId/stock` | `{ stock_qty }` via AdjustStock (AD-4) |

- `price_minor` = **integer rupiah (Rp)** in Phase 1 (no fractional subunit). Dashboard formats with `id-ID` / IDR.
- Stock qty changes use domain `adjustStock` — not Sale Sync.
- Seed may insert demo products `Espresso` / `Latte` when the table is empty.
- Cashier role **403** on mutate: `AUTH_FORBIDDEN` — only `catalog_admin` may POST/PATCH/PUT stock; GET list allowed for any authenticated role. Dashboard hides edit UI for `cashier`.

## Sales list shell (Story 1.5)

| Method | Path | Notes |
|--------|------|--------|
| GET | `/sales` | Bearer; today’s synced sales + `daily_total_minor` (empty until Epic 2 Sync) |

Dashboard: **Stok / Produk** + **Penjualan** nav. Empty sales copy clarifies this is server synced sales, not Cashier Offline Mode.

Env vars (see `.env.example`):

- `DATABASE_URL` — Postgres connection string
- `JWT_SECRET` — signing secret (required)
- `JWT_EXPIRES_IN` — default `8h`
- `CORS_ORIGIN` — default `http://localhost:3002`
- `NEXT_PUBLIC_API_URL` — Dashboard → API base (default `http://localhost:3001`)

## Local development

```bash
# All apps (parallel)
pnpm dev

# One app
pnpm dev:cashier    # http://localhost:3000
pnpm dev:dashboard  # http://localhost:3002  → /login “Masuk”
pnpm dev:api        # http://localhost:3001  → GET /health → { "status": "ok" }
```

## Serwist / PWA notes (Cashier only)

- Uses `@serwist/next` + `serwist` — **not** `next-pwa`.
- Service worker source: `apps/cashier/src/app/sw.ts` → build output `apps/cashier/public/sw.js` (gitignored).
- Next.js 16 defaults to Turbopack for `dev` / `build`. Cashier **`build` is forced to webpack** so Serwist InjectManifest works. If you switch Cashier to Turbopack builds later, evaluate `@serwist/turbopack` instead.
- Dashboard has **no** service worker (Architecture AD-7). Cashier Account Login UI is Epic 2 — not in Story 1.2.

## Planning artifacts

Product requirements, architecture, UX, and sprint tracking live under `_bmad-output/`. They are the source of truth for PRD / Architecture / UX — **do not relocate or delete** them when changing app code. Same for `_bmad/`, `docs/`, and `.agents/`.

## Workspace layout

```text
apps/cashier      Next PWA (Serwist)
apps/dashboard    Next online-only (+ Account Login)
apps/api          NestJS API (AuthModule + health)
packages/domain   Pure TS domain stub
packages/types    Shared DTOs (auth + stubs)
packages/local-db Local IndexedDB stub (cashier later)
```
