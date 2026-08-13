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
| PUT | `/catalog/products/:productId/stock` | `{ stock_qty, reason }` via AdjustStock — posts a Stock Ledger movement (AD-4 / AD-13) |
| GET | `/catalog/products/:productId/images/:imageId/file` | Bearer (cashier OK); image bytes for catalog refresh cache |
| POST | `/catalog/products/:productId/images` | multipart `file` (+ optional `alt_text`); first image becomes primary |
| PATCH | `/catalog/products/:productId/images/reorder` | `{ image_ids }` — DB-only |
| PATCH | `/catalog/products/:productId/images/:imageId` | `{ is_primary?, alt_text? }` — set-primary is DB-only |
| DELETE | `/catalog/products/:productId/images/:imageId` | unlinks catalog then Cloudinary destroy; retries orphans |

- `price_minor` = **integer rupiah (Rp)** in Phase 1 (no fractional subunit). Dashboard formats with `id-ID` / IDR.
- **Stock Ledger** is quantity source of truth (Story 4.1). `products.stock_qty` is a cached **projection** of sellable movements at Store #1 (`00000000-0000-4000-8000-000000000001`). One Register stub: `00000000-0000-4000-8000-000000000002`.
- Catalog fields (Story 4.2): SKU (unique when set), barcode, description, category/brand (created by name), status Aktif/Nonaktif, cost, min/max, tags, `parent_id` for Variants, **Lacak stok**. Cashier Menu after refresh lists only **active** products that are not parents of variants. Missing optional fields never block checkout. Cost is Dashboard-only.
- **Product Media** (Story 4.3): only `apps/api` **MediaService** / `cloudinary.adapter.ts` imports Cloudinary (`cloudinary@2.10.0` v2). POS DB stores `public_id` + `secure_url` + metadata. Delivery uses `q_auto,f_auto`. Saving without a primary image **warns**, does not block.
- **Cashier image cache** (Story 4.4): catalog refresh stores primary-image **bytes** in IndexedDB (`catalogImages`). Menu renders cache or a placeholder. Add-to-cart is never blocked by a missing image. Checkout / payment / Receipt / Sync do not request the Media Provider. Airplane-mode Menu uses the local cache.
- AdjustStock requires `reason` (Dashboard label **Alasan**). Create uses server reason `initial_stock`. Cutover posts `opening_balance` / `cutover`.
- `AcceptCompleteSale` / `POST /sales/sync` posts STOCK OUT sellable and **does not** reject insufficient qty (negative projection allowed). Instant Checkout is unchanged.
- **Void** (Story 5.4): Cashier **Void** (`/void`) reverses a complete same-day local Sale after a device-local manager PIN. `POST /sales/void` `{ void_id, sale_id, voided_at }` (cashier-only) runs `PostVoid` — STOCK IN sellable, `source_type=void`. The Sale row is kept (`sale_voids`). Incomplete checkout cancel is not Void. Expected Cash from cash Void waits until Shift (Epic 6).
- **Retur** (Story 5.5): Online-first `GET /sales/:saleId`. `POST /sales/:saleId/returns` runs `PostReturn` (resellable → sellable IN, rusak → damaged IN, garansi → no restock). `POST /sales/returns/:id/refund` is `catalog_admin` only (`AUTH_FORBIDDEN` for cashier). Tukar = tautkan `exchange_sale_id` ke penjualan baru. Store Credit tidak di epic ini.
- **Pelanggan** (Story 6.1): `CustomersModule` `/customers`. Nama + telepon atau email. Duplikat telepon **peringatan**, tetap dibuat. Kasir dapat create/edit; hapus hanya `catalog_admin`. `POST /sales/sync` boleh `customer_id` opsional (tanpa FK — penjualan tanpa pelanggan tetap sah). Offline: cache attach OK; create baru masuk `customerCreateOutbox` (`customer_create`) dan tidak menahan Sale berikutnya.
- **Shift** (Story 6.2–6.3): `POST /shifts` `{ shift_id, opened_at, opening_cash_minor }` (kasir). Satu shift terbuka per Register. **Bayar** disabled tanpa shift terbuka. `POST /sales/sync` **wajib** `shift_id` (`SALE_SHIFT_REQUIRED`). `POST /shifts/:id/cash` kas masuk/keluar (alasan wajib). `POST /shifts/:id/close` mencatat hitungan vs Expected Cash; selisih **peringatan**, tidak memaksa nol. Tutup shift **tidak** mengosongkan Sync.
- Seed may insert demo products `Espresso` / `Latte` when the table is empty (plus opening movements).
- Cashier role **403** on mutate: `AUTH_FORBIDDEN` — only `catalog_admin` may POST/PATCH/PUT stock and `POST /inventory/products/:id/damaged`; GET catalog list and `GET /inventory/overview` allowed for any authenticated role. Dashboard hides edit UI for `cashier`.
- **Ikhtisar stok** (Story 4.5): `GET /inventory/overview` — sellable/damaged/in-transit from ledger `SUM(qty_delta)` at Store #1. `POST /inventory/products/:id/damaged` `{ qty, reason }` (`catalog_admin`) posts STOCK OUT sellable + STOCK IN damaged. Dashboard **Ikhtisar stok** lists **Rendah** (≤ min) and **Habis** (≤ 0). Cashier Instant Checkout is unchanged (oversell does not hard-block).
- **Opname stok** (Story 4.6): `POST /inventory/opnames` `{ product_ids }` snapshots sellable SUM (draft, no movements). `PATCH /inventory/opnames/:id/counts` saves **Dihitung**. `POST .../approve` runs ApplyOpname (`source_type=opname`) so Overview matches counted qty. Reject/cancel leave Stock unchanged. `catalog_admin` only. Cashier PWA has no Opname screen.
- **Pembelian** (Story 5.1): `PurchasingModule` `/purchasing/suppliers` (search `?q=`) and `/purchasing/purchase-orders`. States Draft → Submitted → Approved (Partially Received / Completed reserved for Goods Receipt). Submit/approve/cancel do **not** post Stock Movements. `catalog_admin` only.
- **Penerimaan barang** (Story 5.2): `POST /purchasing/purchase-orders/:id/receipts` `{ lines: [{ product_id, qty }] }` runs `ReceiveGoods` — STOCK IN sellable, `source_type=goods_receipt`. Partial → Diterima sebagian; full → Selesai. Over-receive rejected. `PATCH .../invoice` `{ invoice_ref, payment_status }` does not move stock; Selesai may stay unpaid.

## Sales list shell (Story 1.5)

| Method | Path | Notes |
|--------|------|--------|
| GET | `/sales` | Bearer; today’s synced sales + `daily_total_minor` (voided excluded from total) |
| POST | `/sales/sync` | Cashier; AcceptCompleteSale + STOCK OUT |
| POST | `/sales/void` | Cashier; PostVoid + STOCK IN; idempotent on `void_id` |
| GET | `/sales/:saleId` | Bearer; lookup complete synced sale + returned qty |
| POST | `/sales/:saleId/returns` | Bearer; PostReturn inventory decision |
| GET | `/sales/returns` | Bearer; open returns waiting for refund |
| POST | `/sales/returns/:id/refund` | `catalog_admin` only; cash Refund |
| PATCH | `/sales/returns/:id/exchange` | Bearer; link new complete Sale |
| GET | `/customers` | Bearer; search `?q=` |
| GET | `/customers/groups` | Bearer; distinct group names |
| POST | `/customers` | Bearer; cashier or admin; optional `customer_id` (idempotent) |
| GET | `/customers/:id` | Bearer |
| GET | `/customers/:id/history` | Bearer; sales, returns, spend (no cost) |
| PATCH | `/customers/:id` | Bearer; group assign is admin-only |
| DELETE | `/customers/:id` | `catalog_admin` only |
| GET | `/shifts/current` | Bearer; open Shift on Register 1 or null |
| GET | `/shifts` | Bearer; list Shifts (Dashboard review) |
| GET | `/shifts/:id` | Bearer; Shift + Expected Cash breakdown + movements |
| POST | `/shifts` | Cashier; open Shift; idempotent on `shift_id`; one open per Register |
| POST | `/shifts/:id/cash` | Cashier; Cash In/Out; idempotent on `movement_id`; does not write Stock |
| POST | `/shifts/:id/close` | Cashier; snapshot counted vs expected; non-zero difference allowed |

Dashboard: **Stok / Produk** + **Ikhtisar stok** + **Opname stok** / **Pembelian** (admin) + **Penjualan** + **Retur** + **Pelanggan** + **Shift** nav. Empty sales copy clarifies this is server synced sales, not Cashier Offline Mode.

Env vars (see `.env.example`):

- `DATABASE_URL` — Postgres connection string
- `JWT_SECRET` — signing secret (required)
- `JWT_EXPIRES_IN` — default `8h`
- `CORS_ORIGIN` — default `http://localhost:3002`
- `NEXT_PUBLIC_API_URL` — Dashboard → API base (default `http://localhost:3001`)
- `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` — API-only Media Provider (Story 4.3)

## Cashier: local-first sell loop (Epic 2)

- App: `http://localhost:3000/login` — ID-primary **Masuk**
- Reuses `POST /auth/login`; only `cashier` role accepted on Cashier
- After login → `/pin` — first unlock **enrolls** a 6-digit POS PIN into Local Database (IndexedDB via `@pos-apps/local-db`); later unlocks verify the hash (PIN never stored or logged in plaintext)
- Offline: if PIN material exists from a prior online enroll, `/pin` unlocks without live Account Login; without material, unlock fails clearly
- After unlock → `/shift` if none is open (opening cash), otherwise `/menu`. Pull the catalog while online; the menu always reads its durable IndexedDB cache, so previously pulled products remain available offline. **Bayar** is disabled without an open Shift (AD-16). Hold still works. Open Shift: Cash In/Out with a reason, live Expected Cash, count the drawer, close (non-zero difference warns). After close, Pay stays disabled until the next open. Close does **not** drain Sync.
- Select a product to add it to **Keranjang**, adjust its quantity, then choose **Bayar**. Checkout creates an incomplete local sale; receipt confirmation marks it complete and clears the cart.
- **Tahan** parks the current cart on this device (IndexedDB `parkedCarts`) without creating a Sale or touching Stock / Sync. **Lanjutkan** restores lines and totals into an empty cart; **Buang** discards a hold (not Void). Held carts are device-local, not a shared Register queue.
- **Void**: `/void` lists today’s complete local sales. A manager PIN (enrolled once on this device, different from the cashier PIN) approves the reverse. Stock is restored locally immediately; the void Syncs after the Sale (`POST /sales/void`). Checkout **Batal** is still not Void.
- **Retur**: `/returns` looks up a synced Sale online (fails clearly offline). Cashier records qty + keputusan stok + alasan; cannot Refund. Admin katalog refunds cash on Dashboard **Retur**.
- **Pelanggan**: Cart Panel **Lampirkan pelanggan** (opsional). Sale tanpa pelanggan tetap selesai. Pelanggan baru di-queue lokal lalu Sync `POST /customers` sebelum penjualan. `/customers` menampilkan riwayat tanpa harga pokok.
- Completed sales are queued locally. When online, Cashier posts queued customer creates, then shift opens, then cash in/out, then shift closes, then each queued sale to `POST /sales/sync`; failed sync remains **Menunggu unggah** and never blocks the next sale. The API accepts a `sale_id` only once and posts STOCK OUT on the Stock Ledger in the same transaction (qty may go negative). New sales require `shift_id`. Shift close does not wait for the sales outbox.
- **Tutup hari** (Day Close): after 2C, finish is disabled while a Shift is open (FR-111). Cash summary **displays** this Register’s closed Shift Expected / counted / difference — it does not recompute FR-78. Sales total is still today’s complete Sales. FR-24 still hard-blocks finish while unsynced sales remain unless acknowledged. Confirm ends Account Login + POS PIN without wiping the Sync outbox (AD-8).
- Theme (system/light/dark) + language (id/en) via Settings
- Demo: `cashier` / `Cashier123!` then choose any 6-digit PIN on first enroll (remember it for offline)
- `CORS_ORIGIN` must include Cashier, e.g. `http://localhost:3002,http://localhost:3000`

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
packages/domain   Pure TS domain (adjustStock, acceptCompleteSale)
packages/types    Shared DTOs (auth, catalog, sync)
packages/local-db Cashier IndexedDB (PIN, catalog, sales, outbox)
```
