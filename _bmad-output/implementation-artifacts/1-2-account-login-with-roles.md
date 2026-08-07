---
baseline_commit: 26d28d0cb686428f7acf265a321e085aab3421ff
---

# Story 1.2: Account Login with roles

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a catalog_admin (or cashier),
I want to sign in with username/email + password and receive an API session,
so that Dashboard (and later Cashier) can call protected APIs as the right role.

## Acceptance Criteria

1. **Given** Postgres is available and migrations for `users` exist (create only what this story needs: `user_id` UUID, username/email, password hash, role `cashier` | `catalog_admin`)
   **When** schema is applied
   **Then** the `users` table exists with those columns; no products/Sales/Stock tables required yet

2. **Given** a valid Account Login request hits NestJS Auth
   **When** credentials match a seeded (or created) user
   **Then** the API returns a **Bearer** access token and the user’s **role** (`cashier` | `catalog_admin`)

3. **And** wrong credentials are rejected with a clear JSON error `{ code, message }` and **no** token (Architecture error convention)

4. **And** passwords are stored **hashed**; plaintext passwords are **never** logged (PRD Security / NFR5)

5. **And** at least one seed (or documented create-user path) exists for both `catalog_admin` and `cashier` so local demo login works

6. **And** Dashboard has a minimal login form that stores the Bearer token for later API calls (placeholder home after login OK)

7. **And** Dashboard Login UI uses **ID-primary** microcopy (e.g. “Masuk”) with EN secondary available later (UX-DR2)

8. **And** Cashier Account Login UI is **not** required in this story (Epic 2 / Story 2.1)

## Tasks / Subtasks

- [x] Task 1: Postgres + Drizzle users schema (AC: #1, #4, #5)
  - [x] Add Drizzle **0.45.x** + `pg` (or `postgres`) to `apps/api`; document `DATABASE_URL` in root `.env.example` / README
  - [x] Create `users` table only: `user_id` (UUID v4 PK), login identifier (username and/or email — pick one column set and document), `password_hash`, `role` enum/check `cashier` | `catalog_admin`, timestamps as needed
  - [x] Migrations runnable from api package (e.g. `drizzle-kit` scripts); apply locally before demo
  - [x] Seed script or migration seed: one `catalog_admin` + one `cashier` with known demo passwords (document in README; never commit real secrets)

- [x] Task 2: NestJS `AuthModule` — login + JWT (AC: #2, #3, #4)
  - [x] Add `@nestjs/jwt`, `@nestjs/passport`, `passport-jwt`, password hasher (`bcrypt` or `argon2`) — do **not** invent a custom crypto scheme
  - [x] `POST /auth/login` (or equivalent under AuthModule): body = username/email + password; success → `{ access_token, token_type: "Bearer", role, user_id }` (field names may vary but must be documented and typed in `@pos-apps/types`)
  - [x] JWT payload includes at least `sub` = `user_id` and `role`; secret from env (`JWT_SECRET`); reasonable expiry (e.g. 1h–8h for Phase 1 demo OK; refresh tokens **out of scope**)
  - [x] Invalid credentials → 401 with `{ code, message }` (e.g. `AUTH_INVALID_CREDENTIALS`); never reveal which field was wrong in a way that dumps hashes
  - [x] Ensure request logging / Nest logger never prints password fields (strip body or avoid logging raw body on login)
  - [x] Keep existing `GET /health` working

- [x] Task 3: Shared types (AC: #2)
  - [x] Export Login request/response (+ role union) from `packages/types`
  - [x] API and Dashboard import these types (AD-5: types package only; no Nest in types)

- [x] Task 4: Dashboard Login UI (AC: #6, #7, #8)
  - [x] Minimal Login page/route on `apps/dashboard` (shadcn Input/Button OK; add components as needed)
  - [x] Primary CTA / title copy **Indonesian first**: “Masuk” (UX-DR2); EN can be secondary later — do not ship hype English marketing copy
  - [x] On success: persist Bearer token (and role) for later API calls — `localStorage` or memory+cookie is acceptable for Phase 1 scaffold; document choice; **do not** put JWT in URL
  - [x] After login: simple authenticated placeholder home (no product CRUD yet — Story 1.3)
  - [x] On failure: show clear error from API `message` (calm tone; never echo password)
  - [x] **Do not** build Cashier login UI (Story 2.1)

- [x] Task 5: Guard foundation for later stories (AC: #2; enables 1.3/1.4)
  - [x] Implement `JwtAuthGuard` (or Passport JWT strategy) verifying `Authorization: Bearer <token>`
  - [x] Expose a trivial protected probe optional for smoke (e.g. `GET /auth/me` → `{ user_id, role }`) — recommended so Dashboard can prove the token works
  - [x] **Do not** implement CatalogModule product mutations or role-403 catalog rules yet (Stories 1.3–1.4)

- [x] Task 6: Docs + verify (AC: #5)
  - [x] README: Postgres prerequisite, migrate/seed commands, demo users, `JWT_SECRET` / `DATABASE_URL`
  - [x] Unit/integration tests: login success, login failure, password hash not equal to plaintext, JWT guard rejects missing/invalid token

### Review Findings

- [x] [Review][Decision] Username login case sensitivity — resolved: **exact match** (`admin` ≠ `Admin`)
- [x] [Review][Patch] Document that Account Login usernames are case-sensitive (exact match after trim) [README.md]
- [x] [Review][Patch] Add DB CHECK (or enum) so `users.role` is only `cashier` | `catalog_admin` [apps/api/drizzle/0000_users.sql:5 / new migration]
- [x] [Review][Patch] Test real JwtAuthGuard rejection for missing/invalid Bearer (not override + hand-built exception) [apps/api/src/auth/auth.controller.spec.ts:54]
- [x] [Review][Patch] JwtAuthGuard should emit `{ code: AUTH_UNAUTHORIZED|AUTH_INVALID_TOKEN, message }` instead of Passport default / `HTTP_401` [apps/api/src/auth/jwt-auth.guard.ts:5]
- [x] [Review][Patch] Equalize login timing (dummy bcrypt on unknown user) and unify failure logs so they do not distinguish unknown user vs bad password [apps/api/src/auth/auth.service.ts:33]
- [x] [Review][Patch] Runtime-validate JWT `sub` non-empty and `role` allowlist in `JwtStrategy.validate` [apps/api/src/auth/jwt.strategy.ts:23]
- [x] [Review][Patch] Load `dotenv` in `drizzle.config.ts` so `db:migrate` sees `apps/api/.env` [apps/api/drizzle.config.ts:8]
- [x] [Review][Patch] Dashboard home: `setReady(true)` before login redirect; on `/auth/me` network failure clear session and redirect (same as `!res.ok`) [apps/dashboard/src/app/page.tsx:19]
- [x] [Review][Patch] `ApiExceptionFilter`: join ValidationPipe `message` arrays; `Logger.error` unexpected non-HTTP exceptions [apps/api/src/common/api-exception.filter.ts:31]
- [x] [Review][Patch] Catch malformed `password_hash` / compare throws → `AUTH_INVALID_CREDENTIALS` (not 500) [apps/api/src/auth/auth.service.ts:41]
- [x] [Review][Patch] Login form: assert `access_token` / `role` / `user_id` before `saveSession` [apps/dashboard/src/app/login/login-form.tsx:36]
- [x] [Review][Patch] Trim login DTO so whitespace-only fails validation [apps/api/src/auth/dto/login.dto.ts:3]
- [x] [Review][Patch] Stop lying `JWT_EXPIRES_IN` cast; pass string safely to `signOptions.expiresIn` [apps/api/src/auth/auth.module.ts:18]
- [x] [Review][Patch] Close Postgres pool on Nest shutdown [apps/api/src/db/client.ts:5]
- [x] [Review][Patch] Redirect already-authenticated users away from `/login` [apps/dashboard/src/app/login/page.tsx]
- [x] [Review][Defer] JwtStrategy does not re-load user from DB on every request — deferred, Phase 1 only `/auth/me` re-queries; revisit when Catalog/other guards land
- [x] [Review][Defer] No login rate limiting / lockout — deferred, out of Phase 1 demo scope (NFR hardening later)

## Dev Notes

### Scope boundary (critical)

| In scope | Out of scope (do NOT build) |
|----------|-----------------------------|
| Dashboard Account Login + API Auth | Cashier Account Login UI (2.1) |
| `users` table + seed | Products / Stock / Sales tables |
| Bearer JWT after login | POS PIN, PIN material, Offline Mode (AD-6 Cashier path) |
| Role returned in login response | Catalog write 403 enforcement UI+API (1.4) — but **include role in JWT now** |
| JwtAuthGuard + optional `/auth/me` | Refresh tokens, OAuth, multi-tenant |
| Drizzle + local Postgres | Production Fly/Neon provider lock-in (still document `DATABASE_URL`) |
| FR-1 / FR-3 / NFR5 foundation | SSO, biometrics, deep RBAC, manager override PIN (PRD §4.1 out of scope) |

Account Login ≠ POS PIN. Never mix PIN pad into Dashboard. PIN is Cashier-only later (AD-6).

**Do not** add `pos_pin` / PIN hash columns to the **server** `users` table in 1.2 — PIN verification material belongs in Cashier Local Database in Story 2.2 (AD-6), not Nest Auth.

### Architecture compliance

| Rule | Implication for 1.2 |
|------|---------------------|
| AD-5 | Auth DTOs in `packages/types`; domain stays free of Nest/HTTP/DB drivers; hashing/compare can live in api service (or pure helpers in domain if desired — **no** Drizzle in domain) |
| AD-6 | Account Login is **online API** only this story; do **not** write PIN material to `local-db` |
| AD-7 | Auth UI only on **Dashboard**; Cashier untouched except leaving scaffold alone |
| AD-11 | Roles `cashier` \| `catalog_admin` in DB + JWT now; mutation enforcement waits for 1.4 |
| Auth headers | `Authorization: Bearer <access_token>` |
| Errors | Nest returns `{ code, message }` JSON |
| IDs | `user_id` UUID v4 strings |
| Stack | Nest 11.1.x, Next 16.3.x, Drizzle 0.45.x, Postgres 16.x |

[Source: `ARCHITECTURE-SPINE.md` — AD-5–7, AD-11, Consistency Conventions, Stack, Structural Seed]

### UX requirements

- **UX-DR1:** shadcn + existing Dashboard theme tokens (`primary` `#1D4ED8`, `accent` `#D97706`)
- **UX-DR2:** ID-primary voice — Login CTA/heading **“Masuk”**; calm errors; never display raw password
- Dashboard desktop form OK; no Cashier chrome

[Source: `EXPERIENCE.md` Voice; `epics.md` UX-DR2; Story 1.2 ACs]

### Library / framework requirements

| Tech | Version / package | Notes |
|------|-------------------|--------|
| drizzle-orm | 0.45.x | Architecture seed |
| drizzle-kit | matching | Migrations |
| pg / postgres.js | current compatible | Driver for Postgres 16 |
| @nestjs/jwt + passport-jwt | Nest 11 compatible | Bearer extract |
| bcrypt or argon2 | current | Prefer argon2id if easy; bcrypt OK for Phase 1 |
| class-validator / zod | pick one | Validate login DTO at API boundary |
| shadcn components | as needed on dashboard | Button, Input, Label |

**Do not** use NextAuth/Auth.js unless Architecture is amended — spine says Nest AuthModule + Bearer.

**JWT storage on Dashboard:** Story AC says “stores the Bearer token for later API calls.” `localStorage` is acceptable for Phase 1 demo with XSS awareness noted in README; HttpOnly cookie would require same-site API proxy — **prefer localStorage + Authorization header** unless you already introduce a BFF (out of scope).

### Files to UPDATE (read before changing)

| File | Current state | This story changes | Preserve |
|------|---------------|--------------------|----------|
| `apps/api/src/app.module.ts` | Health only; smoke-imports domain/types | Import `AuthModule` (+ DB module) | HealthController still registered |
| `apps/api/src/main.ts` | Bootstrap + PORT + rejection handler | Optional ValidationPipe global; CORS for dashboard `3002` | Error exit handler |
| `apps/api/package.json` | Nest core only | Drizzle, jwt, passport, hasher, config | Existing scripts; keep `test` |
| `apps/dashboard/src/app/page.tsx` | Placeholder home | Redirect unauthenticated → login **or** replace with post-login home | Theme CSS vars |
| `apps/dashboard/src/app/layout.tsx` | Root layout ID lang | May wrap auth provider/client shell | `lang="id"` |
| `packages/types/src/index.ts` | PlaceholderId stub | Add auth DTOs / `Role` union | Keep exports working for build |
| `README.md` | Runbook ports | Postgres, migrate, seed, demo users, env vars | Serwist / planning artifact notes |

### Files to CREATE (suggested)

```text
apps/api/src/auth/          # module, controller, service, jwt.strategy, guards
apps/api/src/db/            # drizzle client, schema/users.ts
apps/api/drizzle/           # migrations
apps/api/.env.example       # or root .env.example
apps/dashboard/src/app/login/page.tsx
apps/dashboard/src/lib/auth-token.ts   # get/set Bearer
apps/dashboard/src/components/ui/...   # shadcn Button/Input as needed
```

### Anti-patterns to avoid

- ❌ Cashier login page or Serwist/IndexedDB auth (AD-7 / Epic 2)
- ❌ POS PIN pad on Dashboard
- ❌ Storing plaintext passwords or logging password fields
- ❌ Putting Nest or Drizzle imports into `packages/domain`
- ❌ Implementing product CRUD / AdjustStock “while we’re here”
- ❌ Refresh-token microservice complexity for Phase 1
- ❌ Hardcoding `JWT_SECRET` / DB password in committed source (use `.env` + example)
- ❌ Breaking `GET /health` or turbo `^build` package wiring from Story 1.1

### Testing requirements

- API unit/integration: login OK → token + role; login bad → 401 + `{ code, message }`; seeded users exist
- Guard: `/auth/me` (or protected route) with valid Bearer 200; missing/invalid 401
- Assert stored `password_hash` ≠ plaintext password
- Manual: Dashboard “Masuk” → token stored → placeholder home; wrong password shows error
- Keep `pnpm build` green; api + dashboard at minimum

### Previous story intelligence (1.1)

- Monorepo: `apps/{api,cashier,dashboard}`, `packages/{domain,types,local-db}`; pnpm 11 + turbo 2.10; `dev` depends on `^build`
- Shared packages emit **CommonJS** / Node16 for Nest interop; api uses `tsconfig.build.json` excluding `*.spec.ts`
- Cashier has Serwist (webpack build); Dashboard online-only — **leave Cashier alone** this story
- Health: `GET /health` → `{ status: "ok" }` — must still pass
- Review patches already applied: bootstrap `.catch`, types smoke import, README accuracy — don’t regress
- No Drizzle/Postgres yet — **first DB story**; introduce carefully with migrations + README

### Git intelligence summary

- Recent commits: scaffold + review cleanup (turbo outputs, ignores, Serwist revision)
- Expect new deps on api (+ maybe dashboard fetch helper only); lockfile will grow

### Latest tech information (as of 2026-08-06)

- NestJS auth pattern: `@nestjs/jwt` + `passport-jwt`, `ExtractJwt.fromAuthHeaderAsBearerToken()`, `JwtAuthGuard`
- Prefer short-lived access tokens; **skip refresh tokens** unless blocked — Phase 1 demo TTL is fine
- Password hashing: argon2id or bcrypt; never roll your own
- Drizzle 0.45.x per Architecture seed (verify on install)

### Project context reference

- No `project-context.md` — Architecture Spine + epics + Story 1.1 file are binding

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Story 1.2 ACs, UX-DR2, Epic 1 context]
- [Source: `_bmad-output/planning-artifacts/architecture/architecture-pos-apps-2026-08-05/ARCHITECTURE-SPINE.md` — AD-5–7, AD-11, Auth Bearer, Stack, AuthModule seed]
- [Source: `_bmad-output/planning-artifacts/prds/prd-pos-apps-2026-08-05/prd.md` — FR-1, FR-3, FR-32, §8 Security / NFR5]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-pos-apps-2026-08-06/EXPERIENCE.md` — Voice “Masuk”]
- [Source: `_bmad-output/implementation-artifacts/1-1-scaffold-the-pos-monorepo.md` — prior patterns]

## Dev Agent Record

### Agent Model Used

Cursor Grok 4.5

### Debug Log References

- Docker Postgres unavailable locally → Neon project `pos-apps` (`proud-frog-52389645`) used for `DATABASE_URL` (credentials only in gitignored `apps/api/.env`)
- Native `bcrypt` blocked by pnpm allowBuilds → used `bcryptjs` instead

### Implementation Plan

- Drizzle 0.45 + `users` migration/seed; Nest AuthModule (`POST /auth/login`, `GET /auth/me`) with JWT Bearer + bcryptjs
- Shared auth DTOs in `@pos-apps/types`; Dashboard `/login` “Masuk” + localStorage session; ApiExceptionFilter for `{ code, message }`

### Completion Notes List

- `users` table: `user_id`, `username`, `password_hash`, `role`, `created_at`; seeds `admin`/`cashier`
- Login returns Bearer + role; invalid creds → 401 `AUTH_INVALID_CREDENTIALS`; `/auth/me` guarded
- Dashboard login stores token in localStorage; home verifies session via `/auth/me`
- Tests: 8 passing (health + auth service/controller); `pnpm build` green; API smoke verified

### File List

- `.env.example`
- `README.md`
- `pnpm-workspace.yaml`
- `pnpm-lock.yaml`
- `packages/types/src/index.ts`
- `apps/api/package.json`
- `apps/api/src/auth/roles.ts`
- `apps/api/src/db/db-shutdown.service.ts`
- `apps/api/drizzle/0001_users_role_check.sql`
- `apps/api/drizzle.config.ts`
- `apps/api/drizzle/0000_users.sql`
- `apps/api/drizzle/meta/`
- `apps/api/src/app.module.ts`
- `apps/api/src/main.ts`
- `apps/api/src/common/api-exception.filter.ts`
- `apps/api/src/db/schema.ts`
- `apps/api/src/db/client.ts`
- `apps/api/src/db/seed.ts`
- `apps/api/src/auth/auth.module.ts`
- `apps/api/src/auth/auth.controller.ts`
- `apps/api/src/auth/auth.controller.spec.ts`
- `apps/api/src/auth/auth.service.ts`
- `apps/api/src/auth/auth.service.spec.ts`
- `apps/api/src/auth/jwt.strategy.ts`
- `apps/api/src/auth/jwt-auth.guard.ts`
- `apps/api/src/auth/current-user.decorator.ts`
- `apps/api/src/auth/dto/login.dto.ts`
- `apps/dashboard/src/app/page.tsx`
- `apps/dashboard/src/app/login/page.tsx`
- `apps/dashboard/src/app/login/login-form.tsx`
- `apps/dashboard/src/lib/auth-token.ts`
- `apps/dashboard/src/components/ui/button.tsx`
- `apps/dashboard/src/components/ui/input.tsx`
- `apps/dashboard/src/components/ui/label.tsx`
- `_bmad-output/implementation-artifacts/1-2-account-login-with-roles.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/deferred-work.md`

## Change Log

- 2026-08-06: Implemented Account Login (Drizzle users, Nest JWT Auth, Dashboard Masuk); story → review
- 2026-08-07: Code review patches (role CHECK, JWT guard codes, timing-safe login, dashboard session edges); story → done

---

**Story completion status:** done

