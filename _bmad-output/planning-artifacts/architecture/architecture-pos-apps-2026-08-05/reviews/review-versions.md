# Version reality-check — Architecture Spine

**Checked:** 2026-08-13 (npm registry + vendor docs; not training data)  
**Spine:** `ARCHITECTURE-SPINE.md` (updated 2026-08-13)  
**Install:** root / `apps/cashier` / `apps/api` `package.json` + `pnpm-lock.yaml`  
**Claimed (memlog / task):** Cloudinary npm 2.10.x verified 2026-08-13; next 16.3.0; nest 11.1.x; drizzle 0.45.1; serwist 9  
**Method:** `npm view` dist-tags + publish times; lockfile resolved versions; Cloudinary / Next / Nest / Serwist / PostgreSQL / RFC 9562 docs  
**Supersedes:** 2026-08-06 review (greenfield pins, `idb` as Stack line, `next-pwa` dual-option — all stale vs current spine)

## Verdict

**PASS WITH FINDINGS.** Every named npm pin in the Stack table **exists**, is **not deprecated**, and **fits** the role. Claimed Next / Nest / Drizzle / Serwist lines **match brownfield**. Cloudinary **2.10.0 is npm `latest`** and the v2 API / `q_auto` / `f_auto` still match current Cloudinary docs — but it is **not installed**. The Stack intro (“verified against installed brownfield + npm (Cloudinary)”) overclaims: Cloudinary was npm-checked only. UUID v4 and PostgreSQL 16.x still exist, but look like un-researched defaults next to 2026 consensus (UUID v7 for PG PKs; PG 18 current major).

No dead packages. Do not jump Nest 12 alpha or Drizzle 1.0 RC.

---

## 1. Claimed pins vs npm vs lockfile

Checked 2026-08-13. `latest` = npm dist-tag.

| Spine / claimed | Spec in install | Lockfile resolved | npm `latest` | Exists? | Brownfield match? |
| --- | --- | --- | --- | --- | --- |
| Next.js **16.3.0** | cashier + dashboard `next`: `16.3.0` (exact) | **16.3.0** | **16.3.0** (canary `16.3.1-canary.*`) | Yes — stable 2026-08-03 | **Exact** |
| React 19.2.8 | `19.2.8` exact | 19.2.8 | **19.2.8** | Yes | Exact |
| NestJS `@nestjs/core` **11.1.x** | `^11.1.0` | **11.1.28** | **11.1.29** (2026-08-10); `next` = `12.0.0-alpha.5` | Yes | **Band match** (1 patch behind latest) |
| Drizzle ORM **0.45.1** | `0.45.1` exact | **0.45.1** | **0.45.2** (2026-03-27); `rc`/`beta` = 1.0.0-* | Yes | **Exact pin**; not latest patch |
| Serwist **9** | `@serwist/next` + `serwist` `^9.0.14` | **9.5.12** | **9.5.12** (`preview` = 10.0.0-preview.14) | Yes | **Range match** (caret → current 9.x) |
| Cloudinary **2.10.x** | **absent** from all `package.json` / lockfile | — | **2.10.0** (2026-04-25; package modified 2026-07-12; only 2.10.x release) | Yes | **No — not installed** |
| TypeScript **^5.8** | root `^5.8.2` | **5.9.3** | **7.0.2** (`next` 7.1.0-dev) | Yes (5.9.3 current 5.x) | Range match; **not** npm latest |
| pnpm **11.20.0** | `packageManager`: `pnpm@11.20.0` | n/a | **11.21.0** (2026-08-09) | Yes | Exact pin; 1 patch behind |
| turbo **^2.10.0** | `^2.10.0` | **2.10.8** | **2.10.9** (2026-08-07) | Yes | Range match; 1 patch behind |
| PostgreSQL **16.x** | not a npm dep (infra) | — | Community: 16.14 supported until **2028-11-09**; current majors **18.4 / 17.10** also supported | Yes | Unverifiable in repo (provider deferred) |

**Claimed five-pack:** next / nest / drizzle / serwist **confirmed**. Cloudinary version **confirmed on npm**, **not** in brownfield.

---

## 2. Named technology — still exists and still fits

### Next.js 16.3 + React 19.2 + Vercel `[ASSUMPTION]`

- **Exists:** `next@16.3.0` is npm `latest`. Release notes: [Next.js 16.3](https://nextjs.org/blog/next-16-3) (2026-08-03). Engines: Node `>=20.9.0`.
- **Fits:** App Router PWA Cashier + online Dashboard. Vercel documents 16.3 support ([vercel.com/blog/vercel-supports-next-js-16-3](https://vercel.com/blog/vercel-supports-next-js-16-3), 2026-08-04).
- **Caveat (researched, not a pin-break):** Next 16 defaults to Turbopack for `dev`/`build`. See Serwist.

### NestJS 11.1 + JWT / RolesGuard

- **Exists:** `@nestjs/core@11.1.29` is `latest`. Engines: Node `>=20`. Peers: `@nestjs/common` ^11, `rxjs` ^7, `reflect-metadata` ^0.1.12 \|\| ^0.2.0 — install satisfies.
- **Fits:** Modular API (Identity, Catalog, Inventory, …) and `RolesGuard` + Passport JWT is still the documented Nest 11 pattern. Brownfield already uses `@nestjs/jwt` 11.0.2, `@nestjs/passport` 11.0.5, `passport-jwt` 4.0.1 (all current).
- **Do not jump:** dist-tag `next` = `12.0.0-alpha.5`. Spine 11.1.x is correct.

### Drizzle ORM 0.45.1 + `pg` + PostgreSQL

- **Exists:** `drizzle-orm@0.45.1` published 2025-12-10; `latest` is 0.45.2. Driver `pg@8.22.0` installed; npm `latest` **8.23.0**.
- **Fits:** `drizzle-orm/node-postgres` is current; brownfield `apps/api/src/db/client.ts` uses it. Dialect in migrations is `postgresql`.
- **Kit gap:** `drizzle-kit` **0.30.6** (2025-03-27) is installed, **not in Stack**. npm `latest` kit is **0.31.10**. Kit 0.30.6 has no `drizzle-orm` peer; pairing works today but is an undocumented, older companion. Do not bump kit to 0.31.x without bumping orm — kit 0.31 has historically required “latest orm” and fails in monorepos when versions diverge.

### Serwist 9 + `@serwist/next`

- **Exists:** `@serwist/next@9.5.12` / `serwist@9.5.12` = `latest`. Peer: `next >=14`, `react >=18`, `typescript >=5`. Next 16.3 + React 19.2 satisfy.
- **Fits PWA Cashier.** Abandoned `next-pwa` correctly not named.
- **Fit constraint (docs, 2026):** [`@serwist/next` does not support Turbopack](https://serwist.pages.dev/docs/next/turbo). Official path is webpack **or** migrate to `@serwist/turbopack` (also 9.5.12) / configurator mode. Brownfield already forces `next build --webpack` and disables SW outside production — **install matches the constraint**. Stack table is silent on webpack. Serwist 10 is preview only — do not pin.

### Cloudinary Node SDK 2.10.x (AD-12)

- **Exists:** `cloudinary@2.10.0` = npm `latest`. Official install: `npm install cloudinary`; usage `require('cloudinary').v2` / `import { v2 as cloudinary } from 'cloudinary'` ([Node SDK docs](https://cloudinary.com/documentation/node_integration)). Node 9+ for 2.x.
- **Fits MediaService-only:** server SDK (upload, admin destroy, URL gen). Not a Cashier/browser package — AD-12 isolation is correct.
- **Transforms still current:** Cloudinary image optimization docs still prescribe `q_auto` and `f_auto` as slash-separated URL components (`f_auto/q_auto`, not comma). `public_id` and `secure_url` remain the upload-response fields to persist.
- **Brownfield:** **not in any package.json or lockfile.** MediaService is future work. Pin is npm-real, install-absent.

### IndexedDB via `idb` (paradigm / `packages/local-db`, not in Stack)

- **Exists:** `idb@8.0.3` = npm `latest`, last publish 2025-05-07, not deprecated. Install: `packages/local-db` `^8.0.3`.
- **Fits** local-primary outbox + catalog/image cache. Still the thin IndexedDB wrapper; Dexie is the heavier alternative, not required.
- **Gap:** Stack table dropped `idb` after brownfield ratification. Version is install-owned but not spine-pinned.

### pnpm 11.20 + Turborepo 2.10

- **Exists and fits** a `apps/*` + `packages/*` monorepo. `create-turbo@2.10.9` still current. Patch drift only.

### TypeScript ^5.8 (resolved 5.9.3)

- **Exists.** 5.9.3 is the current 5.x line. npm `latest` is **TypeScript 7.0.2** (Go native port, GA ~2026-07).
- **Fits on purpose:** Nest CLI still loads the TypeScript **JS compiler API** (lockfile shows `@nestjs/cli` / schematics on `typescript@5.9.3`). Next 16.3 *can* use TS 7 via `experimental.useTypeScriptCli`, but TS 7 has no stable programmatic API — jumping workspace TS to 7 would break Nest CLI. Spine `^5.8` matching brownfield is **correct**; it was not documented as a researched “stay on 5.x because Nest” decision vs “workspace latest.”

---

## 3. Brownfield install match

### Matches

| Spine | Install |
| --- | --- |
| `apps/cashier` Next PWA | `apps/cashier`: next 16.3.0, `@serwist/next` ^9.0.14, `next build --webpack` |
| `apps/dashboard` Next online-only | `apps/dashboard`: next 16.3.0, **no** Serwist |
| `apps/api` NestJS | `@nestjs/core` ^11.1.0 → 11.1.28 |
| Drizzle 0.45.1 | exact `0.45.1` |
| pnpm 11.20.0 · turbo ^2.10 | `packageManager` + lock 2.10.8 |
| `packages/domain` no UI/DB/Cloudinary | domain deps = `@pos-apps/types` only |
| `packages/local-db` IndexedDB | `idb` ^8.0.3, used in `src/db.ts` |
| AD-5 apps → packages | cashier/dashboard/api depend on workspace packages; packages do not import apps |

### Does not match (or incomplete)

| Spine claim | Reality |
| --- | --- |
| Stack: Cloudinary 2.10.x “verified against installed brownfield” | **No `cloudinary` dependency anywhere.** npm-only check. |
| Structural seed: `packages/ui` | **Directory does not exist.** Presentational UI lives in apps (Phosphor + CVA). |
| Stack omits `idb` and `drizzle-kit` | Both are installed and version-sensitive (`idb` 8.0.3; kit 0.30.6 vs latest 0.31.10). |
| “Code owns versions after install” vs AD-12 pin 2.10.x | Pin is ahead of code. Fine as a *future* MediaService constraint; dishonest as a brownfield seed line. |

---

## 4. Committed decisions that name tech — research vs assertion

| Decision | Researched 2026-08-13? | Notes |
| --- | --- | --- |
| AD-1..3 local-first + idempotent `sale_id` | N/A (architecture, not a library) | — |
| AD-5 domain purity / no Cloudinary in cashier | **Yes** | Server SDK is Node-only; keeping it in MediaService is the documented integration model |
| AD-6 Account Login JWT vs local PIN | **Yes** | `@nestjs/jwt` 11 + passport-jwt 4 still current |
| AD-7 Cashier-only Offline / Dashboard online | **Yes** | Serwist only on cashier; dashboard has no SW |
| AD-9 catalog + image bytes in IndexedDB | **Partial** | `idb` exists; durable image-cache quota/eviction not library-checked (browser quota, not npm) |
| AD-11 / AD-17 `RolesGuard` then resource×action JWT | **Yes** | Nest 11 Guards + JWT claims still the enforcement model |
| AD-12 `cloudinary` 2.10.x v2, `q_auto`/`f_auto`, `public_id`/`secure_url` | **Yes (npm + Cloudinary docs)** | Version and API current; **not installed** |
| AD-15 Nest domain modules | **Yes** | Nest 11 module seams unchanged |
| Stack: Vercel for Next | **Yes** | 16.3 supported; ASSUMPTION is accurate |
| Ops: API = Node process, provider deferred | **Yes** | Nest on Vercel is a Function/Fluid mapping, not a long-running process. Spine correctly does **not** assume Vercel for API. In-process jobs (Deferred) conflict with serverless timeouts if someone later hosts API on Vercel anyway. |
| Consistency: UUID **v4** strings | **Looks asserted** | RFC 9562 (2024) + 2026 PG guidance: **v7** for time-ordered PKs (`sale_id`, `movement_id`, …); v4 still valid, especially if IDs leak to customers and creation-time must stay hidden. No evidence this trade-off was researched. |
| PostgreSQL **16.x** managed | **Soft** | 16 is supported through Nov 2028; **not** the current major (18). Managed hosts still offer 16. Fine if inherited from Phase 1; not “current default.” |
| TypeScript ^5.8 | **Install-matched; latest not chosen** | Staying on 5.9.3 is the right Nest-compatible choice; spine does not record that check. |
| Money integer minor units / ISO-8601 UTC | N/A | Conventions, not packages |

---

## 5. Findings

### high

1. **Cloudinary is npm-current but not brownfield.** AD-12 and Stack pin `cloudinary` 2.10.x. Registry: `2.10.0` = `latest`. Lockfile: zero hits. Stack sentence “verified … against installed brownfield + npm (Cloudinary)” is false for the brownfield half. *Fix:* Either add `cloudinary@2.10.0` when MediaService is implemented and keep the pin, or move the version to Deferred until then and say “npm `latest` 2.10.0 checked YYYY-MM-DD.”

### medium

2. **`drizzle-kit` 0.30.6 is installed, omitted from Stack, and a major behind `latest` 0.31.10.** ORM is honestly pinned at 0.45.1 (latest patch 0.45.2). Companion kit is nine months older than the ORM pin. *Fix:* Pin kit next to ORM in Stack (e.g. keep 0.30.6 with orm 0.45.1, or bump both: orm 0.45.2 + kit 0.31.10) and re-verify `drizzle-kit generate` in the pnpm workspace.

3. **UUID v4 looks un-researched.** Convention still *works*; 2026 default for Postgres PK/index locality is UUID v7 (RFC 9562). *Fix:* Explicit ASSUMPTION — “v4 for client-generated `sale_id` (no time leak / `crypto.randomUUID`)” or switch ledger/sale PKs to v7.

4. **`packages/ui` in Structural Seed does not exist.** Not a version pin, but the seed does not match install. *Fix:* Drop from seed until the package is created, or add the package.

5. **TypeScript latest is 7.0.2; spine ^5.8 is correct but unexplained.** Nest CLI needs the 5.x/6.x JS API. *Fix:* One Stack footnote: “pin 5.9.x; do not take npm `latest` (TS 7) until Nest CLI supports it.”

### low

6. Patch drift (do not fail the spine): `@nestjs/core` 11.1.28 vs 11.1.29; turbo 2.10.8 vs 2.10.9; pnpm 11.20.0 vs 11.21.0; `pg` 8.22.0 vs 8.23.0; `drizzle-orm` 0.45.1 vs 0.45.2.

7. Stack silent on Serwist **webpack** requirement / `@serwist/turbopack` alternative. Brownfield README already documents it.

8. `idb` 8.0.3 used and current, missing from Stack.

9. PostgreSQL 16.x is supported, not newest (18). Acceptable ASSUMPTION while provider is deferred.

10. Drizzle 1.0 RC (`1.0.0-rc.4`) and Serwist 10 preview exist — watch, do not pin.

---

## 6. Outdated / dead pins

**None** among committed npm names. `next-pwa` is no longer in the spine (correct). Hono is no longer in the spine (correct).

---

## 7. Summary

Claimed Next **16.3.0**, Nest **11.1.x**, Drizzle **0.45.1**, Serwist **9** are live and match the repo. Cloudinary **2.10.0** is live npm `latest` and the v2 / `q_auto` / `f_auto` story still matches Cloudinary docs, but it is **not** in the install — the brownfield-verification sentence is the main integrity defect. Stay on Nest 11 and Drizzle 0.45; do not take TS 7 or Drizzle 1.0 RC. Record UUID v4 vs v7 and `drizzle-kit` as explicit, researched pins.
