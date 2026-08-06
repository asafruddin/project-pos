# Adversarial Review — Phase 1 PRD (POS Apps)

**Reviewed:** `prd.md` (status: draft, 2026-08-05)  
**Lens:** Cynical review for launch/demo readiness holes, contradictory requirements, missing acceptance criteria, hardware/print/offline risks.  
**Role:** Assume this PRD will be handed to engineering tomorrow and demoed to strangers next week; find what breaks.

---

## Findings

- Receipt print is both a Sale-completion gate (FR-11 ties Stock to “successful Sale with successful Receipt print”) and an underspecified side effect (FR-10 is a one-liner with no retry, reprint, timeout, or “print job accepted vs paper out” criteria) — demo dies the first time the printer blinks red and nobody knows whether to treat the Sale as done.

- FR-12 (“print failure must not silently update Stock”) contradicts FR-15 / UJ-2 (“offline completed Sale = success”) because the PRD never defines Sale state after print failure: incomplete, successful-but-unprinted, voidable, or retryable — Stock coupling without a Sale state machine is a silent-inventory-corruption machine.

- Offline sell loop (FR-14) requires “Receipt print” while Offline Mode out-of-scope excludes conflict perfection and §8 leaves printer matrix TBD — if print requires a networked/USB bridge that disappears with Wi‑Fi, UJ-2’s climax (“customer gets a normal completed Sale offline”) is unverifiable.

- Hardware acceptance is self-contradictory: §8 says Receipt printing on target demo device(s) is in acceptance, then tags `[ASSUMPTION: specific printer matrix TBD]`, and Open Question #1 still asks for the matrix — you cannot pass SM-1/SM-5 against an undefined printer.

- SM-5 forbids “apology paths,” yet §8’s platform ASSUMPTION is exactly an apology hatch: “PWA sufficient; native shell only if print/offline proof fails” — no failure criteria, no decision deadline, so demo readiness can slip forever while still claiming Phase 1 is “in scope.”

- FR-6 through FR-10 (and most of Instant Checkout) lack the “Consequences (testable)” blocks that Auth FRs have — no AC for empty cart, zero/negative price products, partial payment, overpay/change, double-tap Checkout, or what “record payment” means beyond a checkbox.

- FR-9 payment is cash/simple “paid” with live card out of scope, while Vision allows a pilot with “real money through the sell loop” — Day Close “cash summary” (FR-23) has no AC for opening float, expected vs counted cash, or who enters the count, so SM-3 can pass with a decorative number.

- FR-24 “warns before Day Close can complete” is ambiguous: soft warn (proceed after dismiss) vs hard block — if soft, Today’s Sales Report can close a day that Sync has not uploaded; if hard, an offline shop with Sync stuck cannot Day Close at all, stranding UJ-3.

- No AC for what happens to durable local Sales after Day Close with incomplete Sync: remain on device for next day, get marked closed-but-unsent, or disappear from cashier view while still unsynced — FR-16 reliability claim ends at restart, not at day boundary.

- Catalog offline freshness is a hole: FR-29 says products reach Cashier Menu “after catalog refresh / Sync to Local Database,” but there is no FR for first-run seed, mid-shift price change while offline, or stale Local Database prices sold as truth — Instant Checkout can ring wrong prices and still pass FR-15.

- Stock semantics are missing: FR-11/FR-30 say Stock “updates” / “reflects Sales” with no decrement rules, allow-negative policy, stock-out blocking at Checkout, or whether coffee SKUs are inventory-tracked at all — Dashboard Stock can be theater that neither proves nor constrains the sell loop.

- Single-shop Phase 1 does not constrain device count; multi-cashier offline conflict is out of scope as “perfection,” which silently allows two tablets offline to oversell Stock and double-count nothing until Sync — “zero lost Sales” (SM-2) is not the same as “zero conflicting Sales.”

- Connectivity detection is undefined: no FR for how offline is detected, flaky Wi‑Fi flapping, captive portals, or “online but Sync endpoint dead” — FR-17/FR-19 retries have no backoff, idempotency, or duplicate-Sale protection criteria.

- Sync idempotency and identity are absent: offline Sale IDs, server dedupe, clock skew, and partial upload failure mid-batch are unmentioned — “zero lost Sales” can still produce duplicated Sales and wrong Stock after reconnect.

- FR-5 offline POS PIN depends on “session/PIN material” in Local Database with only “fails clearly” as AC — no session TTL, remote revoke, stolen-tablet story, or PIN attempt lockout; offline unlock forever on a lost iPad is an unspoken security product.

- Role split (FR-32) is ASSUMPTION-level while Dashboard product/Stock management (FR-28) is in MVP — no AC for how roles are assigned, whether one Account Login can do both, or how demo accounts are provisioned for SM-1.

- Tax is Open Question #3 while Receipts and Day Close totals are demo success gates — Indonesia (or any) tax inclusive/exclusive unset means printed Receipt and “sales total” can be legally/operationally wrong in a “real money” pilot.

- Vision/docs drift is acknowledged (“retail-first” vs coffee-shop) but deferred; stakeholders reading `docs/01-business/` vs this PRD will argue scope mid-build — Phase 1 “coffee shop, no KDS” is not authoritative until vision sync is done or explicitly waived.

- Drink catalog shape is still Open Question #2 while §6.2 ASSUMPTION says flat products are enough — if the live pilot coffee shop needs sizes/modifiers, Instant Checkout UX and Local Database schema bake the wrong model for the only credibility path that matters.

- Latency NFRs apply only to Local Database path; the common demo path (online Wi‑Fi) has no Instant Checkout performance bar — SM-4 can pass in airplane mode and still feel sluggish on stage.

- UJ-1 edge case (“print fails → Stock must not silently update”) has no cashier recovery journey: no reprint FR, no void FR (explicitly deferred), no “mark Sale complete without print” — print failure is a dead-end that blocks both honest Stock and a clean Sale narrative.

- “Native-feel web POS” / PWA is a slogan without acceptance beyond latency ASSUMPTIONs — no installability, offline asset caching, tablet orientation, or touch-target criteria, so SM-5 remains presenter opinion.

- Builder/demo presenter is a named user, but there is no FR for demo reset, seed data, or scripted offline drill fixtures — SM-2’s drill can fail for environment setup reasons unrelated to product quality.

- Non-goal “full returns” and deferred voids leave no path to correct a mis-ring discovered before Day Close — offline durability then preserves mistakes that Day Close forces the cashier to “confirm” as correct (FR-26).

- FR-21 offline acceptance drill states the happy path only; it does not require print-failure-offline, Sync-failure-then-Day-Close, or kill-app-mid-Checkout — the drill as written can pass while the scary paths that prove Offline Mode remain untested.

- Glossary defines Sale as “Completed customer purchase (success even when offline)” and Receipt as “Printed proof of a Sale,” which implies Sale can exist without print — that conflicts with FR-11’s print-success precondition for Stock and with UJ-1’s climax (“Receipt prints — Sale is real”).

- Dashboard “authorized user” (FR-28) vs cashier Account Login after Day Close (FR-4/FR-27) never specifies whether Dashboard is a separate app/route, same session, or reachable without POS PIN — thin back-office can accidentally be one URL guess away during a live shift.

- “No lost Sales” is asserted as Offline Mode bar and SM-2 without defining loss: lost from cashier perception, lost from Local Database, lost from server after Sync, or lost from Day Close report — four different bugs can all claim compliance.

- Phase 1 success explicitly excludes SaaS growth, but optional “live pilot” with real money has no exit criteria, support expectation, or rollback — portfolio demo and live money are different risk classes stuffed into one MVP.

- Open Questions are listed but none are marked blocking vs deferred; printer matrix and tax are blocking for any honest print + money demo, yet MVP Scope still claims FR-1–FR-32 and Receipt print path as in scope — scope is closed while blockers are open.

---

## Reviewer note (meta)

Minimum ten findings required; more were found because print/Sale/Stock coupling, TBD hardware, and soft Day Close/Sync rules each spawn multiple independent failure modes. This PRD reads like a strong narrative spine with Auth-quality rigor only in §4.1 — Instant Checkout, Offline, print, and Day Close need the same “Consequences (testable)” treatment before architecture or stories should proceed.
