# POS Platform Vision

Version: 1.3
Status: Draft
Last Updated: August 2026

Sources:

- Brainstorm session: `_bmad-output/brainstorming/brainstorm-pos-vision-first-phase-2026-08-04/`
- Decision: Vision is the long-term north star; Phase 1 is Instant Checkout + Offline Mode for one retail store — not full platform completeness.
- Decision (v1.2): Offline Mode is a Phase 1 cashier capability, not a later “nice to have.”
- Decision (v1.3): Phase 2 is **Run the business** — inventory, purchasing, returns, customers, shifts, media — without breaking Phase 1 offline checkout. Canonical spec: [phase-2.md](./phase-2.md).

---

# Project Overview

This project aims to build a modern, scalable, offline-first Point of Sale (POS) platform designed for businesses ranging from small retail stores to multi-branch enterprises.

**Phase 1 focus:** prove one retail store can sell all day with Instant Checkout **and Offline Mode** — catalog, cart, payment, receipt, basic stock, and day close — including when the network is down — before expanding into operations or SaaS / multi-branch platform scope.

**Phase 2 focus:** take that transactional foundation and **run the business** — product catalog + media, inventory ledger, purchasing, returns, customers, cashier shifts — then growth modules (promotions, loyalty, analytics, RBAC, multi-store). Cloudinary is media infrastructure only; it never sits on the cashier transaction path. See [phase-2.md](./phase-2.md).

The long-term platform consists of multiple applications sharing a unified backend and business logic through a monorepo architecture.

Applications (long-term):

- Cashier PWA
- Admin Dashboard
- Backend API
- Background Worker
- Shared Packages

The platform prioritizes:

- Performance
- Offline Mode for Cashier (no lost sales; sell through outages)
- Scalability
- Great user experience for cashiers
- Type safety
- Maintainability

**Boundary:** Retail-first. Kitchen Display / F&B-specific flows are future options, not Phase 1 drivers.

---

# Vision

Create a POS platform that is:

- Fast enough for daily cashier operations.
- Reliable even during internet interruptions — Offline Mode is a product feature, not a fallback apology.
- Easy to maintain by developers.
- Flexible enough to support future business modules.
- Suitable for SaaS deployment.

Phase 1 wins when a cashier prefers this system to a notebook or spreadsheet for a full store week — including hours with no internet — not when the monorepo or module map is complete.

Phase 2 wins when the store can trust stock, receiving, returns, shifts, and catalog images — while the Phase 1 sell loop still works offline.

---

# Jobs to Be Done

Vision lists users; Phase 1 is defined by jobs.

## Cashier

- Close the sale fast without thinking.
- Recover from wrong item / qty without friction.
- Keep selling when Wi‑Fi dies during rush.
- Prove the cash drawer matches sales at end of day.

## Store Manager

- Know what sold and what is low before restocking.
- Trust that cashiers cannot silently void everything (manager PIN / logged overrides).

## Business Owner

- See money in / money out without opening an ERP.
- Open a second branch later without rewriting the system (migration path after Phase 1).

## Accountant

- Export clean daily sales for bookkeeping / tax.

## Administrator

- Onboard a new cashier in minutes.

## Indirect (customer)

- Leave the line quickly with the correct price.

Phase 1 JTBD pack:

1. Sell (online or offline)
2. Take payment
3. Print or show receipt
4. Adjust stock by sale
5. Day close / cash reconciliation
6. See pending sync / reconnect without losing work

Phase 2 JTBD pack (operations — does not replace Phase 1):

1. Know exact stock (ledger, opname, low/out)
2. Buy from suppliers and receive goods into stock
3. Return / refund / exchange after the sale day
4. Attach a customer; earn and redeem loyalty
5. Open and close a cashier shift with cash reconciliation
6. Put product images on Admin and Cashier without blocking checkout
7. (P1 modules) Apply promotions; report; permissioned staff; second store + transfer

---

# Phase 1 Scope

## Crown jewels: Instant Checkout + Offline Mode

Phase 1 has two co-equal product pillars for the Cashier app:

1. **Instant Checkout** — the sell loop feels instantaneous.
2. **Offline Mode** — the same sell loop keeps working when the network is gone.

If a feature does not make Instant Checkout better **or** make Offline Mode trustworthy, it is not Phase 1.

### Instant Checkout

Make Instant Checkout unbelievably good:

- Zero-latency local catalog cache
- Keyboard-first (mouse optional); numeric qty, +/−, void line, hold sale
- Local commit first, sync second (checkout must not block on network)
- Receipt reprint by sale id
- Manager PIN override for wrong price / voids, always logged
- Optimistic stock decrement with conflict report later

### Offline Mode (Cashier — Phase 1 capability)

Offline Mode is a named Cashier feature, not an implementation detail.

**Phase 1 promise:** A cashier can complete the Instant Checkout loop with no internet — search/scan from a local catalog, build a cart, take payment, issue a receipt, decrement local stock, and park/void with manager rules — without losing a single sale.

Must work offline in Phase 1:

- Local product catalog (prefetched / cached while online; usable when offline)
- Cart, checkout, payment recording (cash and recorded non-cash methods that do not require live authorization — or clearly blocked if live auth is required)
- Sale commit to a durable local outbox (never silently drop)
- Receipt print and/or on-device digital receipt from local data
- Same-day void / hold sale under the same role rules
- Always-visible connectivity + pending sync count
- Automatic sync when connectivity returns; clear success / conflict feedback
- Day close includes local + already-synced sales for that store day

Explicitly later (not Phase 1 Offline Mode):

- Multi-device conflict resolution perfection / CRDT
- Offline Admin / inventory receiving / supplier flows
- Offline card authorization / payment-gateway capture (unless a specific terminal supports offline settle — call that out per integration)
- Cross-branch catalog sync while offline

**Why this is Phase 1:** Lunch-rush Wi‑Fi failure is a cashier JTBD, not a Phase 2 engineering luxury. Notebook wins if the POS dies when the router does.

## Phase 1 IN

- Authentication (cashier / manager roles only; session usable offline after login while online)
- Products (CRUD that feeds the catalog; catalog download/cache for Cashier)
- Cart and checkout
- Payment record (cash + one simple card/other method recording)
- Receipt (print and/or digital)
- Basic stock quantity on product (local decrement; reconcile on sync)
- **Offline Mode** for Cashier (local catalog, durable outbox, sync status, reconnect sync)
- Day close / sales list + totals (CSV export acceptable; not an analytics suite)
- Store entity (single store; tenancy model stub for later multi-branch)
- Risk spikes: offline outbox + reconnect sync UX + ESC/POS (or target-device) receipt printing / scanner proof

## Phase 1 OUT

- Multi-branch / unlimited stores as a launch requirement
- Promotions / loyalty / reward-points engine
- Full returns (same-day void only until stock ledger is trustworthy)
- Suppliers
- Deep analytics / vanity dashboards
- Background Worker as a required app (jobs may run in API until queue pain appears)
- Kitchen Display, warehouse app, public API, marketplace
- Multi-currency and multi-tax-jurisdiction SaaS surface (one currency, one tax profile)
- Deep RBAC / employees / customers-as-CRM
- Shared packages extracted before a second consumer exists
- Advanced offline sync (CRDT / multi-cashier conflict theater) beyond durable outbox + clear conflict report

## Phase 1 architecture stance

- Monorepo is allowed; ship **Cashier + API** first.
- Admin exists only to feed Instant Checkout (products / prices), not as a full back-office suite.
- Cashier must treat the device as source of truth for in-flight sales until sync acknowledges them.
- Prefer hand DTOs until the domain model stabilizes; generate clients later.
- Extract shared UI / business-logic packages when duplication hurts — not on day one.

## Phase 1 success

- 1 store
- 1 week of real use
- Zero lost sales (**including forced offline / airplane-mode drills**)
- Cashier prefers it to notebook / Excel + calculator
- Day close cash matches (local + synced sales accounted for)
- Pending sync is always understandable; reconnect clears the queue without cashier heroics
- Hardware path proven on target devices (printer / scanner as applicable)

---

# Phase 2 Scope

Canonical detail: [phase-2.md](./phase-2.md). This section is the vision-level boundary.

## Crown jewel: Run the business

Phase 2 takes Instant Checkout + Offline Mode and adds operations:

```text
CASHIER          OPERATIONS         MANAGEMENT
  Sales            Inventory          Analytics
  Returns          Purchasing         Reports
  Shift            Suppliers          RBAC
  Loyalty          Stock transfer     Multi-store
                   Customers
                   Promotions
```

If a feature does not help the store **run operations** (stock, buying, returns, customers, shifts, catalog media) or **manage growth** (promotions, reports, RBAC, multi-store) — and it is not already Phase 1 — it is not Phase 2.

## Phase 2 IN (P0 — core)

- Product management: full catalog (SKU, barcode, description, category, brand, tags, status, variants, cost / selling / compare-at / store pricing)
- Product images required (primary + gallery); metadata in POS DB
- Cloudinary as media layer (upload, CDN, `q_auto` / `f_auto` transforms) — **never on cashier checkout path**
- Inventory: overview, by store, movement, ledger, adjustment, opname, low/out, damaged
- Purchasing & suppliers: profile, PO workflow, goods received → stock IN, invoice/payment
- Returns & refunds: full/partial return, exchange, refund, store credit; inventory decision (resellable / damaged / warranty)
- Customer management: profile, history, groups, notes; cashier search/create/attach
- Cashier shift: open, cash in/out, count, close, reconciliation
- Phase 1 offline promise **preserved** (cashier sell + shift ops offline-capable; Admin online-first)

## Phase 2 IN (P1 — growth)

- Promotions & vouchers (percentage, fixed, BXGY, bundle, coupon, happy hour, …)
- Loyalty & rewards (points, tiers, earn/redeem — rules centralized, not duplicated)
- Reports & analytics (sales, product, inventory, cashier, financial)
- Employee & RBAC **on the Admin Dashboard** — users, roles, permission matrix. Cashier never manages users. API enforces. Roles: owner, admin, store manager, supervisor, cashier, inventory, purchasing.
- Multi-store + stock transfer (activates Phase 1 tenancy stub)

## Phase 2 OUT (P2+ — prepare architecture, do not require)

- Advanced multi-device conflict / CRDT / cross-branch offline sync
- Warehouse app, owner mobile app, KDS, customer app, self-checkout
- Public API, marketplace, accounting integrations
- Offline Admin / receiving / supplier flows
- Becoming an ERP, accounting system, manufacturing system, or CMS

## Phase 2 architecture stance

- Do **not** break Phase 1 offline checkout.
- Cloudinary is isolated behind a media service; cashier transaction path stays independent.
- Admin is online-first; Cashier remains offline-capable for sell / void / hold / shift.
- Shared business logic (tax, discounts, loyalty, permissions) lives once.
- Deliver in waves: **2A** product + inventory + media → **2B** purchasing + returns → **2C** customers + cashier ops → **2D** promotions, analytics, RBAC, multi-store.

## Phase 2 success (summary)

- Accurate stock ledger and successful opname
- Purchase → receive → inventory; return → refund → inventory
- Shift reconciliation
- Images in Admin and Cashier; no orphaned Cloudinary assets; Cloudinary outage does not block sales
- Customer history; promotions and loyalty calculated correctly (when those modules ship)
- Phase 1 offline sell loop still reliable

---

# Core Principles

## Offline First

Cashier Offline Mode is a core product capability.

Cashier operations must continue even without internet access.

Synchronization happens automatically whenever connectivity returns.

No sales should ever be lost because of network issues.

Pending sync state must always be visible. Silent data loss is unacceptable.

Phase 1 ships a **pragmatic durable outbox + sync status + conflict report**. That is enough to call Offline Mode “done” for Phase 1. CRDT / multi-writer perfection is not a launch gate — and must not delay the offline sell promise.

---

## Performance First

Every interaction should feel instantaneous.

Target response time:

- Product Search <100ms
- Add to Cart <50ms
- Checkout <300ms

Animations are secondary to responsiveness.

---

## Shared Business Logic

Business rules should exist only once *when multiple clients share them*.

Long-term: discount, tax, permissions, validation, rewards must not be duplicated.

Phase 1: keep rules correct in one place (API / local checkout path); avoid building a full promotions/rewards engine early.

Phase 2: introduce promotions, loyalty, and permissions as **centralized** rules — still not duplicated between Admin and Cashier.

---

## Monorepo

All applications live inside one repository over time.

Benefits:

- Shared UI
- Shared Types
- Shared API Client
- Easier refactoring
- Atomic releases

Phase 1: do not let monorepo tooling delay the first end-to-end sale.

---

## Type Safety

The platform should be type-safe from frontend to backend.

Shared DTOs

Shared validation

Shared interfaces

Generated API clients (after the domain stabilizes)

---

## Modular Design

Features should be independent over time.

Examples (Phase 2 introduces these as real modules; not a Phase 1 checklist):

Inventory

Orders

Products (including images)

Customers

Reports

Payments

Promotions

Each module should be reusable by any application when introduced.

---

## Great User Experience

Cashiers should never wait.

Keyboard shortcuts

Touch interactions

Barcode scanning (keyboard-wedge acceptable early)

Hardware reality (printers, cash drawers, scanners, tablets) is first-class — prove the path early, do not assume “browser print works.”

---

# Applications

## Cashier App (Phase 1 primary)

Purpose:

Handle all in-store selling operations — Instant Checkout with Offline Mode.

Platform:

Progressive Web App (PWA), with early validation that printers/scanners **and offline storage/sync** work on target devices. Native shell (Electron/Capacitor) remains an option if PWA hardware or offline reliability proves insufficient.

Primary Devices:

Tablet

Desktop

Mobile

Phase 1 features:

- Authentication (online login; offline session continuation)
- Product search / favorites / barcode (wedge) against **local catalog**
- Shopping cart
- Checkout
- Payment recording
- Receipt (print and/or digital) + reprint
- **Offline Mode** — local catalog, durable sale outbox, connectivity indicator, pending sync count, auto-sync on reconnect, conflict feedback
- Same-day void with manager override (works offline; syncs later)
- Hold / park sale
- Day close (includes offline-captured sales)

Phase 2 Cashier features (see [phase-2.md](./phase-2.md)):

- Shift management (open, cash in/out, count, close, reconciliation)
- Customer search / create / attach; loyalty view / redeem
- Full / partial returns, exchange, refund
- Promotions, coupons, vouchers, manager-approved discount
- Split payment, store credit, customer-specific pricing

Later than Phase 2:

- Advanced multi-device offline conflict resolution / CRDT

---

## Admin Dashboard (Phase 1 thin; Phase 2 operations)

Purpose:

Manage the business — in Phase 1, only what feeds Instant Checkout. In Phase 2, the operations back office.

Primary Devices:

Desktop

Laptop

Tablet

Phase 1 features:

- Products / prices
- Basic stock
- Sales list + daily totals / CSV
- Settings (tax profile, store; two seeded roles: cashier / catalog_admin — **not** a user-management screen)

Phase 2 Admin features:

- Product catalog + Cloudinary media, categories, brands, variants
- Inventory (ledger, adjustment, opname, low/out, damaged)
- Purchasing & suppliers (PO, goods receipt)
- Customers
- Returns / refunds (manager flows)
- Reports / analytics
- Promotions, coupons, vouchers, loyalty rules
- Employees / RBAC — **Dashboard is the only UI** to create users, assign roles, and edit permissions (Owner/Admin only). API enforces every action.
- Stores, registers, stock transfer

Admin is **online-first**. Inventory receiving, POs, product/customer management, reports, and promotions require connectivity.

---

## Backend API (Phase 1)

Purpose:

Provide centralized business logic.

Responsibilities (Phase 1):

Authentication / authorization (two roles)

Products and stock

Catalog payload for Cashier cache

Sales commit + **accept offline outbox sync**

Payment recording

Receipt data

Day close / export

Conflict / rejection reporting back to Cashier on sync

Phase 2: domain APIs for products/images, inventory, purchasing, returns, customers, loyalty, promotions, shifts, stores, roles/permissions, reports. MediaService → Cloudinary (not on checkout path).

Later than Phase 2: notifications at SaaS scale, public API, marketplace.

---

## Media / Cloudinary (Phase 2 infrastructure)

Purpose:

Store original product (and later category/brand/promotion/store) assets; deliver resized/optimized images via CDN.

Rules:

- POS database owns products and `product_images` references (`public_id`, `secure_url`, dimensions, alt, sort, primary).
- Cloudinary is never on the cashier transaction-critical path (cart, pay, receipt, offline sync).
- If Cloudinary is down, cashiers still sell from cached catalog data/images.
- Do not store our own 150/400/800px files — use transforms (`q_auto`, `f_auto`).

---

## Worker (deferred)

Purpose:

Run asynchronous tasks (email, notifications, scheduled reports, heavy imports).

Phase 1: not required. Prefer in-process / API jobs until queue pain appears.

Phase 2: still not a required app. Queue only if imports, reports, or media jobs hurt API latency.

---

# Future Applications

The architecture should support future expansion. **Phase 2 does not require these apps** — only prepare the platform so they can land later (P2+).

Examples:

Owner Mobile App

Warehouse App

Kitchen Display System (if/when F&B is in scope)

Customer App

Self Checkout

Public API

Marketplace Integration

---

# Success Metrics

## Phase 1 (store-day)

Zero lost sales (including offline / airplane-mode drill)

Full Instant Checkout loop works with network off (cached catalog → pay → receipt)

Checkout feels under 300ms on target device (local path)

Pending sync visible; reconnect drains outbox without cashier data loss

Day close cash matches (local + synced)

Cashier prefers system to notebook after one week

Printer / scanner path proven on target hardware

## Phase 2 (operations)

Accurate stock ledger; successful stock opname

Purchase → receiving → inventory; return → refund → inventory

Shift reconciliation

Product images in Admin and Cashier; Cloudinary linked; optimized delivery; no orphans

Cloudinary failure cannot block checkout

Customer purchase history; promotions and loyalty correct (when those modules ship)

Sales and inventory analytics available

Permission-based access, managed on Admin Dashboard (users/roles/permissions); store-level inventory/reporting; stock transfer (P1 modules)

Phase 1 offline checkout remains reliable

Detail and gates: [success-metrics.md](./success-metrics.md) · [phase-2.md](./phase-2.md)

## Long-term (platform)

Performance

95+ Lighthouse (nice-to-have; not Phase 1 launch gate)

Offline Mode hardened across multi-cashier / multi-device conflict cases

100% TypeScript

<2 second initial load

<100ms navigation

Developer Experience

Shared codebase

Minimal duplication

High test coverage

Easy onboarding

Business

Support multiple branches / stores

Support multiple payment methods

Support multiple currencies

Support multiple tax rules

---

# Target Users

Phase 1 primary:

Cashier

Store Manager

Business Owner (light)

Administrator (light)

Phase 2 additional:

Inventory staff

Purchasing staff

Supervisor

Owner (analytics / multi-store)

Accountant (stronger reporting, still not ERP)

Later than Phase 2:

Warehouse Staff (warehouse app)

Regional / multi-branch ops at SaaS scale

---

# Non Goals

This project is not intended to:

Become an ERP.

Replace accounting software.

Handle manufacturing.

Become a CMS.

Those integrations may exist in the future but are outside the current scope.

Additionally out of Phase 1 (see Phase 1 OUT above): multi-branch launch, promotions engine, full returns, suppliers, analytics suite, required Worker, KDS, public API. Those become Phase 2 (or P1-within-Phase-2) except KDS, Worker-as-required-app, public API — which stay later.

Additionally out of Phase 2: warehouse/owner/KDS/customer/self-checkout apps, public API, marketplace, CRDT, accounting integrations, becoming an ERP.

---

# Long-Term Goal

Build a production-ready POS platform capable of powering retail businesses while serving as a reusable foundation for future SaaS products.

The architecture should remain maintainable for many years and support additional applications without major restructuring.

Phase 1 proves Instant Checkout **with Offline Mode** in one store. Phase 2 earns the operations platform (inventory, purchasing, returns, customers, shifts, media) without rewriting the core sell path. Later phases earn SaaS scale, extra apps, and deeper multi-device sync.
