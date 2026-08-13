# Reconcile — phase-2.md

**Input:** `docs/01-business/phase-2.md` (v1.0)  
**Against:** `prd.md` + `addendum.md`  
**Date:** 2026-08-13

## Covered (keep short)

Phase 2 = run the business without rewriting Instant Checkout; not ERP / KDS / warehouse / accounting / SaaS ecosystem. Waves 2A–2D and P0/P1/P2. Catalog (fields, variants, categories/brands), Product Media isolated from checkout, Stock Ledger / opname / damaged / low-stock, suppliers + PO + goods receipt, returns/refunds/exchange/store credit (cashier cannot refund), customers + shared loyalty/promotion rules, Shift coexisting with Day Close, reports suite, Dashboard-only RBAC with API enforcement, multi-Store + transfer not in Checkout, cashier-offline vs Dashboard-online-first. Cloudinary vendor, folders, transforms, upload path, API/DB sketches → addendum.

## Gaps (2-5, the important ones)

### 1. Customer pricing at cashier Checkout

- **Input:** §12 Checkout capabilities: split payment, more methods, store credit, advanced discounts, **customer pricing**.
- **PRD+addendum:** FR-110 (split + Store Credit), FR-91 (manager discount), FR-73/FR-87 (customer *group* as a Promotion condition), FR-106 (*Store*-specific selling price). No FR that attaching a Customer changes list price (price list / customer-specific / group list price).
- **Why it matters:** “This regular’s price” is a ring-up feel, not a campaign firing. The FR structure silently folded it into Promotions, so a shop with standing customer prices has no requirement unless a 2D promo happens to exist.
- **Placement:** **PRD** — one FR next to FR-71/FR-110 if customer (or group) list price is in-scope for 2C Checkout; **addendum** only if the cut is intentional (“customer pricing = group Promotions, no price lists”).

### 2. Media layer vs product-gallery-only

- **Input:** Two P0/2A modules — Product Management + Media **and** Cloudinary Asset Management. Folder convention is a platform asset layer: `products/`, **`categories/`**, **`brands/`**, **`promotions/`**, **`stores/`**. Success: images in Admin and Cashier, assets linked, no orphans, Cloudinary cannot block checkout.
- **PRD+addendum:** FRs 39–43 are **product** primary/gallery only. Addendum copies the folder tree as “ops, not FR” (vendor/path override) but never states whether category / brand / promotion / store assets are in 2A, deferred, or cut.
- **Why it matters:** Input’s media *feel* is infrastructure for the catalog experience (tiles, logos, campaign art), not a product-image feature. Collapsing module 7 into Product Media drops that without an explicit override.
- **Placement:** **PRD** §4.7 if non-product assets are P0 (thin “attach media to category/brand/store/promotion”); **addendum** if 2A is product images only and the extra folders are future-ready convention (say the cut).

### 3. Three pillars flattened to two surfaces

- **Input:** Vision diagram is **Cashier / Operations / Management**. Apps: Cashier, Admin (ops + people), Owner prepare = **analytics overview**. Operations (inventory, purchasing, receiving) is not the same pillar as management (analytics, RBAC, multi-branch).
- **PRD+addendum:** §2.4 is Cashier vs Dashboard. Jobs name Budi vs Andi, but nothing requires Dashboard IA to separate operations from management. Owner “analytics overview” is only “prepare owner mobile; not required.”
- **Why it matters:** Phase 2 *feel* in the input is front-of-house vs back-office **and** “count stock / receive a PO” vs “run the company.” One Admin dump reads as the ERP the input forbids. Slogan in §1/§5 (“not all-in-one”) survived; the IA that would make it true did not.
- **Placement:** **PRD** §2.4 or §8 (Dashboard IA: operations vs management; Owner overview still not a required app). **Addendum:** owner-mobile analytics as prepare-not-required (already started; name the overview).

### 4. Independent modules + type-safe contracts as success

- **Input:** §22 modular design (Inventory, Orders, Products, Customers, Reports, Payments, Promotions reusable by apps). §25 Architecture success: **business rules centralized**, **modules independent**, **type-safe API/domain contracts**, Cloudinary isolated, Phase 1 offline remains.
- **PRD+addendum:** §8 centralizes Loyalty/Promotion rules and Media isolation. Addendum has “suggested domain modules” as a mechanism bullet. Type-safe contracts absent. JWT-as-permission-carrier (§15) also absent from addendum.
- **Why it matters:** Input treats platform craftsmanship as a Phase 2 *gate*, not a later architecture nicety. FR grouping by feature can ship a growing Admin monolith and still “pass.” The reusable-module / contract feel is exactly what FRs drop.
- **Placement:** **PRD** §8 — one NFR: domain modules independently reusable by Cashier and Dashboard; rules not reimplemented per app (already true for promo/loyalty — extend to Stock/Returns). **Addendum:** type-safe contracts, JWT/resource×action on every endpoint, MediaService-only (partially there).

## Qualitative dropped

Tone the FR spine kept as slogans but not as requirements:

- **“Canonical Phase 2 spec” / named modules with wave Deliverables** — 2A “reliable product + inventory *foundation*,” 2B “complete stock *lifecycle*,” 2C “complete front-of-store *operations*,” 2D “business *management* platform.” PRD §6 is FR ID ranges; SMs test pieces, not the wave *promise*.
- **POS PLATFORM as three trunks** (see gap 3) — cashier still sells; operations runs stock; management does not sit in the cart.
- **“Cloudinary is media infrastructure, not transaction infrastructure”** as the *most important* architectural sentence — isolation FRs exist; the manifesto voice that sale (product, cart, payment, receipt, sync) stays independent of the image CDN is thinner than the input’s close.
- **“Do not ship as one giant release”** as a delivery ethic — waves exist so 2D cannot delay 2A (guardrail + SM-C2); the spoken deliverable of each wave does not.
- **Craft of a platform** (independent modules, type-safe contracts, jobs/cache/monitoring/notifications on the infra diagram) — operational backbone, not feature FRs; mostly dropped or left unnamed in addendum.

## Not a gap

Intentional overrides already in addendum (do not re-open as phase-2.md gaps):

- Retail-first source vs coffee-shop Phase 1 journeys; Phase 2 retail ops, no KDS
- Input “Phase 1 Cashier already has void + hold/park” vs PRD Phase 2B FR-62–63
- Cloudinary named in addendum; PRD capability = Product Media / Media Provider
- Loyalty listed as both 2C and P1/2D → 2C happy path, rule richness may finish 2D
- API path list / DB tables / Cloudinary folder *paths* → architecture (the *capability* of non-product assets is gap 2, not this override)
- Product images “required” vs warn-not-hard-block publish
- PO Invoice → Payment as status/reference, not AP/GL
- Warranty = flag, not a module
- CSV as Phase 1 vs FR-31 list + totals
