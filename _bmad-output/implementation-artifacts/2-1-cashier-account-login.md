---
baseline_commit: 4cfa8a96e50fd00deed3cd22ce4c9fad787d9575
---

# Story 2.1: Cashier Account Login

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As a cashier,
I want to sign in on the Cashier app with username/email + password,
so that I can proceed to POS PIN and start selling.

## Acceptance Criteria

1. **Given** Cashier can reach NestJS Auth (reuse Story 1.2 login contract)  
   **When** I submit valid **cashier** credentials  
   **Then** Account Login succeeds and the app advances to **POS PIN placeholder** (full PIN in 2.2)

2. **And** wrong credentials show a clear error; Cart/Checkout/Menu remain inaccessible (FR1, FR3)

3. **And** Login chrome uses ID-primary copy (e.g. “Masuk”) (UX-DR2)

4. **And** Settings / avatar exposes theme (system + light/dark) and language (id default / en) (UX-DR3, UX-DR13)

5. **And** Bearer token retained for online API calls; plaintext password never logged (NFR5)

6. **And** Cashier Menu ring-up is **not** usable until POS PIN succeeds (gate placeholder OK until 2.2)

7. **And** `catalog_admin` (non-cashier) login is rejected on Cashier with clear copy (Cashier is for cashiers)

8. **And** API CORS allows Cashier origin (`http://localhost:3000`) in addition to Dashboard

## Tasks / Subtasks

- [x] Task 1: API CORS for Cashier (AC: #8)
  - [x] Support multiple origins via `CORS_ORIGIN` (comma-separated) including `http://localhost:3000`
  - [x] Update `.env.example` + README

- [x] Task 2: Cashier session + prefs libs (AC: #4, #5)
  - [x] `apps/cashier/src/lib/auth-token.ts` (localStorage; distinct keys from Dashboard OK e.g. `pos_cashier_*`)
  - [x] `apps/cashier/src/lib/preferences.ts` — theme: `system|light|dark`; lang: `id|en`; persist
  - [x] Apply theme class on `<html>`; `lang` attribute from preference

- [x] Task 3: Login UI (AC: #1–3, #5, #7)
  - [x] `/login` with Masuk form; shadcn-style Button/Input/Label (copy patterns from Dashboard; do not import Dashboard packages)
  - [x] `POST /auth/login`; validate response shape; reject non-`cashier` role
  - [x] On success → `/pin` placeholder; on failure show API `message`
  - [x] Settings control on login (theme + language)

- [x] Task 4: Route gates (AC: #1, #6)
  - [x] `/` redirects: no token → `/login`; token → `/pin`
  - [x] `/pin` placeholder: requires session; shows “PIN kasir” coming soon; no Menu/Cart
  - [x] No Menu/Cart/Checkout routes yet

- [x] Task 5: Docs
  - [x] README Cashier login + CORS note + demo `cashier` user

## Dev Notes

### Scope

| In | Out |
|----|-----|
| Cashier Account Login + session | POS PIN verify / local-db PIN material (2.2) |
| Theme + language prefs | Catalog pull, Menu, Cart, Checkout |
| CORS multi-origin | AcceptCompleteSale / Sync |

### Reuse

- Types: `LoginRequest`, `LoginResponse`, `ApiErrorBody` from `@pos-apps/types`
- API: existing `POST /auth/login` — **do not** rewrite AuthModule
- UI patterns from Dashboard login — duplicate components under `apps/cashier`

### Anti-patterns

- Making Menu usable after login alone
- Building real PIN pad in 2.1
- Logging passwords
- Single CORS origin that blocks Cashier
- Importing `apps/dashboard` into cashier

### References

- Epics Story 2.1; AD-6 (login online, PIN material later); UX EXPERIENCE Account Login / Voice
- Prior: `1-2-account-login-with-roles.md`

## Dev Agent Record

### Agent Model Used

Composer (dev-story)

### Debug Log References

### Completion Notes List

- Cashier /login Masuk + Settings (theme/lang); only cashier role accepted
- Session keys pos_cashier_*; advance to /pin placeholder; Menu locked
- CORS multi-origin includes :3000; README updated

### File List

- apps/api/src/main.ts
- .env.example
- apps/api/.env (CORS only)
- apps/cashier/src/lib/auth-token.ts
- apps/cashier/src/lib/preferences.ts
- apps/cashier/src/components/**
- apps/cashier/src/app/login/**
- apps/cashier/src/app/pin/page.tsx
- apps/cashier/src/app/page.tsx
- apps/cashier/src/app/layout.tsx
- apps/cashier/src/app/globals.css
- README.md

### Review Findings

- [x] [Review][Patch] Pass lang into LoginForm (no interval polling)
- [x] [Review][Patch] CORS comma-list for Cashier+Dashboard

## Change Log

- 2026-08-07: Story context created (ready-for-dev)
- 2026-08-07: Implemented Cashier Account Login + review fixes; status → done
