---
baseline_commit: 7f156f5c9a0f213a0588ee2cfa4e4144682737f7
---

# Story 1.1: Scaffold the POS monorepo

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want a runnable Turborepo with Cashier, Dashboard, NestJS API, and shared packages,
so that catalog and sell work can ship on the Architecture stack without re-scaffolding later.

## Acceptance Criteria

1. **Given** a clean checkout of the repo (preserve existing `_bmad/`, `_bmad-output/`, `docs/` — do not delete planning artifacts)
   **When** the Phase 1 monorepo is scaffolded via `pnpm dlx create-turbo@latest` (or equivalent manual layout matching Architecture Structural Seed)
   **Then** these paths exist and are TypeScript workspaces:
   - `apps/cashier` — Next.js **16.3.x** App Router app (placeholder page OK)
   - `apps/dashboard` — Next.js **16.3.x** App Router app (placeholder page OK)
   - `apps/api` — NestJS **11.1.x** app that starts and serves a **GET health** endpoint (e.g. `/health` → 200 JSON)
   - `packages/domain`, `packages/types`, `packages/local-db` — stub packages exporting at least an empty/module placeholder

2. **And** package manager is **pnpm**; workspace uses **Turborepo 2.10.x** (`pnpm-workspace.yaml`, root `turbo.json`, root scripts that invoke turbo)

3. **And** dependency direction holds **AD-5**:
   - `apps/*` may depend on `packages/*`
   - `packages/*` must **not** import `apps/*`
   - `packages/domain` has **no** React/Next, NestJS, HTTP, or DB-driver imports

4. **And** from repo root, `pnpm install` and turbo `build` (or documented equivalent covering all three apps + packages) succeed

5. **And** README (root) documents how to run `cashier`, `dashboard`, and `api` locally (ports + commands)

6. **And** `apps/cashier` and `apps/dashboard` are wired for **shadcn/ui + Tailwind** (init/scaffold + theme CSS variables OK; no full feature screens) (**UX-DR1**)

7. **And** `apps/cashier` includes **Serwist** PWA scaffolding (not abandoned `next-pwa`) so Cashier can be installable/offline-capable later (**UX-DR14**, **NFR3**). Minimal: `@serwist/next` (or `@serwist/turbopack` if choosing Turbopack path) + `sw` source + web app manifest stub; production build emits service worker

8. **And** no product / Sale / Stock / Auth business features beyond placeholders (those start Story 1.2+)

## Tasks / Subtasks

- [x] Task 1: Preserve brownfield planning tree while introducing monorepo (AC: #1)
  - [x] Do **not** wipe `_bmad/`, `_bmad-output/`, `docs/`, or `.agents/`
  - [x] Prefer scaffolding into repo carefully (create-turbo with merge) or generate apps/packages manually to Architecture seed layout
  - [x] Ensure `.gitignore` covers `node_modules`, `.next`, `dist`, `public/sw.js` (Serwist output), `.turbo`, env files

- [x] Task 2: Root workspace + Turborepo (AC: #2, #4)
  - [x] `packageManager: pnpm@…`, `pnpm-workspace.yaml` including `apps/*` and `packages/*`
  - [x] `turbo.json` pipelines: at least `build`, `dev`, `lint` (as applicable)
  - [x] Root scripts: `build`, `dev` (filterable), document filters for each app

- [x] Task 3: `apps/cashier` Next.js 16 + shadcn + Serwist (AC: #1, #6, #7)
  - [x] Next.js 16.3.x App Router; placeholder home page
  - [x] Tailwind + shadcn init; seed CSS variables from DESIGN.md brand layer (`primary` `#1D4ED8`, `accent` `#D97706`) — full component library not required
  - [x] Serwist: follow current `@serwist/next` getting started (`swSrc`/`swDest`); **do not use `next-pwa`**
  - [x] Note Turbopack vs webpack: if `@serwist/next` requires webpack for SW build, document `next build --webpack` (or use `@serwist/turbopack` if adopted) in README
  - [x] Add minimal `manifest.webmanifest` (or Next metadata) for installability stub

- [x] Task 4: `apps/dashboard` Next.js 16 + shadcn (AC: #1, #6)
  - [x] Same Next/Tailwind/shadcn baseline as cashier
  - [x] **No** Serwist / Offline Mode / IndexedDB on dashboard (AD-7)
  - [x] Placeholder page OK

- [x] Task 5: `apps/api` NestJS 11 (AC: #1, #4)
  - [x] NestJS 11.1.x TypeScript app
  - [x] Health controller/module: `GET /health` returns `{ status: "ok" }` (or equivalent)
  - [x] No Postgres/Drizzle yet (Story 1.2); no Auth/Catalog modules yet

- [x] Task 6: Shared packages stubs (AC: #1, #3)
  - [x] `packages/types` — empty export or placeholder type file; will own Sync DTO later
  - [x] `packages/domain` — pure TS stub only; **zero** Nest/React/DB imports
  - [x] `packages/local-db` — stub only (idb wiring starts later stories); may depend on `types` only
  - [x] Optional: leave `packages/ui` out unless shadcn shared package pattern is chosen; Architecture marks ui optional early

- [x] Task 7: Wire workspace deps + prove build (AC: #3, #4)
  - [x] Example: `apps/api` depends on `packages/domain` + `packages/types` (even if unused beyond import smoke)
  - [x] Example: `apps/cashier` depends on `packages/types` (+ `local-db` stub OK)
  - [x] Run `pnpm install` + turbo build; fix package `exports`/`main`/`types` so resolution works

- [x] Task 8: README runbook (AC: #5, #7)
  - [x] Commands: install, build, `dev` for cashier/dashboard/api with ports
  - [x] Note Serwist/PWA build caveats (webpack vs turbopack)
  - [x] Explicit: planning artifacts under `_bmad-output/` are source of truth for PRD/Arch/UX — do not relocate

## Dev Notes

### Scope boundary (critical)

- This story is **scaffold only**. No users table, no login UI beyond possible shadcn empty shell, no catalog, no Local DB schema, no Sync.
- Greenfield app code inside a repo that already has BMAD planning docs — **merge, don't replace**.

### Architecture compliance

| Rule | Implication for 1.1 |
|------|---------------------|
| AD-5 dependency direction | Enforce via package boundaries now |
| AD-7 surface separation | Serwist/PWA + future `local-db` only on cashier |
| Structural Seed | Exact folder names: `apps/cashier`, `apps/dashboard`, `apps/api`, `packages/{domain,local-db,types}` |
| Stack versions | Next 16.3.x, Nest 11.1.x, turbo 2.10.x, pnpm; Serwist not next-pwa |
| Ops | Don't pick Fly/Neon yet (Deferred) — local scripts only |

[Source: `_bmad-output/planning-artifacts/architecture/architecture-pos-apps-2026-08-05/ARCHITECTURE-SPINE.md` — Stack, Structural Seed, AD-5, AD-7]

### UX requirements for this story only

- **UX-DR1:** shadcn + Tailwind on both Next apps; brand tokens from DESIGN.md (`primary` `#1D4ED8`, `accent` `#D97706`). Theme system default can wait for Settings (Story 2.1 / UX-DR3) but CSS vars should support light/dark later.
- **UX-DR14:** Serwist scaffold on cashier only.

[Source: `_bmad-output/planning-artifacts/epics.md` UX-DR1, UX-DR14; `ux-designs/ux-pos-apps-2026-08-06/DESIGN.md`]

### Library / framework requirements

| Tech | Version / package | Notes |
|------|-------------------|--------|
| pnpm | workspace | Required |
| Turborepo | 2.10.x | `create-turbo@latest` or pin compatible |
| Next.js | 16.3.x | App Router; React 19 as Next 16 peer |
| NestJS | @nestjs/core 11.1.x | CLI nest new or manual |
| Serwist | `@serwist/next` + `serwist` | Official getting started: wrap `next.config` with `withSerwistInit`, `swSrc`/`swDest` |
| shadcn/ui | latest compatible with Tailwind on Next 16 | `pnpm dlx shadcn@latest init` per app (or shared ui package later) |
| TypeScript | workspace via starter | Shared `tsconfig` bases recommended |

**Serwist / Next 16 gotcha:** Next 16 defaults to Turbopack. `@serwist/next` historically expects webpack for SW emission; either document `next build --webpack` for cashier or evaluate `@serwist/turbopack`. Prefer documenting the chosen approach in README. Never add `next-pwa`.

### File structure requirements

Target after story:

```text
pos-apps/
  apps/
    cashier/          # Next PWA + shadcn
    dashboard/        # Next + shadcn (online-only)
    api/              # NestJS + /health
  packages/
    domain/           # pure TS stub
    local-db/         # stub
    types/            # stub
  turbo.json
  pnpm-workspace.yaml
  package.json
  README.md
  _bmad/              # KEEP
  _bmad-output/       # KEEP
  docs/               # KEEP
```

Naming: `packages/<name>`, `apps/<name>`; kebab-case package folders; domain later uses PascalCase types / kebab-case files (Architecture conventions).

### Anti-patterns to avoid

- ❌ Deleting `_bmad-output` or rewriting planning docs into `apps/`
- ❌ Putting NestJS inside Next API routes “for speed”
- ❌ Installing Drizzle/Postgres in 1.1 “while we’re here”
- ❌ Adding `next-pwa` / Workbox-only abandoned stacks
- ❌ Importing Nest or React into `packages/domain`
- ❌ Implementing Offline Mode IndexedDB schema in 1.1 (belongs in later cashier stories)
- ❌ Making Dashboard a PWA with service worker

### Testing requirements

- Manual smoke: `pnpm install`, turbo `build`, start api and hit `/health`, start both Next apps and load placeholder pages
- Optional: minimal Nest e2e/unit for health controller if easy with Nest testing module
- No product/Sale tests yet

### Previous story intelligence

N/A — first implementation story. Repo git history is planning-only (`initial-commit` + untracked planning artifacts).

### Git intelligence summary

- Working tree is essentially empty of application code; only BMAD/docs present
- Expect large first commit of scaffold after this story is implemented (do not commit unless user asks)

### Latest tech information (as of 2026-08-06)

- Architecture seed verified npm versions on 2026-08-06 — prefer those pins unless create-turbo forces newer compatible minors
- Serwist docs: https://serwist.pages.dev/docs/next/getting-started — `withSerwistInit`, `app/sw.ts` → `public/sw.js`, add `@serwist/next/typings` + `webworker` lib in tsconfig, gitignore generated SW
- Next.js 16: Turbopack default for `dev`/`build`; SW tooling may still need webpack path — document explicitly

### Project context reference

- No `project-context.md` found in repo
- Use Architecture Spine + epics.md as binding constraints

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Story 1.1 ACs, UX-DR1/14, Additional Requirements starter]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-pos-apps-2026-08-05/ARCHITECTURE-SPINE.md` — Stack, Structural Seed, AD-5, AD-7]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-pos-apps-2026-08-06/DESIGN.md` — colors/primary/accent, shadcn inheritance]
- [Source: `_bmad-output/implementation-artifacts/sprint-status.yaml` — tracking key `1-1-scaffold-the-pos-monorepo`]

## Dev Agent Record

### Agent Model Used

Cursor Grok 4.5

### Debug Log References

- Nested `create-next-app` lockfiles/`node_modules` removed so root pnpm workspace owns installs
- Cashier production build forced to webpack for `@serwist/next` SW emission

### Implementation Plan

- Manual Architecture Structural Seed (preserve BMAD tree) + `create-next-app@16.3.0` for Next apps
- Shared packages emit CommonJS for Nest interop; turbo `^build` wires package → app builds
- Serwist via `@serwist/next` `withSerwistInit`; shadcn theme tokens in CSS vars + `components.json`

### Completion Notes List

- Scaffolded pnpm + Turborepo 2.10.8 monorepo with `apps/{cashier,dashboard,api}` and `packages/{domain,types,local-db}`
- NestJS 11.1.28 `GET /health` → `{ status: "ok" }` with unit test; smoke-verified at runtime
- Next 16.3.0 cashier/dashboard with Tailwind v4 + shadcn CSS variables (`primary` `#1D4ED8`, `accent` `#D97706`)
- Cashier Serwist PWA: `src/app/sw.ts` → `public/sw.js` on `next build --webpack`; manifest stub + `/~offline`
- `pnpm install` + `pnpm build` succeed; planning dirs preserved
- Root README documents ports, filters, Serwist webpack note, and `_bmad-output` immutability

### File List

- `.gitignore`
- `README.md`
- `package.json`
- `pnpm-workspace.yaml`
- `pnpm-lock.yaml`
- `turbo.json`
- `tsconfig.base.json`
- `apps/api/package.json`
- `apps/api/tsconfig.json`
- `apps/api/nest-cli.json`
- `apps/api/jest.config.json`
- `apps/api/src/main.ts`
- `apps/api/src/app.module.ts`
- `apps/api/src/health.controller.ts`
- `apps/api/src/health.controller.spec.ts`
- `apps/cashier/package.json`
- `apps/cashier/tsconfig.json`
- `apps/cashier/next.config.ts`
- `apps/cashier/next-env.d.ts`
- `apps/cashier/postcss.config.mjs`
- `apps/cashier/eslint.config.mjs`
- `apps/cashier/components.json`
- `apps/cashier/.gitignore`
- `apps/cashier/src/app/layout.tsx`
- `apps/cashier/src/app/page.tsx`
- `apps/cashier/src/app/globals.css`
- `apps/cashier/src/app/manifest.ts`
- `apps/cashier/src/app/sw.ts`
- `apps/cashier/src/app/~offline/page.tsx`
- `apps/cashier/src/lib/utils.ts`
- `apps/cashier/public/icon-192.png`
- `apps/cashier/public/icon-512.png`
- `apps/dashboard/package.json`
- `apps/dashboard/tsconfig.json`
- `apps/dashboard/next.config.ts`
- `apps/dashboard/next-env.d.ts`
- `apps/dashboard/postcss.config.mjs`
- `apps/dashboard/eslint.config.mjs`
- `apps/dashboard/components.json`
- `apps/dashboard/.gitignore`
- `apps/dashboard/src/app/layout.tsx`
- `apps/dashboard/src/app/page.tsx`
- `apps/dashboard/src/app/globals.css`
- `apps/dashboard/src/lib/utils.ts`
- `packages/types/package.json`
- `packages/types/tsconfig.json`
- `packages/types/src/index.ts`
- `packages/domain/package.json`
- `packages/domain/tsconfig.json`
- `packages/domain/src/index.ts`
- `packages/local-db/package.json`
- `packages/local-db/tsconfig.json`
- `packages/local-db/src/index.ts`
- `_bmad-output/implementation-artifacts/1-1-scaffold-the-pos-monorepo.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Change Log

- 2026-08-06: Scaffolded POS monorepo (Turborepo + Next cashier/dashboard + Nest API + shared packages + Serwist); story → review

---

**Story completion status:** review
