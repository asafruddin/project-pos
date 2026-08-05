# Success Metrics

Version: 1.0
Status: Draft
Last Updated: August 2026
Source: [vision.md](./vision.md) v1.2 · [product-scope.md](./product-scope.md) v1.0

---

## How to read this

- **Phase 1 gates** decide go / no-go for the Instant Checkout + Offline Mode wedge.
- **Leading indicators** are measurable during build and pilot.
- **Long-term metrics** are platform ambition — not Phase 1 launch criteria.

If a metric does not protect Instant Checkout speed, Offline Mode trust, or one-store day close integrity, it is not a Phase 1 gate.

---

## North-star outcome (Phase 1)

> One retail store runs a full week on this POS — including offline periods — with **zero lost sales**, matching day-close cash, and cashiers preferring it to notebook / spreadsheet.

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

---

## Traceability

| Gates | Vision |
|-------|--------|
| P1-01–11 | Phase 1 success + Phase 1 (store-day) metrics |
| Non-gates | Long-term vs Phase 1 launch gate notes |
| Long-term | Success Metrics → Long-term (platform) |
