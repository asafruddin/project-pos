# Product Scope

Version: 1.0
Status: Draft
Last Updated: August 2026
Source: [vision.md](./vision.md) v1.2

---

## One-liner

Ship a retail POS that lets one store sell all day with Instant Checkout and Offline Mode — then grow into a multi-app SaaS platform without rewriting the sell path.

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

## Later scope (platform — not Phase 1)

After Phase 1 is proven in one store:

- Multi-branch / multi-store SaaS
- Full Admin (inventory, customers, suppliers, employees, promotions, analytics)
- Deeper Offline Mode (multi-device conflict hardening)
- Worker, notifications, scheduled reports
- Future apps: owner mobile, warehouse, KDS (if F&B), public API, marketplace
- Shared domain packages and generated API clients once the model stabilizes

---

## Delivery constraint (architecture stance)

- Ship **Cashier + API** first; Admin only feeds checkout
- Device is source of truth for in-flight sales until sync acknowledges
- Monorepo allowed; do not let tooling delay first end-to-end sale
- Hand DTOs until domain stabilizes

---

## Open product decisions

Track these before / during PRD — they change Offline Mode acceptance:

1. Offline **card** payments: block (cash-only offline) vs record “settle later” vs terminal offline-settle
2. Target hardware matrix (devices, printers, scanners) for Phase 1 proof
3. Niche / first customer profile (e.g. boutique, warung, general retail)

---

## Traceability

| This doc | Vision |
|----------|--------|
| Phase 1 IN/OUT | Phase 1 Scope |
| Pillars | Instant Checkout + Offline Mode |
| Non-goals | Non Goals + Phase 1 OUT |
| Later scope | Future Applications + Long-Term Goal |
