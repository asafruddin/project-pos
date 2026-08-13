# Reconcile — stakeholders.md

Input: `docs/01-business/stakeholders.md` (v1.1)  
PRD + addendum: Phase 1 + Phase 2 (updated 2026-08-13)

## Covered (keep short)

Cashier / Store Manager / Inventory / Purchasing jobs land in §2.1 and UJ-1–9. Phase 2 manager approvals (refund, opname, PO, shift difference) match the map. Seeded roles include the ops set (FR-99). Later stakeholders (warehouse app, regional ops, acquirer, tax SaaS, public API) are correctly non-users / §5. Customer-as-shopper stays indirect (no customer app). Accountant-as-GL is out; Phase 2 report bar is FR-93–97. Void/override trust is Phase 2B (addendum override of Phase 1 PIN). Cloudinary isolation is a product rule, not a stakeholder table.

## Gaps (2-5, the important ones)

### 1. Supervisor is a named role with no job or Permission

- **Input:** Phase 2 end user — approve voids/refunds when the manager is away; limited operational reports. Success = an approval path that does not give the cashier full manager rights.
- **PRD+addendum:** FR-99 seeds `Supervisor`. FR-101 / FR-63 / FR-67 only name Cashier vs Manager vs Admin. No §2.1 persona, no journey, no default matrix row.
- **Why it matters:** Without a distinct Supervisor Permission, a shop either stalls when the manager is away or over-privileges a cashier — the exact failure the input names.
- **Placement:** **PRD** §2.1 + FR-101 (and Void/Refund approval FRs). Addendum only if the one-shop pilot assumes “manager always present” / no Supervisor seat.

### 2. Owner (sponsor) collapsed into Admin (operator)

- **Input:** Distinct types. Owner = buyer, High go/no-go, money in/out, 2D / store-two timing, not ERP. Admin = operator, catalog + onboard-in-minutes; Phase 2 owns Dashboard Employees / permission matrix (Owner/Admin only). RACI: Owner is **A** on almost every product decision; Admin is **R** for catalog and RBAC.
- **PRD+addendum:** §2.1 is a single “Owner / Admin (Andi)”. FR-98/99 do split Owner vs Admin on user-admin, but Target User, journeys (UJ-4 Andi), and sign-off story do not. No owner go/no-go engagement (Phase 1 preference gate is an addendum override; Phase 2 owner go/no-go is not restated).
- **Why it matters:** Stakeholders.md is for interviews, acceptance, and PRD sign-off. Merging sponsor with operator hides who can kill 2D / store two vs who runs catalog/RBAC.
- **Placement:** **PRD** §2.1 — two jobs (even if one human in a one-shop pilot). Go/no-go cadence and RACI tables → **addendum**.

### 3. Approver RACI is already decided; PRD leaves it open

- **Input:** Phase 2 RACI: opname/adjustment **Manager A / Inventory R**; PO approval & receiving **Manager A / Purchasing R**; returns/refunds **Manager A**; RBAC **Owner A / Admin R**; multi-store/transfer **Owner A**; Phase 1 offline still passing **Owner A / PM+Eng R**.
- **PRD+addendum:** Open Question #3 asks who approves POs, opname variance, and transfers (Manager vs Admin vs Owner). FRs use a loose “manager/admin” `[ASSUMPTION]`. No RACI. No named owner of the “offline still passes after each wave” decision.
- **Why it matters:** The PRD treats a closed stakeholder decision as unsettled, so implementation will keep overloading Admin or inventing a fourth approver.
- **Placement:** **PRD** — close OQ #3 from this RACI (keep a one-shop “same person wears two hats” note). Full RACI grid → **addendum**.

### 4. Cashier + Manager as wave-regression acceptance owners

- **Input:** Influence = High (acceptance). Engagement: after each 2A–2C drop, Cashier + Manager confirm Phase 1 Instant Checkout / Offline still pass (P2-01). Daily pilot + day-close ownership in Phase 1. PM owns gates; they do not replace end-user acceptance.
- **PRD+addendum:** FR-21 / SM-2 / SM-C4 re-run the offline drill (especially after media). No acceptance owner. No per-wave cashier/manager sign-off. Delivery stakeholders (PM / Eng / UX) absent — fine as personas, but the P2-01 cadence is not recorded.
- **Why it matters:** Phase 2’s stated risk is ops modules making Instant Checkout metrics fiction. If only engineering “runs the drill,” bypass-to-paper will not show up.
- **Placement:** **PRD** §7 — SM-2 (and SM-10) signed by Cashier + Manager after each P0 wave. Cadence table (daily pilot, per-wave, end of week) → **addendum**.

## Qualitative dropped

- Purpose line: interviews / acceptance / sign-off — not an org chart.
- Risk-if-ignored: cashier bypass to paper; manager trust collapse → heavy RBAC too early or tool ban; owner scope-creep into multi-branch/analytics before the wedge works.
- Cashier success: prefers POS to notebook after one week; understands pending Sync without calling for help (FR-20 exists; the “no call for help” bar does not).
- Admin success: onboard a cashier in minutes; thin Admin is enough in Phase 1 (no time-to-onboard criterion).
- Shopper: observe queue time / price correctness only (no metric).
- Influence ratings and delivery-role engagement (PM owns IN/OUT; Eng hardware/offline spikes; UX sync-visibility).

## Not a gap

- Phase 1 manager PIN / same-day void — addendum override; restored as Phase 2B FRs.
- Phase 1 CSV export — addendum override; FR-31 + 2D export Permission; accountant-grade CSV deferred.
- 1-week live preference gate as Phase 1 success — addendum override (demo/portfolio SMs).
- Inventory, purchasing, returns, shifts, RBAC, multi-store, media isolation — in PRD FRs.
- Purchasing “Budi may wear this hat” — compatible with a small shop; input still allows one human, two jobs.
- Later stakeholders and “not an ERP” — aligned with §2.2 / §5.
- Builder / demo presenter — PRD-only audience; not a stakeholders.md miss.
