# Stakeholders

Version: 1.1
Status: Draft
Last Updated: August 2026
Source: [vision.md](./vision.md) v1.3 · [product-scope.md](./product-scope.md) v1.1 · [phase-2.md](./phase-2.md) v1.0

---

## Purpose

Who cares about this POS, what they need, and how much power they have over Phase 1 and Phase 2 decisions. Use this for interviews, acceptance, and PRD sign-off — not as an org chart.

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

## Stakeholder map (Phase 2)

Phase 1 map still applies. Phase 2 adds operations roles. Canonical modules: [phase-2.md](./phase-2.md).

| Stakeholder | Type | Primary need | Influence on Phase 2 | Engagement |
|-------------|------|--------------|----------------------|------------|
| Cashier | End user (primary) | Shift close; returns; attach customer; still sell offline | High (acceptance) | Shift + return drills; offline regression |
| Store Manager | End user (primary) | Opname, refunds, shift difference, reports | High (acceptance) | Approve variances, refunds, transfers |
| Inventory staff | End user | Ledger, adjustment, opname, receiving | High (2A–2B) | Count and receive on real SKUs |
| Purchasing staff | End user | Suppliers, POs, goods receipt | High (2B) | PO → receive loop |
| Supervisor | End user | Overrides, limited reports | Medium | Approval path when manager is away |
| Administrator | Operator | Catalog + images; **Dashboard RBAC** (users, roles, permissions) | High (2A, 2D) | Product media hygiene; Employees screen |
| Business Owner | Buyer / sponsor | Multi-store path; analytics; not ERP | High (go/no-go) | 2D scope; store two timing |
| Accountant | Downstream | Sales/inventory/financial reports | Medium–High | Report review; still not ERP |
| Customer (shopper) | Indirect | Loyalty/receipt; still no customer app | Low | Observe only |
| Product (PM) | Delivery | Phase 2 IN/OUT; Cloudinary isolation | High | Owns waves 2A–2D |
| Engineering | Delivery | Ledger + media isolation + no offline regression | High | Cloudinary behind MediaService |
| UX / Design | Delivery | Admin ops UX; cashier returns/shift | Medium–High | Opname, PO, return, shift flows |

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

**Phase 2**

- Owns catalog images, categories/brands
- Owns **Dashboard Employees / RBAC**: create users, assign roles, edit permission matrix (Owner/Admin only)

---

### Accountant — light Phase 1 / stronger later

**Jobs**

- Export clean daily sales for books/tax

**Phase 1 bar**

- CSV / daily totals acceptable
- Not a blocker for Instant Checkout + Offline Mode

**Phase 2 bar**

- Sales, inventory, and financial reports available; still not an ERP replacement

---

### Customer (shopper) — indirect

**Jobs**

- Leave the line quickly with the correct price

**Phase 1 bar**

- Observed queue / price correctness only; no customer-facing app

---

## Personas & jobs (Phase 2)

### Inventory staff

**Jobs**

- See stock by store; run opname; adjust with reason; receive goods

**Success looks like**

- Ledger matches physical after opname; every movement has a reason

**Risk if ignored**

- “Basic qty” from Phase 1 stays untrustworthy; purchasing and returns cannot land

---

### Purchasing staff

**Jobs**

- Maintain suppliers; raise POs; record goods received

**Success looks like**

- PO → receipt → stock IN without a spreadsheet sidecar

**Risk if ignored**

- Inventory only goes down (sales) and never comes in cleanly

---

### Supervisor

**Jobs**

- Approve voids/refunds when manager is away; limited operational reports

**Success looks like**

- Approval path exists without giving cashier full manager rights

---

## Later stakeholders (after Phase 2)

| Stakeholder | When they matter |
|-------------|------------------|
| Warehouse staff | Warehouse / receiving **apps** (P2+) — receiving *in Admin* is Phase 2 |
| Multi-branch ops / regional manager | SaaS scale beyond Phase 2D multi-store |
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

## RACI — Phase 2 product decisions

| Decision | Cashier | Manager | Inv. | Purch. | Owner | Admin | PM | Eng |
|----------|---------|---------|------|--------|-------|-------|----|-----|
| Phase 2 IN/OUT / waves | C | C | C | C | A | C | R | C |
| Cloudinary isolation (no checkout path) | C | I | I | I | A | I | R | R |
| Opname / adjustment policy | I | A | R | I | C | I | C | C |
| PO approval & receiving | I | A | C | R | C | I | C | C |
| Return / refund policy | C | A | C | I | C | I | R | C |
| Shift reconciliation | R | A | I | I | C | I | C | I |
| RBAC on Dashboard (2D) | I | C | I | I | A | R | R | C |
| Multi-store / transfer (2D) | I | C | C | C | A | C | R | C |
| Phase 1 offline still passes | C | C | I | I | A | I | R | R |

---

## Engagement plan (minimal)

| Cadence | Who | Why |
|---------|-----|-----|
| Daily during pilot | Cashier (+ Manager as needed) | Catch bypass, sync confusion, hardware pain |
| End of each store day | Manager | Day close gate (P1-08) |
| End of pilot week | Owner + Cashier + Manager + PM | Preference + go/no-go |
| Pre-PRD workshop | Owner + PM (+ Eng/UX) | Close open decisions (card-offline, hardware, niche) |
| Per Phase 2 wave | Owner + PM + affected ops roles | 2A inventory/media; 2B purchasing/returns; 2C shift/customers; 2D growth |
| After each 2A–2C drop | Cashier + Manager | Confirm P1-01/P1-02 still pass (P2-01) |

---

## Traceability

| Section | Vision / Phase 2 |
|---------|------------------|
| Personas / jobs | Jobs to Be Done + Target Users |
| Phase 1 vs Phase 2 vs later | Target Users Phase 1 / Phase 2 / Later |
| Influence on Offline Mode | Offline Mode Phase 1 capability; Phase 2 must not break it |
| Modules / roles | [phase-2.md](./phase-2.md) |
