# Success Metrics

Version: 1.1
Status: Draft
Last Updated: August 2026
Source: [vision.md](./vision.md) v1.3 · [product-scope.md](./product-scope.md) v1.1 · [phase-2.md](./phase-2.md) v1.0

---

## How to read this

- **Phase 1 gates** decide go / no-go for the Instant Checkout + Offline Mode wedge.
- **Phase 2 gates** decide go / no-go for operations (stock, buying, returns, shifts, media) without regressing Phase 1.
- **Leading indicators** are measurable during build and pilot.
- **Long-term metrics** are platform ambition — not Phase 1 or Phase 2 launch criteria.

If a metric does not protect Instant Checkout speed, Offline Mode trust, or one-store day close integrity, it is not a Phase 1 gate.

If a metric does not protect stock truth, receiving/returns flows, shift cash, catalog media, or Phase 1 offline checkout, it is not a Phase 2 P0 gate.

---

## North-star outcome (Phase 1)

> One retail store runs a full week on this POS — including offline periods — with **zero lost sales**, matching day-close cash, and cashiers preferring it to notebook / spreadsheet.

## North-star outcome (Phase 2)

> The store **runs operations** on this POS: stock is auditable, receiving and returns update inventory, shifts reconcile, catalog images show in Admin and Cashier — and Phase 1 still has **zero lost sales** offline. Cloudinary outage never blocks checkout.

---

## Phase 1 success gates

Must all pass before calling Phase 1 “done.”

| ID | Metric | Target | How to verify |
|----|--------|--------|---------------|
| P1-01 | Lost sales | **0** during pilot week and offline drills | Sale count on device outbox + server after sync; no silent drops |
| P1-02 | Offline sell loop | Full loop with network off: cached catalog → cart → pay → receipt | Airplane-mode / kill-Wi‑Fi scripted drill |
| P1-03 | Checkout latency | **&lt; 300ms** local commit path on target device | Device timing on checkout action |
| P1-04 | Search latency | **&lt; 100ms** product search (local catalog) | Device timing |
| P1-05 | Add to cart latency | **&lt; 50ms** | Device timing |
| P1-06 | Sync visibility | Connectivity + **pending sync count** always understandable | UX review + cashier observation |
| P1-07 | Reconnect sync | Outbox drains on reconnect **without cashier data loss** | Disconnect → N sales → reconnect → server match |
| P1-08 | Day close integrity | Cash / recorded payments **match** local + synced sales for the day | End-of-day reconciliation checklist |
| P1-09 | Cashier preference | Cashier prefers system to notebook after **1 week** | Structured interview / simple preference vote |
| P1-10 | Hardware path | Print and/or scanner path **proven** on chosen target devices | Hardware acceptance checklist |
| P1-11 | Pilot duration | **1 store · ≥ 1 week** real use | Pilot log |

---

## Phase 1 leading indicators (build / pilot)

Track weekly; not all are hard gates.

| Area | Indicator | Healthy signal |
|------|-----------|----------------|
| Reliability | Outbox depth during open hours | Peaks during outages, returns to 0 after reconnect |
| Reliability | Sync conflict / rejection rate | Low; every rejection has clear cashier/manager action |
| Trust | Manager overrides / voids per day | Logged; rate reviewed by manager (not hidden) |
| Speed | p95 checkout / search on device | Within targets above |
| Adoption | Sales completed in POS vs bypass (notebook) | Bypass → 0 by end of pilot week |
| Ops | Time to onboard new cashier | Minutes, not days |

---

## Phase 2 success gates

Phase 1 gates **still must pass**. Phase 2 P0 is not done if offline checkout regresses.

Must all pass before calling Phase 2 P0 (waves 2A–2C core) “done.” P1 modules (2D) have additional gates.

| ID | Metric | Target | How to verify |
|----|--------|--------|---------------|
| P2-01 | Phase 1 regression | All P1-01–11 still pass | Repeat Phase 1 drill after Phase 2 ships |
| P2-02 | Stock ledger | Every stock change has a reason and is auditable | Sample purchase, sale, return, adjustment, damage |
| P2-03 | Stock opname | Count → variance → approve → stock updated | Scripted opname with known variance |
| P2-04 | Purchase → receive | PO → goods receipt → stock IN | End-to-end PO on a test SKU |
| P2-05 | Return → inventory | Return/refund updates stock (resellable IN / damaged) | Full and partial return drill |
| P2-06 | Shift reconciliation | Expected vs actual cash; difference recorded | Open → sell/cash in-out/refund → close |
| P2-07 | Product images (Admin) | Primary + gallery visible on product | Upload, reorder, set primary, delete |
| P2-08 | Product images (Cashier) | Optimized images on catalog/cards | Cashier catalog with transforms, not originals |
| P2-09 | Cloudinary isolation | Checkout works when Cloudinary is unreachable | Block CDN; complete sale + receipt |
| P2-10 | No orphaned media | Delete product/image removes Cloudinary asset + DB row | Delete drill + Cloudinary folder check |
| P2-11 | Customer history | Attach customer; purchase appears on profile | Cashier attach → sale → Admin history |

### Phase 2 P1 gates (growth modules — when 2D ships)

| ID | Metric | Target | How to verify |
|----|--------|--------|---------------|
| P2-12 | Promotions | Discount/coupon/voucher applies per rules | Cart with qualifying vs non-qualifying items |
| P2-13 | Loyalty | Points earn/redeem match centralized rules | Purchase → points → redeem |
| P2-14 | Analytics | Sales + inventory reports available | Manager can answer revenue, top SKU, low stock |
| P2-15 | RBAC | Dashboard is the user/role/permission admin; API enforces the matrix | Admin can create a cashier and assign role on Dashboard; that cashier cannot adjust stock or open Employees; API rejects forbidden calls even if UI is bypassed |
| P2-16 | Multi-store | Store-level inventory and reports; transfer completes | Transfer A→B; both ledgers correct |

---

## Phase 2 leading indicators (build / pilot)

| Area | Indicator | Healthy signal |
|------|-----------|----------------|
| Inventory | Unexplained variance after opname | Investigated; not silently written off |
| Purchasing | Open POs aging | Receiving happens; stock matches receipt |
| Returns | Returns without inventory decision | Zero — every return chooses resellable/damaged/warranty |
| Media | Checkout blocked by image errors | Zero |
| Cashier | Shift difference unexplained | Difference recorded; manager review |
| Offline | P1-01/P1-02 after catalog images | Still pass |

---

## Explicit non-gates (Phase 1)

Do **not** block Phase 1 launch on:

| Metric | Why deferred |
|--------|----------------|
| Lighthouse 95+ | Nice-to-have; store-day metrics matter more |
| 100% TypeScript / generated clients | Engineering hygiene, not cashier outcome |
| Multi-branch / unlimited stores | Out of Phase 1 scope |
| Multi-currency / multi-tax SaaS | Out of Phase 1 scope |
| Analytics suite completeness | CSV + daily totals enough |
| CRDT / multi-writer offline perfection | Outbox + conflict report is the Phase 1 bar |

Those rows become Phase 2 (or P1-within-Phase-2) work — still not Phase 1 launch criteria.

---

## Explicit non-gates (Phase 2)

Do **not** block Phase 2 on:

| Metric | Why deferred |
|--------|----------------|
| CRDT / multi-writer offline perfection | Still later; outbox + conflict report remains the bar |
| Warehouse / owner / KDS / customer apps | P2+; prepare architecture only |
| Public API / marketplace / accounting | P2+ |
| Lighthouse 95+ / generated clients | Engineering hygiene |
| Loyalty/promotions/RBAC/multi-store | P1 modules — gates P2-12–16 when 2D ships, not 2A |

---

## Long-term platform metrics

Activate after Phase 1 wedge is proven.

### Product / business

| Metric | Ambition |
|--------|----------|
| Stores / branches per tenant | Multi-store |
| Payment methods | Multiple |
| Currencies / tax rules | Multiple (SaaS) |
| Offline Mode | Hardened multi-cashier / multi-device conflict cases |

### Experience / performance

| Metric | Ambition |
|--------|----------|
| Initial load | &lt; 2s |
| Navigation | &lt; 100ms |
| Lighthouse | 95+ (aspirational) |

### Developer experience

| Metric | Ambition |
|--------|----------|
| Shared codebase / low duplication | Monorepo packages earn their keep |
| Test coverage | High on sell + sync paths |
| Onboarding new engineers | Easy |

---

## Measurement plan (minimal)

1. **Device harness** — scripted timings for search, add-to-cart, checkout (P1-03–05).
2. **Offline drill script** — airplane mode sell loop + reconnect (P1-01, P1-02, P1-07).
3. **Day-close sheet** — compare drawer + recorded payments to POS totals (P1-08).
4. **Pilot diary** — one store, one week, preference interview (P1-09, P1-11).
5. **Hardware checklist** — per target device/printer/scanner (P1-10).

Phase 2 add:

6. **Opname script** — known variance → approve → ledger (P2-03).
7. **PO + receipt script** — one SKU through receiving (P2-04).
8. **Return script** — resellable vs damaged (P2-05).
9. **Shift sheet** — expected vs counted drawer (P2-06).
10. **Cloudinary isolation drill** — block CDN, still checkout (P2-09); delete leaves no orphans (P2-10).

---

## Traceability

| Gates | Vision / Phase 2 |
|-------|------------------|
| P1-01–11 | Phase 1 success + Phase 1 (store-day) metrics |
| P2-01–11 | Phase 2 success (operations / product / architecture) · [phase-2.md](./phase-2.md) |
| P2-12–16 | Phase 2 P1 modules (2D) |
| Non-gates | Long-term vs Phase 1/2 launch gate notes |
| Long-term | Success Metrics → Long-term (platform) |
