# Reconcile — product-scope.md

Input: `docs/01-business/product-scope.md` (v1.1)
Against: `prd.md` + `addendum.md` (updated 2026-08-13)

## Covered (keep short)

Phase 1 pillars (Instant Checkout + Offline Mode), latency NFRs, thin Admin vs Cashier PWA, day close, single-store wedge, Phase 1/2 OUT lists, Phase 2 P0–P1 modules and 2A–2D waves, media isolation, RBAC-on-Dashboard, centralized promo/loyalty rules, Shift + Day Close coexistence. Phase 2 FRs FR-33–FR-111 largely match the input’s IN lists.

## Gaps (2-5, the important ones)

### 1. Conflict *report* collapsed into CRDT-out / deferred
- **Input:** Phase 1 IN = durable outbox + pending-sync UI + auto-sync + **conflict report**; Backend API includes **conflict feedback**. Phase 1 OUT = CRDT / multi-cashier conflict *perfection* (explicitly a different thing).
- **PRD+addendum:** §4.3 / §5 out-of-scope only names CRDT / multi-cashier perfection. FR-19–FR-20 are retry + status indicator. Addendum parks “Sync conflict UI beyond retry + indicator” under Deferred — not in the Intentional overrides table.
- **Why it matters:** Offline Mode acceptance in the input includes cashier-visible *rejection/conflict* feedback (duplicate, server refuse, stock mismatch), not just a spinner. Treating that as CRDT-out silently drops a Phase 1 IN bar.
- **Placement:** PRD — FR beside FR-19/FR-20 if it still gates SM-2. Else addendum **Intentional overrides** (not a quiet Deferred line).

### 2. Receipt reprint by sale id (and digital as first-class)
- **Input:** Phase 1 IN: “Receipt print and/or digital + **reprint by sale id**.”
- **PRD+addendum:** FR-10–FR-12 make *print success* the Sale-complete gate; §8 allows on-screen confirm as demo fallback. No reprint FR. Addendum Deferred lists “Receipt reprint by Sale id; digital Receipt URL” — again not in Intentional overrides.
- **Why it matters:** Reprint is the recovery path after a completed Sale (paper jam, customer asks again). Without it, print-failure (FR-12) and post-Sale reprint are unspecified; digital is demoted from IN to demo fallback.
- **Placement:** PRD §4.2 if still Phase 1 IN. Else addendum **Intentional overrides** with the same honesty as CSV/void.

### 3. Thin Admin: store stub + one tax profile
- **Input:** Phase 1 Admin = products/prices, basic stock, sales list/CSV, **store + tax + 2 roles**. Boundary: one currency, **one tax profile**. Phase 1 IN: **single store entity (stub for later multi-branch)**. 2D “activates the Phase 1 tenancy stub.”
- **PRD+addendum:** FR-28 is name/price/qty only. FR-32 covers two roles (cashier vs `catalog_admin`, not the input’s cashier/manager). No Phase 1 store-entity FR. Tax is only OQ #2 (inclusive/exclusive) — no configure/apply profile. CSV is an override (see Not a gap). FR-104 in 2D assumes a stub that Phase 1 never required.
- **Why it matters:** 2D cannot “activate” a stub that was never specified. One tax profile is a Phase 1 boundary with no FR, so prices stay tax-ambiguous through the locked sell path.
- **Placement:** PRD §4.5 — Store stub (even seeded) + single tax profile apply. Inclusive/exclusive may stay OQ. Role names: PRD note or addendum override (`catalog_admin` vs manager).

### 4. Device is source of truth until Sync acknowledges
- **Input:** Phase 1 delivery constraint: “**Device is source of truth for in-flight sales until sync acknowledges.**”
- **PRD+addendum:** Offline complete Sale is cashier-success (FR-15) and durable (FR-16); addendum says Local Database + upload queue. Neither states device-as-SoT until ack. After 2A, addendum makes **Stock Ledger** quantity SoT — which can be read as server-wins on conflict unless the in-flight rule is explicit.
- **Why it matters:** This is the Offline Mode invariant. If the server can rewrite an in-flight Sale before ack, “zero lost sales” and conflict-report (gap 1) have no owner.
- **Placement:** PRD §9 Guardrails (product invariant). Sync/conflict mechanism → addendum.

## Qualitative dropped

- Problem framing: notebooks/spreadsheets/generic tools; **wrong order** to build multi-branch SaaS before proving the sell loop. PRD Phase 1 is demo/portfolio; SM-C2 only partly carries the sequencing argument.
- “Cashier-first” / “Admin only feeds checkout” as the Phase 1 ship order (Cashier + API first). Implied by thin Admin, not stated as a delivery constraint.
- Hardware **risk spikes** as Phase 1 IN (ESC/POS or target print + scanner + offline on **real devices**). PRD: browser/on-screen print OK for SM-1; scanner overridden. The “prove on hardware” feel is gone.
- Hand DTOs until the domain stabilizes; monorepo allowed but must not delay first end-to-end sale. Architecture stance — not in addendum mechanism notes.
- Backend API as a named product surface (auth, catalog, commit/sync, payments record, day close, conflict feedback).
- Phase 2 open item: Cloudinary **Cashier vs Admin** transform/folder presets. Addendum has one folder convention + `q_auto`/`f_auto`, not a split or an OQ.
- Niche still open in input (boutique / warung / general retail). Overridden by coffee-shop (see below) rather than closed as a tracked decision.

## Not a gap

Intentional overrides (addendum table + locked Phase 1 PRD):

| Input | PRD / addendum | Why not a gap |
|-------|----------------|---------------|
| Retail-first Phase 1 | Coffee-shop UJs; Phase 2 retail ops, no KDS | Logged override |
| Same-day void + manager PIN in Phase 1 | FR-62–FR-63 in 2B | Logged override |
| Hold/park in Phase 1 IN | FR-62 in 2B | Logged override |
| CSV in thin Admin | FR-31 list + totals; export in 2D | Logged override |
| Scanner / keyboard first-class | Not required for Phase 1 demo | Logged override |
| Cloudinary named in product spine | Media Provider in PRD; Cloudinary in addendum | Vendor/mechanism split |
| Loyalty listed in 2C and P1/2D | 2C happy path; rule richness may finish 2D | Logged override |
| Store pricing in P0 catalog field list | One-store price in 2A (FR-34); per-store in 2D (FR-106) | Consistent with multi-store as P1 |
| Returns in both 2B (stock) and 2C (cashier) | All Return FRs in 2B; cashier still owns the flow | Wave merge, capability present |
| Custom roles in the same 2D wave as seven named roles | Optional, not a gate (FR-99) | Matches input’s open decision |
| Auth: cashier/manager; online login; offline continuation | Account Login + POS PIN + FR-5 | PRD is *more* specific, not missing |
| API paths / DB tables / folder strings | Addendum mechanism | Correct home |
