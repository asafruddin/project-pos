---
stepsCompleted: ["step-01-validate-prerequisites", "step-02-design-epics", "step-03-create-stories", "step-04-final-validation"]
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-pos-apps-2026-08-05/prd.md
  - _bmad-output/planning-artifacts/architecture/architecture-pos-apps-2026-08-05/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/ux-designs/ux-pos-apps-2026-08-06/DESIGN.md
  - _bmad-output/planning-artifacts/ux-designs/ux-pos-apps-2026-08-06/EXPERIENCE.md
epicsApproved: true
uxDrPatched: 2026-08-13
phase2Appended: 2026-08-13
---

# POS Apps - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for POS Apps, decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: Cashier can sign in with username/email + password (Account Login). (PRD FR-1)
FR2: After Account Login, cashier must enter a 6-digit POS PIN before Cashier Menu is usable. (PRD FR-2)
FR3: Wrong Account Login or wrong POS PIN is rejected with a clear error; no access to Cart Panel/Checkout. (PRD FR-3)
FR4: After Day Close completes, app returns to Account Login; prior POS PIN session cannot continue. (PRD FR-4)
FR5: POS PIN can unlock Cashier offline if prior Account Login succeeded and Local Database has PIN/session material. (PRD FR-5)
FR6: Cashier can browse/select products from Cashier Menu. (PRD FR-6)
FR7: Each selected product appears on Cart Panel with price; panel stays in sync with selections. (PRD FR-7)
FR8: Cashier can start Checkout when Cart Panel has at least one item. (PRD FR-8)
FR9: Cashier can record payment for Checkout total (cash / simple paid record). (PRD FR-9)
FR10: Cashier can print Receipt (or on-screen confirm) after payment; success marks Sale complete. (PRD FR-10)
FR11: After complete Sale Sync/accept, Dashboard Stock updates from that Sale. (PRD FR-11; arch: via AcceptCompleteSale)
FR12: If Receipt fails, Sale stays incomplete; Stock unchanged; retry/cancel available. (PRD FR-12)
FR13: Cashier can remove/change qty on Cart Panel before Checkout. (PRD FR-13)
FR14: While offline, Cashier can run full sell loop against Local Database. (PRD FR-14)
FR15: Offline complete Sale is success for cashier (not a pending sale); Sync may still wait. (PRD FR-15)
FR16: Offline complete Sale persists in Local Database across app restart. (PRD FR-16)
FR17: On reconnect, app Syncs local complete Sales to server (idempotent on sale_id). (PRD FR-17)
FR18: After successful Sync, Stock and Dashboard reflect those Sales. (PRD FR-18)
FR19: Sync failure keeps Sale successful on device; retries; does not block next Sale. (PRD FR-19)
FR20: UI shows Sync / waiting-to-upload status without re-labeling complete Sale as incomplete. (PRD FR-20)
FR21: Phase 1 includes offline acceptance drill (off → sell → reconnect → Sync → Stock/Dashboard). (PRD FR-21)
FR22: Cashier can start Day Close from POS. (PRD FR-22)
FR23: Day Close shows sales total, cash summary, and offline Sync status. (PRD FR-23)
FR24: Day Close cannot finish while unsynced complete Sales remain unless cashier explicitly acknowledges. (PRD FR-24)
FR25: Day Close shows Today’s Sales Report (transactions, totals, prices). (PRD FR-25)
FR26: Cashier can confirm report to finish Day Close. (PRD FR-26)
FR27: After confirm, POS session ends and app returns to Account Login. (PRD FR-27)
FR28: Catalog_admin can create/edit products (name, price, Stock qty) on Dashboard. (PRD FR-28)
FR29: Dashboard products available on Cashier Menu after catalog pull into Local Database. (PRD FR-29)
FR30: Dashboard Stock reflects complete Sales after AcceptCompleteSale/Sync. (PRD FR-30)
FR31: Dashboard lists recent Sales / daily totals (list + totals, not charts). (PRD FR-31)
FR32: Roles cashier | catalog_admin; cashier cannot mutate catalog. (PRD FR-32)

### NonFunctional Requirements

NFR1: Reliability — no silent loss of offline complete Sales; durable Local Database + Sync retry. (PRD §8; FR-16, FR-19)
NFR2: Performance — Local Database path: product search <100ms, add to Cart <50ms, Checkout commit <300ms. (PRD §4.2)
NFR3: Platform — Cashier + Dashboard are web/PWA (Serwist); native shell only as contingency spike. (PRD §8; Architecture Stack)
NFR4: Receipt — Phase 1 demo accepts browser print or on-screen Receipt confirm as complete Sale. (PRD §8)
NFR5: Security — passwords and POS PIN not logged in plaintext; Bearer token for API; POS PIN local-only. (PRD §8; Architecture conventions)
NFR6: Money — integer minor units in domain/API; UUID v4 for sale_id/product_id/user_id/device_id; ISO-8601 UTC in APIs. (Architecture conventions)
NFR7: Shared Sync DTO in packages/types; Cashier and NestJS API must use the same shape. (Architecture AD-3 / conventions)

### Additional Requirements

- **Starter:** Greenfield monorepo via `pnpm dlx create-turbo@latest` (Turborepo 2.10.x) — Epic 1 Story 1 should scaffold this.
- **Apps:** `apps/cashier` (Next.js 16 PWA), `apps/dashboard` (Next.js 16), `apps/api` (NestJS 11).
- **Packages:** `domain`, `local-db`, `types`, optional `ui`; dependency rule apps → packages only; domain has no UI/DB drivers. (AD-5)
- **Paradigm:** Local-primary — all complete Sales written to Local Database first; no direct API Sale create. (AD-1)
- **Sale status:** `incomplete` | `complete` only; complete requires payment + Receipt. (AD-2)
- **Sync:** Idempotent on `sale_id`; NestJS Sync endpoint invokes `AcceptCompleteSale` only. (AD-3, AD-4)
- **Stock:** Server Stock only via `AcceptCompleteSale`; Dashboard `AdjustStock` separate; Cashier optimistic qty is not server truth. (AD-4)
- **Catalog:** When online, Cashier pulls catalog into Local Database; Cashier Menu always reads Local Database. (AD-9)
- **Prices:** Line `price_minor` snapshot at complete; Sync must not re-price. (AD-10)
- **Roles:** `cashier` | `catalog_admin` enforced on API. (AD-11)
- **Local DB:** IndexedDB via `idb`; stores catalog cache, PIN material, Sales, Sync outbox. (Stack / AD-6)
- **Server DB:** PostgreSQL 16 + Drizzle ORM; Nest modules Auth, Catalog, SalesSync, Stock.
- **Ops:** Vercel for Next apps; NestJS on Node host; managed Postgres; envs local/preview/production. (exact providers deferred)
- **Oversell on Sync:** Until product policy decided, `AcceptCompleteSale` fails closed with clear Sync error; Sale stays complete locally. (Architecture Deferred)
- **UJ coverage:** UJ-1 Instant Checkout, UJ-2 Offline Mode, UJ-3 Day Close must be realizable by story slices.

### UX Design Requirements

Source spines (final): `ux-designs/ux-pos-apps-2026-08-06/DESIGN.md` + `EXPERIENCE.md`. Spines win on conflict with mocks. Mock refs: `mockups/cashier-sell.html`, `pos-pin.html`, `offline-sync.html`, `day-close.html`.

UX-DR1: UI system — Cashier + Dashboard use **shadcn/ui** on Next.js + Tailwind; DESIGN.md is brand-layer delta only (POS blue primary, warm amber accent). (DESIGN Foundation / Brand)
UX-DR2: Language — **Indonesian first**, English second; default locale `id`; Settings switch persists per device. Voice table is string source of truth (e.g. Masuk, PIN kasir, Keranjang, Bayar, Menunggu unggah, Mode offline, Tutup hari). (EXPERIENCE Foundation / Voice)
UX-DR3: Theme — light + dark; **system default** with in-app override (Settings / avatar). (EXPERIENCE Foundation)
UX-DR4: Cashier density — tap targets ≥ `{spacing.tap-min}` (48px); Pay / PIN pad keys / product tiles ≥ `{spacing.tap-comfortable}` (56px); no hover-only affordances on phone. (DESIGN Layout / EXPERIENCE Accessibility)
UX-DR5: Cashier layout — Menu + **right Cart Panel** on `md+`; below `md`, Cart is Sheet with same behaviors; modal stack one level. (EXPERIENCE IA; mock `cashier-sell.html`)
UX-DR6: PIN kasir — 6-digit pad + clear error copy; include paste-capable masked input fallback (a11y). (EXPERIENCE Component Patterns; mock `pos-pin.html`)
UX-DR7: Offline banner — calm “Mode offline” (optional “Penjualan tetap jalan”); not alarm-red; sell continues when Local DB allows. (EXPERIENCE Voice / States; mock `offline-sync.html`)
UX-DR8: Sync chip — states synced / waiting (`Menunggu unggah`) / retrying; **must not** re-label complete Sale as incomplete or “pending sale”. (EXPERIENCE Voice / FR20; mock `offline-sync.html`)
UX-DR9: Receipt success copy — “Struk berhasil — penjualan selesai.” (or EN secondary); on-screen confirm peer to browser print. (EXPERIENCE Voice / NFR4)
UX-DR10: Day Close acknowledge — hard-block finish; explicit acknowledge (e.g. checkbox) naming unsynced count before finish enables; report rows stay “Selesai” with optional Sync chip only. (EXPERIENCE Flow 3 / mock `day-close.html`)
UX-DR11: Money display — format via locale (`id-ID` → IDR); never show raw minor units to cashiers; tabular figures. (DESIGN Typography; EXPERIENCE i18n intent)
UX-DR12: Dashboard — desktop sidebar + content; shadcn forms/tables; catalog_admin mutate / cashier read-only; list + totals, no charts; online-only (no Offline Mode). (EXPERIENCE IA / Foundation)
UX-DR13: Settings — theme + language reachable from avatar/gear on both apps. (EXPERIENCE IA)
UX-DR14: PWA — Cashier installable PWA with Serwist (Architecture/NFR3); Local Database persists across restart. (EXPERIENCE Responsive; NFR3)

**UX-DR → Story map**

| UX-DR | Primary stories |
|-------|-----------------|
| UX-DR1, UX-DR3, UX-DR13, UX-DR14 | 1.1, 1.2, 2.1 |
| UX-DR2, UX-DR11, UX-DR12 | 1.3, 1.5, 2.1+ |
| UX-DR4, UX-DR5 | 2.3, 2.4, 2.5 |
| UX-DR6 | 2.2 |
| UX-DR7, UX-DR8, UX-DR9 | 2.6, 2.7, 2.8 |
| UX-DR10 | 3.1, 3.2, 3.3 |

**Note:** UX validation report left open AA contrast / full ID glossary polish; implement Voice table + tap floors + Sync honesty as Phase 1 bar; do not claim full WCAG 2.2 AA until spines are Updated.

### FR Coverage Map

FR1: Epic 2 — Account Login
FR2: Epic 2 — POS PIN gate
FR3: Epic 2 — Auth error feedback
FR4: Epic 3 — Return to Account Login after Day Close
FR5: Epic 2 — Offline POS PIN unlock
FR6: Epic 2 — Cashier Menu selection
FR7: Epic 2 — Cart Panel with prices
FR8: Epic 2 — Start Checkout
FR9: Epic 2 — Record payment
FR10: Epic 2 — Print / confirm Receipt
FR11: Epic 2 — Stock update after AcceptCompleteSale
FR12: Epic 2 — Print failure → Sale incomplete
FR13: Epic 2 — Edit Cart Panel before Checkout
FR14: Epic 2 — Offline sell loop on Local Database
FR15: Epic 2 — Offline complete Sale is success
FR16: Epic 2 — Durable local persistence
FR17: Epic 2 — Sync on reconnect
FR18: Epic 2 — Stock/Dashboard after Sync
FR19: Epic 2 — Sync retry without blocking sales
FR20: Epic 2 — Sync status indicator
FR21: Epic 2 — Offline acceptance drill
FR22: Epic 3 — Start Day Close
FR23: Epic 3 — Day Close checks
FR24: Epic 3 — Block finish if Sync incomplete
FR25: Epic 3 — Today’s Sales Report
FR26: Epic 3 — Confirm report
FR27: Epic 3 — Session end → Account Login
FR28: Epic 1 — Manage products on Dashboard
FR29: Epic 1 — Catalog on server (feeds Cashier after pull in Epic 2)
FR30: Epic 1 — Stock model / Dashboard Stock display foundation
FR31: Epic 1 — Sales list and daily totals on Dashboard
FR32: Epic 1 — Roles cashier | catalog_admin

## Epic List

### Epic 1: Stock the coffee shop
A catalog_admin can create and edit products (name, price, Stock) on the Dashboard, with roles enforced, on a running Turborepo monorepo (cashier, dashboard, NestJS api, shared packages).
**FRs covered:** FR28, FR29, FR30, FR31, FR32

### Epic 2: Sell with Instant Checkout (online & offline)
Dewi can Account Login, unlock with POS PIN, ring up from Cashier Menu into Cart Panel, pay, complete a Sale via Receipt, including full Offline Mode on Local Database with Sync that updates Dashboard Stock without blocking the next Sale.
**FRs covered:** FR1, FR2, FR3, FR5, FR6, FR7, FR8, FR9, FR10, FR11, FR12, FR13, FR14, FR15, FR16, FR17, FR18, FR19, FR20, FR21

### Epic 3: Close the day
Dewi can Day Close with sales total, cash, and Sync checks, review Today’s Sales Report, acknowledge unsynced Sales if needed, then return to Account Login.
**FRs covered:** FR4, FR22, FR23, FR24, FR25, FR26, FR27

## Epic 1: Stock the coffee shop

A catalog_admin can create and edit products (name, price, Stock) on the Dashboard, with roles enforced, on a running Turborepo monorepo (cashier, dashboard, NestJS api, shared packages).

### Story 1.1: Scaffold the POS monorepo

As a developer,
I want a runnable Turborepo with Cashier, Dashboard, NestJS API, and shared packages,
So that catalog and sell work can ship on the Architecture stack without re-scaffolding later.

**Acceptance Criteria:**

**Given** a clean checkout of the repo
**When** I run `pnpm dlx create-turbo@latest` (or equivalent) and wire the Phase 1 layout
**Then** the monorepo exists with:
- `apps/cashier` — Next.js 16 app (placeholder page OK)
- `apps/dashboard` — Next.js 16 app (placeholder page OK)
- `apps/api` — NestJS 11 app that starts and serves a health endpoint
- `packages/domain`, `packages/types`, `packages/local-db` (stubs OK; packages may be empty modules)
**And** package manager is **pnpm**; workspace uses **Turborepo**
**And** dependency direction holds: apps may depend on packages; packages must not import apps; `packages/domain` has no UI/HTTP/DB driver imports (AD-5)
**And** from repo root, `pnpm install` and turbo `build` (or documented equivalent) succeed for all three apps
**And** README (or package scripts) documents how to run `cashier`, `dashboard`, and `api` locally
**And** `apps/cashier` and `apps/dashboard` are wired for **shadcn/ui + Tailwind** (scaffold/theme tokens OK; full screens later) (UX-DR1)
**And** `apps/cashier` includes **Serwist** (or equivalent) PWA scaffolding so the Cashier can be installed offline-capable (UX-DR14, NFR3)
**And** no product/Sale/Stock business features are required in this story beyond placeholders

### Story 1.2: Account Login with roles

As a catalog_admin (or cashier),
I want to sign in with username/email + password and receive an API session,
So that Dashboard (and later Cashier) can call protected APIs as the right role.

**Acceptance Criteria:**

**Given** Postgres is available and migrations for `users` exist (create only what this story needs: `user_id` UUID, username/email, password hash, role `cashier` | `catalog_admin`)
**When** a valid Account Login request hits NestJS Auth
**Then** the API returns a Bearer token and the user’s role
**And** wrong credentials are rejected with a clear error (no token)
**And** passwords are stored hashed; plaintext passwords are never logged (NFR5)
**And** at least one seed (or documented create-user path) exists for `catalog_admin` and `cashier` so local demo login works
**And** Dashboard has a minimal login form that stores the Bearer token for later API calls (placeholder home after login OK)
**And** Dashboard Login UI uses ID-primary microcopy (e.g. “Masuk”) with EN secondary available later (UX-DR2)
**And** Cashier Account Login UI is **not** required in this story (Epic 2)

### Story 1.3: Create and edit products

As a catalog_admin,
I want to create and edit products (name, price, Stock qty) on the Dashboard,
So that the coffee shop catalog and Stock levels exist on the server for Cashier pull and sales later.

**Acceptance Criteria:**

**Given** I am logged in on Dashboard as `catalog_admin` with a valid Bearer token
**When** I create a product with name, price, and Stock qty
**Then** the API persists it with `product_id` (UUID v4) and price as integer minor units (NFR6)
**And** I can edit name, price, and Stock qty for an existing product
**And** Stock qty changes go through an `AdjustStock`-style path (not Sale Sync) (AD-4)
**And** Dashboard shows a simple product list with name, price, and Stock qty
**And** product form/list use shadcn patterns on desktop Dashboard layout (UX-DR1, UX-DR12)
**And** prices display formatted for locale (IDR / `id-ID`), not raw minor units (UX-DR11, NFR6)
**And** create/edit only the `products` (and Stock) tables this story needs — no Sales schema required
**And** unauthenticated requests to mutate products are rejected

### Story 1.4: Enforce catalog role on API

As a shop owner,
I want only `catalog_admin` to mutate the catalog,
So that a cashier account cannot change products or Stock from the API or Dashboard.

**Acceptance Criteria:**

**Given** a user authenticated as `cashier` with a valid Bearer token
**When** they call any create/update/AdjustStock product endpoint
**Then** the API returns 403 (or equivalent forbidden) and no catalog/Stock data changes
**And** a `catalog_admin` can still create/edit products and AdjustStock as in Story 1.3
**And** Dashboard hides or disables create/edit/Stock-adjust UI for `cashier` role (read-only view OK if list endpoint allows)
**And** role checks live on the API (not UI-only) (AD-11, FR32)

### Story 1.5: View Stock and sales list shell

As a catalog_admin,
I want Dashboard Stock levels and a sales list / daily totals view,
So that I can see inventory now and have a place for synced Sales once Cashier Sync lands.

**Acceptance Criteria:**

**Given** I am logged in on Dashboard as `catalog_admin` (or `cashier` if read allowed)
**When** I open the Stock / products view
**Then** I see current server Stock qty per product (FR30 foundation)
**And** there is a Sales list + daily totals screen that works with zero Sales (empty state OK) (FR31)
**And** if a minimal synced-Sales read model is needed, create only what this list needs; do not implement Cashier Sync or `AcceptCompleteSale` here (Epic 2)
**And** money shown as minor units / formatted display consistent with NFR6 and UX-DR11 (locale IDR)
**And** the sales list is list + totals only — no charts (UX-DR12)
**And** empty sales state does not imply Cashier Offline Mode or local-only Sales (Dashboard online-only)

## Epic 2: Sell with Instant Checkout (online & offline)

Dewi can Account Login, unlock with POS PIN, ring up from Cashier Menu into Cart Panel, pay, complete a Sale via Receipt, including full Offline Mode on Local Database with Sync that updates Dashboard Stock without blocking the next Sale.

### Story 2.1: Cashier Account Login

As a cashier,
I want to sign in on the Cashier app with username/email + password,
So that I can proceed to POS PIN and start selling.

**Acceptance Criteria:**

**Given** Cashier app can reach NestJS Auth (reuse Story 1.2 login contract)
**When** I submit valid credentials
**Then** Account Login succeeds and the app advances to POS PIN entry (PIN UI may be placeholder until Story 2.2)
**And** wrong credentials show a clear error; Cart Panel and Checkout remain inaccessible (FR1, FR3)
**And** Login chrome uses ID-primary copy (e.g. “Masuk”) per EXPERIENCE Voice (UX-DR2)
**And** Settings / avatar exposes theme (system default + light/dark) and language (id default / en) (UX-DR3, UX-DR13)
**And** Bearer token is retained for online API calls; plaintext password is never logged (NFR5)
**And** Cashier Menu ring-up is not usable until POS PIN succeeds (enforced in Story 2.2 if gate not fully wired yet)

### Story 2.2: POS PIN unlock (online and offline material)

As a cashier,
I want to enter a 6-digit POS PIN after Account Login, including offline when material exists,
So that the Cashier Menu unlocks only for an authorized device session.

**Acceptance Criteria:**

**Given** Account Login has succeeded on this device
**When** I enter the correct 6-digit POS PIN
**Then** Cashier Menu becomes usable (FR2)
**And** wrong PIN shows a clear error; Cart Panel and Checkout stay blocked (FR3)
**And** after successful online Account Login + PIN, PIN/session material is stored in Local Database (AD-6)
**And** while offline, if Local Database has PIN material from a prior Account Login, correct PIN unlocks Cashier without live Account Login (FR5)
**And** if offline and PIN material is missing, unlock fails with a clear error
**And** POS PIN is never logged in plaintext (NFR5)
**And** PIN pad keys meet `{spacing.tap-comfortable}` (56px); error copy uses ID-primary (“PIN salah. Coba lagi.”) (UX-DR4, UX-DR6)
**And** a paste-capable masked numeric input (or equivalent) is available alongside the pad for accessibility (UX-DR6)

### Story 2.3: Catalog pull into Local Database and Cashier Menu

As a cashier,
I want products from the Dashboard catalog available on Cashier Menu via Local Database,
So that I always ring up from the same local catalog online or offline.

**Acceptance Criteria:**

**Given** I am POS-PIN unlocked and the device is online
**When** Cashier pulls catalog from apps/api
**Then** products (name, price_minor, product_id, Stock qty as available) are written into Local Database (FR29, AD-9)
**And** Cashier Menu lists products by reading **only** Local Database (never live API browse for ring-up)
**And** product tiles meet tap-comfortable height; empty catalog shows guidance to pull when online (UX-DR4, EXPERIENCE empty catalog)
**And** products without a valid price cannot be added (or show blocked state) (FR6 consequence)
**And** if pull fails while online, UI shows a clear error; Menu still uses last successful Local Database catalog if present
**And** `packages/local-db` catalog store is created/altered only as needed for this story

### Story 2.4: Cart Panel select and edit quantities

As a cashier,
I want to select products into a right Cart Panel and change qty/remove before Checkout,
So that the order matches what the customer ordered.

**Acceptance Criteria:**

**Given** Cashier Menu shows products from Local Database
**When** I select a product
**Then** it appears on the Cart Panel with its price (FR6, FR7)
**And** Cart Panel stays in sync as I add items
**And** I can change quantity or remove a line before Checkout (FR13)
**And** qty steppers / remove controls are ≥ 48px tap targets (UX-DR4)
**And** layout follows UX-DR5: Cashier Menu + right Cart Panel on `md+`; Cart as Sheet below `md` (see `mockups/cashier-sell.html`)
**And** Cart / totals use ID-primary labels (e.g. “Keranjang”) and locale-formatted money (UX-DR2, UX-DR11)
**And** local path meets NFR2 targets where measurable in this slice (product search <100ms, add to Cart <50ms) or documents measurement approach

### Story 2.5: Checkout and payment

As a cashier,
I want to start Checkout from a non-empty Cart and record payment,
So that I can move to Receipt and complete the Sale.

**Acceptance Criteria:**

**Given** Cart Panel has at least one item
**When** I start Checkout
**Then** Checkout shows the cart total (integer minor units / display) (FR8)
**And** Checkout cannot start on an empty Cart
**And** I can record payment for the total (cash / simple paid record) (FR9)
**And** primary Pay CTA uses ID “Bayar”, height ≥ 56px (UX-DR2, UX-DR4)
**And** an in-progress Sale may exist as `incomplete` until Receipt succeeds (AD-2); Sale is not `complete` yet
**And** Checkout commit on Local Database path targets <300ms where measurable (NFR2)

### Story 2.6: Receipt gate completes Sale in Local Database

As a cashier,
I want payment + Receipt success to mark the Sale complete in Local Database,
So that Stock Sync only ever sees real Sales and failed print does not fake completion.

**Acceptance Criteria:**

**Given** payment has been recorded for an in-progress Sale
**When** Receipt succeeds via browser print **or** on-screen Receipt confirm (NFR4)
**Then** Sale status becomes `complete` in Local Database with `sale_id` UUID assigned no later than complete (FR10, AD-1, AD-2)
**And** each line stores `price_minor` snapshot at complete (AD-10)
**And** if Receipt fails or is cancelled, Sale stays `incomplete`; server Stock must not change; retry print or cancel in-progress Sale is available (FR12)
**And** there is **no** API path that creates a Sale directly — complete Sales are Local Database first (AD-1)
**And** offline or online, a complete Sale is success for the cashier even if Sync has not run yet (FR15)
**And** success messaging uses ID-primary Receipt copy (“Struk berhasil — penjualan selesai.”) and must not say “pending sale” (UX-DR9, UX-DR8)

### Story 2.7: Offline sell and durable persistence

As a cashier,
I want the full sell loop to work offline and survive app restart,
So that coffee-shop sales continue when the network is down.

**Acceptance Criteria:**

**Given** Cashier is unlocked with Local Database catalog and PIN material
**When** the device is offline (no API)
**Then** I can complete Menu → Cart → Checkout → payment → Receipt against Local Database (FR14)
**And** a complete offline Sale is treated as success, not a “pending sale” (FR15)
**And** after app restart, complete Sales remain in Local Database (FR16, NFR1)
**And** Offline banner shows calm “Mode offline” (not connection-error-only framing) (UX-DR7)
**And** Sync may still be waiting; UI must not re-label the Sale as incomplete (FR20 partial — status indicator in 2.8)
**And** Cashier PWA / Serwist path supports durable offline use across reload (UX-DR14)

### Story 2.8: Sync outbox and AcceptCompleteSale updates Stock

As a cashier,
I want complete Sales to Sync to the server when online without blocking the next Sale,
So that Dashboard Stock and sales list catch up safely.

**Acceptance Criteria:**

**Given** one or more `complete` Sales exist in Local Database
**When** the device is online (immediately after complete if online, or on reconnect)
**Then** Cashier uploads via Sync using a shared DTO from `packages/types` (NFR7, AD-3)
**And** NestJS Sync endpoint is **idempotent on `sale_id`** and invokes **only** `AcceptCompleteSale` for Stock mutation (AD-3, AD-4)
**And** after successful accept, Dashboard Stock and sales list reflect those Sales (FR11, FR18)
**And** Sync failure keeps the Sale complete locally; retries; does not block starting the next Sale (FR17, FR19, NFR1)
**And** UI shows Sync / waiting-to-upload status without marking the Sale incomplete (FR20)
**And** Sync chip copy uses ID-primary “Menunggu unggah” (and distinct retrying / synced labels); never “pending sale” / incomplete for complete Sales (UX-DR8)
**And** Sync uses line `price_minor` snapshots; must not re-price from live catalog (AD-10)
**And** until oversell policy is decided, `AcceptCompleteSale` fails closed with a clear Sync error; Sale stays complete locally (Architecture Deferred)

### Story 2.9: Offline acceptance drill

As a stakeholder,
I want a documented offline acceptance drill,
So that Phase 1 can prove Instant Checkout + Offline Mode together.

**Acceptance Criteria:**

**Given** Epic 2 sell + Sync stories are implemented
**When** someone runs: go offline → complete at least one Sale → reconnect → Sync → check Stock/Dashboard
**Then** the drill is documented (README or ops note) with expected results (FR21)
**And** no complete Sale is silently lost across the drill (NFR1)
**And** Sync status behavior matches FR20 during the wait-to-upload window

## Epic 3: Close the day

Dewi can Day Close with sales total, cash, and Sync checks, review Today’s Sales Report, acknowledge unsynced Sales if needed, then return to Account Login.

### Story 3.1: Start Day Close with checks

As a cashier,
I want to start Day Close and see sales total, cash summary, and Sync status,
So that I know whether the day is ready to close.

**Acceptance Criteria:**

**Given** I am POS-PIN unlocked on Cashier
**When** I start Day Close (FR22)
**Then** I see sales total for the day, a cash summary, and offline Sync status (FR23)
**And** totals are derived from Local Database complete Sales for the day (minor units / display per NFR6)
**And** Sync status distinguishes synced vs waiting-to-upload without relabeling complete Sales as incomplete
**And** Day Close chrome uses ID-primary “Tutup hari” (UX-DR2)

### Story 3.2: Block finish if unsynced Sales remain

As a cashier,
I want Day Close to hard-block finish while unsynced complete Sales remain unless I explicitly acknowledge,
So that Sales are not silently abandoned at close.

**Acceptance Criteria:**

**Given** Day Close is open and one or more complete Sales are still waiting to Sync
**When** I try to finish Day Close without acknowledging
**Then** finish is blocked with a clear hard warning (FR24, AD-8)
**And** acknowledge is an **explicit** control (e.g. checkbox) that names the unsynced count; soft OK/dismiss without acknowledge is forbidden (UX-DR10; see `mockups/day-close.html`)
**And** if I explicitly acknowledge remaining unsynced Sales, finish may proceed
**And** unsynced Sales remain in Local Database for later Sync after next login (AD-8)
**And** if Sync is fully caught up, finish is not blocked for Sync reasons

### Story 3.3: Today’s Sales Report and confirm

As a cashier,
I want to review Today’s Sales Report and confirm it,
So that Day Close is intentional and auditable for the shift.

**Acceptance Criteria:**

**Given** Day Close checks are satisfied (or unsynced Sales explicitly acknowledged)
**When** I view Today’s Sales Report
**Then** I see transactions, totals, and prices for the day (FR25)
**And** I can confirm the report to finish Day Close (FR26)
**And** report is list/summary style (not charts); money in minor units / formatted display (NFR6, UX-DR11)
**And** complete Sale rows show success status (e.g. “Selesai”); Sync wait uses chip only — never “pending sale” (UX-DR8, UX-DR10)

### Story 3.4: End session and return to Account Login

As a cashier,
I want confirming Day Close to end the POS session and return to Account Login,
So that the next shift cannot continue on my PIN session.

**Acceptance Criteria:**

**Given** I have confirmed Today’s Sales Report to finish Day Close
**When** Day Close completes
**Then** the app returns to Account Login (FR27)
**And** the prior POS PIN session cannot continue; Account Login + POS PIN are required again (FR4)
**And** local complete Sales / Sync outbox data needed for later Sync is not wiped solely by Day Close (AD-8)

## Epic List (Phase 2)

### Epic 4: Product catalog, media, and Stock Ledger (wave 2A)
Raka can run a full catalog with Product Media, and every quantity change is an auditable Stock Ledger movement, without breaking Instant Checkout or Offline Mode.
**FRs covered:** FR33–FR54, FR41–FR43, AD-4, AD-9, AD-12, AD-13, AD-18, AD-19

### Epic 5: Purchasing, Void, and Returns (wave 2B)
Budi can receive a Purchase Order into Stock; Dewi can hold, Void, and Return with honest inventory — Store Credit waits for Epic 6.
**FRs covered:** FR55–FR67, FR69, AD-4 commands, AD-14

### Epic 6: Customers, Shift, and cashier ops (wave 2C)
Dewi opens a Shift before selling, attaches Customers, and Day Close uses Shift cash totals. Loyalty does not gate this epic.
**FRs covered:** FR70–FR81, FR110–FR112, FR111, AD-16, AD-14

### Epic 7: Growth and management (wave 2D)
Promotions, reports, Dashboard RBAC, and multi-Store / Stock Transfer — none of it enters Instant Checkout.
**FRs covered:** FR82–FR109, AD-11, AD-17, AD-18, AD-19

## Epic 4: Product catalog, media, and Stock Ledger (wave 2A)

Raka can run a full catalog with Product Media, and every quantity change is an auditable Stock Ledger movement, without breaking Instant Checkout or Offline Mode.

### Story 4.1: Store stub, Stock Ledger, and opening movements

As a catalog_admin,
I want Phase 1 `stock_qty` to become a projection of a Stock Ledger with a Store #1 stub,
So that every later purchase, sale, and opname posts an auditable movement instead of a free-typed qty.

**Acceptance Criteria:**

**Given** existing Phase 1 products with `stock_qty`
**When** 2A migrations run
**Then** a `stores` row Store #1 and one Register exist (AD-19)
**And** a `stock_movements` table exists with `bucket` `sellable` | `damaged` | `in_transit` (AD-13)
**And** each tracked product gets one **opening** Stock Movement equal to current `stock_qty`
**And** `AdjustStock` posts a movement (reason required); it does not UPDATE qty as the source of truth
**And** `AcceptCompleteSale` posts STOCK OUT `sellable` (AD-4); Instant Checkout still never hard-blocks on qty (negative sellable allowed; Phase 1 non-negative CHECK lifted)
**And** Dashboard Stock display is the ledger projection
**And** unsynced complete Sales remain cashier-real (AD-3)
**And** existing Epic 2 sell/sync tests still pass (SM-2)

### Story 4.2: Catalog fields beyond name and price

As a catalog_admin,
I want SKU, barcode, description, category, brand, tags, status, cost, min/max, and Variants,
So that Cashier Menu can sell a Variant `product_id` without a live round-trip.

**Acceptance Criteria:**

**Given** I am `catalog_admin` on Dashboard
**When** I edit catalog fields (FR-33–FR-37)
**Then** inactive products are not selectable on Cashier Menu after catalog refresh
**And** line `product_id` is the Variant’s id when Variants exist
**And** missing optional fields never block Instant Checkout (FR-38)
**And** SKU unique per company `[ASSUMPTION]`

### Story 4.3: Product Media via MediaService

As a catalog_admin,
I want to upload primary + gallery images through the API,
So that Cloudinary is never on the cashier transaction path.

**Acceptance Criteria:**

**Given** Cloudinary credentials in API secrets (`cloudinary` npm 2.10.x, v2)
**When** I upload/reorder/set-primary/delete images (FR-39–FR-43)
**Then** only `MediaService` imports the Cloudinary SDK (AD-12)
**And** POS DB stores references (public_id, secure_url, metadata)
**And** delete removes provider + DB (retry orphans)
**And** publish without primary **warns**, does not hard-block
**And** Catalog/Sales modules do not import Cloudinary

### Story 4.4: Catalog refresh caches images on Cashier

As a cashier,
I want Menu images from Local Database after catalog refresh,
So that airplane-mode still sells when the CDN is down.

**Acceptance Criteria:**

**Given** a successful catalog refresh (AD-9)
**When** the device is offline or Cloudinary is down
**Then** Cashier Menu renders cache or placeholder; add-to-cart is never blocked (FR-40–FR-42)
**And** Checkout, payment, Receipt, Sync make **no** Media Provider request
**And** SM-2 offline drill is re-run and passes (SM-10)

### Story 4.5: Stock Overview, Damaged Stock, and low-stock

As inventory staff,
I want Overview, Damaged Stock, and low/out lists from the ledger,
So that I can see honest quantity without editing qty by hand.

**Acceptance Criteria:** FR-44, FR-47, FR-50. Cashier does not need this screen to sell. Oversell warns, does not hard-block Checkout.

### Story 4.6: Stock Opname

As inventory staff,
I want to count, see variance, and get manager approval,
So that physical count becomes auditable Stock Adjustments.

**Acceptance Criteria:** FR-51–FR-54. Draft does not change Stock. Approver until 2D is `catalog_admin`. No count-on-POS. Online-first Dashboard.

## Epic 5: Purchasing, Void, and Returns (wave 2B)

### Story 5.1: Suppliers and Purchase Order lifecycle
FR-55–FR-58. States Draft → Submitted → Approved → Partially Received → Completed. Stock unchanged on submit.

### Story 5.2: Goods Receipt posts STOCK IN
FR-59–FR-61. Partial OK. `ReceiveGoods` command only (AD-4). Invoice status only, not GL.

### Story 5.3: Hold/park Cart Panel
FR-62. Device-local; not a Sale; not in outbox (AD-14).

### Story 5.4: Same-day Void
FR-63. `PostVoid`; STOCK IN sellable; cash Void decreases Shift Expected Cash once Shift exists (Epic 6). Manager PIN in-session. Incomplete cancel is not Void (AD-2).

### Story 5.5: Return lookup, inventory decision, cash Refund
FR-64–FR-67, FR-69. Lookup online-first. Cashier cannot Refund (API deny). Exchange = new complete Sale linked to Return (FR-68 without Store Credit). Store Credit out of this epic.

## Epic 6: Customers, Shift, and cashier ops (wave 2C)

### Story 6.1: Customer profile, attach, history
FR-70–FR-74. Sale completes without Customer. Offline: cached attach OK; new create queued (`customer_create` outbox).

### Story 6.2: Open Shift and require it for Checkout
FR-75, AD-16. One open Shift per Register. After this story, Pay disabled without open Shift; `AcceptCompleteSale` requires `shift_id`.

### Story 6.3: Cash In/Out, Expected Cash, close Shift
FR-76–FR-81. Formula includes cash Voids. Difference recorded, not forced to zero. Offline-capable. Shift close does not drain Sync.

### Story 6.4: Day Close after Shift
FR-111, FR-23 after 2C. Cash summary = this Register’s closed Shifts. FR-24 still applies.

### Story 6.5: Split tender and Customer-specific price
FR-110, FR-112. Methods: cash + Store Credit only. Store Credit needs Customer. Fail open to Store/catalog price.

## Epic 7: Growth and management (wave 2D)

### Story 7.1: Loyalty earn/redeem (P1; does not gate Epic 6)
FR-82–FR-86. Shared domain eval (AD-18). Redeem online-only. Fail open.

### Story 7.2: Promotions, Coupons, Vouchers
FR-87–FR-92. Fail open to list price.

### Story 7.3: Reports and analytics
FR-93–FR-97. COGS = product cost field. Cashier-only limited/none.

### Story 7.4: Employees and RBAC on Dashboard
FR-98–FR-103. API enforces (AD-17). Map `cashier` → Cashier, `catalog_admin` → Admin.

### Story 7.5: Multi-Store and Stock Transfer
FR-104–FR-109. `ShipTransfer` / `ReceiveTransfer`. In-transit bucket. Not on Checkout. Cross-Store offline Sync out.

