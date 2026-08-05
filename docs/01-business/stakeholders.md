# Stakeholders

Version: 1.0
Status: Draft
Last Updated: August 2026
Source: [vision.md](./vision.md) v1.2 · [product-scope.md](./product-scope.md) v1.0

---

## Purpose

Who cares about this POS, what they need, and how much power they have over Phase 1 decisions. Use this for interviews, acceptance, and PRD sign-off — not as an org chart.

---

## Stakeholder map (Phase 1)

| Stakeholder | Type | Primary need | Influence on Phase 1 | Engagement |
|-------------|------|--------------|----------------------|------------|
| Cashier | End user (primary) | Fast sell loop; works offline; easy fixes | High (acceptance) | Daily pilot; preference interview |
| Store Manager | End user (primary) | Trust voids/overrides; know what sold; day close | High (acceptance) | Day-close ownership; override review |
| Business Owner | Buyer / sponsor | Money in/out clarity; path to second store later | High (go/no-go) | Pilot sponsor; weekly outcome review |
| Administrator | Operator (light) | Products/prices; onboard cashier in minutes | Medium | Admin setup; catalog hygiene |
| Accountant | Downstream (light) | Clean daily sales export | Medium (later weight) | CSV/export review; Phase 1 thin OK |
| Customer (shopper) | Indirect | Short line; correct price | Low (indirect) | Observe queue time only |
| Product (PM) | Delivery | Scope integrity; metrics gates | High | Owns IN/OUT and success gates |
| Engineering | Delivery | Feasible Instant Checkout + Offline Mode | High | Builds; hardware/offline spikes |
| UX / Design | Delivery | Cashier-first UX; sync visibility | Medium–High | Sell-loop + offline status UX |

---

## Personas & jobs (Phase 1)

### Cashier — primary user

**Jobs**

- Close the sale fast without thinking
- Fix wrong item/qty without friction
- Keep selling when Wi‑Fi dies
- Match cash drawer at end of day

**Success looks like**

- Prefers POS to notebook after one week
- Never loses a sale offline
- Understands pending sync without calling for help

**Risk if ignored**

- Bypass to paper; Instant Checkout metrics become fiction

---

### Store Manager — primary user

**Jobs**

- Know what sold / what is low before restocking
- Prevent silent voids (PIN + log)
- Own day close integrity

**Success looks like**

- Day close matches without spreadsheet archaeology
- Override/void log is reviewable

**Risk if ignored**

- Trust collapse; forces heavy RBAC too early or bans the tool

---

### Business Owner — sponsor / buyer

**Jobs**

- See money in / money out without an ERP
- Prove one store works before paying for multi-branch SaaS

**Success looks like**

- Clear pilot week outcome vs notebook
- Confidence there is a migration path to branch two later (not built yet)

**Risk if ignored**

- Scope creep into multi-branch / analytics before wedge works

---

### Administrator — light Phase 1

**Jobs**

- Keep catalog and prices correct
- Onboard a cashier in minutes

**Success looks like**

- Thin Admin is enough; no demand for full back-office in Phase 1

---

### Accountant — light Phase 1 / stronger later

**Jobs**

- Export clean daily sales for books/tax

**Phase 1 bar**

- CSV / daily totals acceptable
- Not a blocker for Instant Checkout + Offline Mode

---

### Customer (shopper) — indirect

**Jobs**

- Leave the line quickly with the correct price

**Phase 1 bar**

- Observed queue / price correctness only; no customer-facing app

---

## Later stakeholders (post–Phase 1)

| Stakeholder | When they matter |
|-------------|------------------|
| Warehouse staff | Warehouse / receiving apps |
| Multi-branch ops / regional manager | Multi-store SaaS |
| Payment partner / acquirer | Deeper card / gateway integrations |
| Compliance / tax advisor | Multi-jurisdiction SaaS |
| Partner integrators | Public API / marketplace |

---

## RACI — Phase 1 product decisions

| Decision | Cashier | Manager | Owner | Admin | PM | Eng | UX |
|----------|---------|---------|-------|-------|----|-----|-----|
| Phase 1 IN/OUT scope | C | C | A | C | R | C | C |
| Offline Mode acceptance | C | C | A | I | R | R | C |
| Success gate pass/fail | C | C | A | I | R | C | C |
| Hardware matrix | C | C | A | I | R | R | C |
| Catalog / price setup | I | C | I | R | C | I | I |
| Day close process | C | R | A | I | C | I | I |
| Pilot go-live | C | C | A | C | R | R | C |

R = Responsible · A = Accountable · C = Consulted · I = Informed

---

## Engagement plan (minimal)

| Cadence | Who | Why |
|---------|-----|-----|
| Daily during pilot | Cashier (+ Manager as needed) | Catch bypass, sync confusion, hardware pain |
| End of each store day | Manager | Day close gate (P1-08) |
| End of pilot week | Owner + Cashier + Manager + PM | Preference + go/no-go |
| Pre-PRD workshop | Owner + PM (+ Eng/UX) | Close open decisions (card-offline, hardware, niche) |

---

## Traceability

| Section | Vision |
|---------|--------|
| Personas / jobs | Jobs to Be Done + Target Users |
| Phase 1 vs later | Target Users Phase 1 primary / Later |
| Influence on Offline Mode | Offline Mode Phase 1 capability |
