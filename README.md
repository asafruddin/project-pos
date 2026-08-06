# POS Apps

Coffee-shop POS Phase 1 monorepo (Instant Checkout + Offline Mode).

## Stack

| Surface | Tech | Port |
|---------|------|------|
| Cashier | Next.js 16.3 App Router + Serwist PWA + shadcn/Tailwind | `3000` |
| Dashboard | Next.js 16.3 App Router + shadcn/Tailwind (online-only) | `3002` |
| API | NestJS 11.1 (`GET /health`) | `3001` |

Shared packages: `@pos-apps/domain`, `@pos-apps/types`, `@pos-apps/local-db`.

## Prerequisites

- Node.js 20+
- [pnpm](https://pnpm.io) 9.x (`packageManager` field pins the version)

## Install & build

```bash
pnpm install
pnpm build
```

`pnpm build` runs Turborepo across packages and all three apps. Cashier production builds use **webpack** (`next build --webpack`) so `@serwist/next` can emit `apps/cashier/public/sw.js`.

## Local development

```bash
# All apps (parallel)
pnpm dev

# One app
pnpm dev:cashier    # http://localhost:3000
pnpm dev:dashboard  # http://localhost:3002
pnpm dev:api        # http://localhost:3001  → GET /health → { "status": "ok" }
```

## Serwist / PWA notes (Cashier only)

- Uses `@serwist/next` + `serwist` — **not** `next-pwa`.
- Service worker source: `apps/cashier/src/app/sw.ts` → build output `apps/cashier/public/sw.js` (gitignored).
- Next.js 16 defaults to Turbopack for `dev` / `build`. Cashier **`build` is forced to webpack** so Serwist InjectManifest works. If you switch Cashier to Turbopack builds later, evaluate `@serwist/turbopack` instead.
- Dashboard has **no** service worker (Architecture AD-7).

## Planning artifacts

Product requirements, architecture, UX, and sprint tracking live under `_bmad-output/`. They are the source of truth for PRD / Architecture / UX — **do not relocate or delete** them when changing app code. Same for `_bmad/`, `docs/`, and `.agents/`.

## Workspace layout

```text
apps/cashier      Next PWA (Serwist)
apps/dashboard    Next online-only
apps/api          NestJS API
packages/domain   Pure TS domain stub
packages/types    Shared DTO stub
packages/local-db Local IndexedDB stub (cashier later)
```
