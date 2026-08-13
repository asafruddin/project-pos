# Product Scope

Version: 1.1
Status: Draft
Last Updated: August 2026
Source: [vision.md](./vision.md) v1.3 · [phase-2.md](./phase-2.md) v1.0

---

## One-liner

Ship a retail POS that lets one store **sell reliably** (Phase 1: Instant Checkout + Offline Mode), then **run the business** (Phase 2: inventory, purchasing, returns, customers, shifts, media) — without rewriting the sell path or putting media/CDN on the cashier transaction path.

---

## Problem

Small and mid-size retail stores still lose sales when Wi‑Fi dies, wait on sluggish checkout UIs, and stitch together notebooks, spreadsheets, and generic tools. Building a full multi-branch SaaS platform before proving the cashier sell loop is the wrong order.

---

## Solution (Phase 1)

A **Cashier-first** POS with a thin Admin and Backend API:

| Pillar | Promise |
|--------|---------|
| Instant Checkout | Catalog → cart → pay → receipt feels instantaneous on device |
| Offline Mode | Same loop works with no network; zero lost sales; sync when back online |

---

## Solution (Phase 2)

An **operations platform** on the same sell path. Canonical spec: [phase-2.md](./phase-2.md).

| Pillar | Promise |
|--------|---------|
| Run the business | Inventory, purchasing, returns, customers, shifts, catalog media |
| Preserve Phase 1 | Offline checkout stays reliable; Cloudinary never on the transaction path |

---

## In scope — Phase 1

### Product surface

| App | Role in Phase 1 |
|-----|-----------------|
| Cashier PWA | Primary — Instant Checkout + Offline Mode |
| Admin Dashboard | Thin — products/prices, basic stock, sales list/CSV, store + tax + 2 roles |
| Backend API | Auth, catalog, sales commit/sync, payments record, day close, conflict feedback |
| Shared packages | Only if duplication hurts; not a day-one goal |
| Background Worker | Out of Phase 1 (in-process/API jobs OK) |

### Capabilities IN

- Authentication: cashier / manager; online login; offline session continuation
- Products CRUD + Cashier local catalog cache
- Cart, checkout, hold/park sale
- Payment recording (cash + simple recorded non-cash; live card auth rules TBD)
- Receipt print and/or digital + reprint by sale id
- Basic stock qty (local decrement; reconcile on sync)
- Same-day void with logged manager PIN override
- Offline Mode: durable outbox, connectivity + pending sync UI, auto-sync on reconnect, conflict report
- Day close including local + synced sales
- Single store entity (stub for later multi-branch)
- Hardware risk spikes: ESC/POS (or target) print + scanner path + offline storage/sync on real devices

### Performance targets (Phase 1)

- Product search &lt; 100ms
- Add to cart &lt; 50ms
- Checkout &lt; 300ms (local path; must not block on network)

### Boundary

- **Retail-first** (not F&B/KDS-driven in Phase 1)
- One currency, one tax profile
- One store to prove the wedge

---

## Out of scope — Phase 1

These are **deferred to Phase 2** (or later), not cancelled:

- Multi-branch / unlimited stores as launch requirement
- Promotions / loyalty / rewards engine
- Full returns (voids only)
- Suppliers, deep inventory, deep RBAC / employees CRM
- Analytics dashboards (CSV + daily totals only)
- Required Background Worker app
- KDS, warehouse app, customer app, self-checkout
- Public API / marketplace
- Multi-currency / multi-jurisdiction tax SaaS surface
- CRDT / multi-cashier offline conflict perfection
- Offline Admin / receiving / supplier flows
- Becoming an ERP, accounting system, manufacturing system, or CMS

---

## In scope — Phase 2

Canonical detail: [phase-2.md](./phase-2.md). Phase 1 IN stays; Phase 2 expands Admin and Cashier **after** the wedge is proven.

### Product surface

| App | Role in Phase 2 |
|-----|-----------------|
| Cashier PWA | Sell + returns + shift + customer/loyalty attach; **offline sell/shift preserved**. Does **not** manage users or roles. |
| Admin Dashboard | Operations back office (online-first): catalog+media, inventory, purchasing, customers, reports, promotions, stores. **RBAC home:** create users, assign roles, permission matrix |
| Backend API | Domain APIs for those modules; MediaService → Cloudinary |
| Shared packages | Domain modules as duplication hurts; promotions/loyalty/permissions centralized |
| Background Worker | Still not required as a separate app unless queue pain appears |
| Cloudinary | Media only — original storage, CDN, transforms. **Not** on checkout/sync path |

### Capabilities IN — P0 (core)

- Full product catalog (SKU, barcode, description, category, brand, tags, status, variants, cost/selling/compare-at/store pricing)
- Product images (primary + gallery); `product_images` metadata in POS DB
- Cloudinary upload/delete/transform/delivery (`q_auto`, `f_auto`); folder convention `pos/products/{id}/…`
- Inventory: overview, by store, movement, ledger, adjustment, opname, low/out, damaged
- Suppliers + purchase orders + goods receipt → stock IN
- Returns: full/partial, exchange, refund, store credit; inventory decision (resellable / damaged / warranty)
- Customers: profile, history, groups; cashier search/create/attach
- Cashier shift: open, cash in/out, count, close, reconciliation

### Capabilities IN — P1 (growth)

- Promotions, coupons, vouchers (conditions → reward)
- Loyalty & rewards (points, tiers, earn/redeem — single rule engine)
- Reports & analytics (sales, product, inventory, cashier, financial)
- RBAC **on Admin Dashboard** (users, roles, resource × action permissions). Roles: owner, admin, store manager, supervisor, cashier, inventory, purchasing. Cashier app does not manage users; API enforces.
- Multi-store + stock transfer (activates Phase 1 tenancy stub)

### Delivery waves (do not ship as one release)

| Wave | Goal | Sequence |
|------|------|----------|
| **2A** | Know what you sell and have | Product → Cloudinary → categories/brands → inventory → ledger → adjustment → opname |
| **2B** | Complete stock lifecycle | Suppliers → PO → receiving → stock IN; returns → refunds → stock IN / damaged |
| **2C** | Front-of-store operations | Customers → loyalty; cashier shift, returns, advanced payment |
| **2D** | Growth & management | Promotions/vouchers; analytics; **Dashboard RBAC (users/roles/permissions)**; multi-store |

### Boundary (Phase 2)

- Do **not** break Phase 1 offline checkout
- Cloudinary failure must not block sales
- Admin online-first; Cashier offline-capable for sell / void / hold / shift
- **RBAC is managed on the Admin Dashboard** (users, roles, permissions); API enforces; Cashier never assigns roles
- Retail operations platform — not ERP, KDS, warehouse app, or accounting system

---

## Out of scope — Phase 2 (P2+ / later)

- CRDT / advanced multi-device conflict / cross-branch offline sync
- Offline Admin, receiving, or supplier flows
- Warehouse app, owner mobile, KDS, customer app, self-checkout
- Public API / marketplace / accounting integrations
- Required Background Worker app
- Multi-currency / multi-jurisdiction tax SaaS surface (unless a P1 module explicitly needs it)
- Becoming an ERP, accounting system, manufacturing system, or CMS

---

## Later scope (platform — after Phase 2)

- Deeper Offline Mode (multi-device conflict hardening)
- Worker, notifications, scheduled reports at SaaS scale
- Future apps: owner mobile, warehouse, KDS (if F&B), public API, marketplace
- Shared domain packages and generated API clients once the model stabilizes
- Multi-currency / multi-tax SaaS surface

---

## Delivery constraint (architecture stance)

Phase 1:

- Ship **Cashier + API** first; Admin only feeds checkout
- Device is source of truth for in-flight sales until sync acknowledges
- Monorepo allowed; do not let tooling delay first end-to-end sale
- Hand DTOs until domain stabilizes

Phase 2:

- Do not ship 2A–2D as one giant release
- Cloudinary isolated behind MediaService; checkout/sync independent of CDN
- Admin online-first; Cashier offline-capable for sell / void / hold / shift
- Promotions, loyalty, and permissions as centralized rules
- User/role/permission admin UI is **Dashboard-only**; API is source of truth for enforcement

---

## Open product decisions

Track these before / during PRD — they change Offline Mode acceptance:

1. Offline **card** payments: block (cash-only offline) vs record “settle later” vs terminal offline-settle
2. Target hardware matrix (devices, printers, scanners) for Phase 1 proof
3. Niche / first customer profile (e.g. boutique, warung, general retail)

Phase 2 (track before 2A–2D PRDs):

1. Who approves POs, opname variances, refunds, and stock transfers
2. Whether loyalty ships in 2C or waits for 2D with promotions
3. Cloudinary account / folder / transformation presets for Cashier vs Admin
4. First multi-store tenant: when 2D activates the Phase 1 tenancy stub
5. RBAC: seven named roles on Dashboard in 2D vs also allowing custom roles in the same wave

---

## Traceability

| This doc | Vision / Phase 2 |
|----------|------------------|
| Phase 1 IN/OUT | Phase 1 Scope |
| Phase 2 IN/OUT / waves | Phase 2 Scope · [phase-2.md](./phase-2.md) |
| Pillars | Instant Checkout + Offline Mode → Run the business |
| Non-goals | Non Goals + Phase 1 OUT + Phase 2 OUT |
| Later (P2+) | Future Applications + Long-Term Goal |
