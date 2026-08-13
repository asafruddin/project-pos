# Adversarial Review — POS Apps Phase 1+2 PRD

**Reviewed:** `prd.md` (status: draft, updated 2026-08-13) + `addendum.md`  
**Lens:** Cynical review of the combined Phase 1+2 PRD. Phase 1 Instant Checkout + Offline Mode must stay locked; Media Provider must not sit on checkout; Day Close and Shift must coexist as specified, not as slogans; FR-1–32 stay frozen, then FR-33–112; Fast-path assumptions must be real decisions; two surfaces only; waves 2A–2D are delivery order. Look for what is missing.

---

## Verdict

The spine is recognizable: Phase 1 sell-path FRs are still numbered 1–32, Cloudinary is banished from the pay button, and Shift is not allowed to delete Day Close. That is the floor, not a pass. This document still lets Phase 2 *mutate* locked Instant Checkout without amending FR-6–FR-13 (Shift gate, split tender, customer price, ledger qty), scopes Media isolation so narrowly that Cashier Menu may still depend on the CDN, and treats Day Close vs Shift coexistence as a single blocking FR (FR-111) while leaving cash truth, register vs store close, and overnight shifts unspecified. Wave 2B ships Store Credit and cash Refunds before Customers and Shift exist. Fast path tagged a pile of assumptions in §11 and then wrote several of them as if they were product law — including a tax “default” that does not exist. Engineering can start the wrong module first and still claim compliance. Not story-ready.

---

## Findings

- **[critical] Instant Checkout is not gated — or protected — against Shift** — FR-75/FR-76 attach Sales to an open Shift; nothing says Dewi may still complete FR-6–FR-13 with no Shift open after 2C ships. If implementers require Open Shift before Cashier Menu, they rewrite locked Instant Checkout. If they do not, SM-9 Expected Cash silently omits unshifted Sales and Day Close (FR-23) disagrees with Shift totals. UJ-8 *implies* Shift-then-sell. The FR text never chooses. Fast path was supposed to keep the sell path untouched; this hole is how it gets touched.

- **[critical] Day Close vs Shift coexistence is a slogan plus one lock** — FR-111 only blocks Day Close finish while a Shift is open. Missing: (1) formula relating FR-23 “cash summary” to FR-78 Expected Cash — two cash numbers, no owner; (2) two Shifts in one calendar day, then one Day Close — whose drawer, whose report; (3) Day Close with zero Shifts opened after 2C — allowed, forbidden, or a Phase 1 relic; (4) Shift spanning midnight vs “same calendar day” Void (FR-63) vs Day Close; (5) after FR-104, Day Close per Register vs per Store. SM-9 can pass a single happy path and still strand a real close.

- **[critical] Media Provider isolation stops at the pay button** — FR-41/FR-42/SM-C5 forbid Media Provider on Checkout, payment, Receipt, and Sync. Cashier Menu is not on that list. Glossary defines Checkout as starting payment, so a “network capture of Instant Checkout” can miss every image request on the menu grid. No FR states whether catalog Sync stores image bytes or CDN URLs; URL-only plus empty HTTP cache means airplane-mode menu is a wall of placeholders while SM-10 still wants Product Media “visible on Cashier.” Cached-or-not is how Cloudinary sits on the cashier even when it does not sit on the tender screen.

- **[high] Locked FR-1–32 are preserved as IDs, not as behavior** — Variants (FR-37), ledger-locked qty (FR-35/FR-45), split tender (FR-110), customer price (FR-112), Promotions (FR-89), Loyalty redeem (FR-84) all change what FR-6–FR-9 *do* without a delta on the locked FRs. Guardrail §9 says do not rewrite Instant Checkout; the body rewrites it by decoration. Downstream will implement 2C checkout as a new path and call the old FRs “still there.”

- **[high] Phase 1 Stock qty has no ledger opening-balance FR** — FR-28 still lets Dashboard type Stock qty. FR-35 says current is not freely typed once the Stock Ledger exists. There is no FR that converts the Phase 1 qty field into an auditable opening Stock Movement on 2A cutover. First ledger deploy can zero the pastry case or keep two sources of truth. Addendum says “Phase 1 qty field becomes a projection” — mechanism note, not a testable consequence. This is a silent rewrite of FR-28/FR-30.

- **[high] 2A–2C approve actions with no role model** — Stock Opname, Purchase Orders, Refunds, and price edits require “manager/admin” before wave 2D RBAC (FR-98+). Phase 1 only seeded `cashier` vs `catalog_admin` (FR-32). Fast path resolved *who* approves (Store Manager or Admin) and never *how* that identity exists in 2A. Implementers will invent a third hardcoded role, overload `catalog_admin`, or leave approve endpoints open. FR-103’s “or Store Manager” mapping is the same unresolved fork, delayed.

- **[high] Wave 2B ships features that cannot work until 2C** — FR-68 Store Credit “without a Customer is rejected” lives in 2B; Customer is FR-70 in 2C. Cash Refunds in 2B have no Shift to attach to; FR-76 only attributes cash Refunds once Shift exists. Source `product-scope.md` / `phase-2.md` put cashier Returns in 2C (front-of-store) *and* stock lifecycle in 2B; the PRD stuffed Void, hold, Return, Refund, Exchange, and Store Credit into 2B. Addendum’s override table never records that wave split. 2B “complete stock lifecycle” is a cashier UX dump with a credit wallet that only errors.

- **[high] P0 wave 2C is contaminated with P1 Loyalty** — §6.4 labels 2C as P0, then includes FR-82–FR-86 with a footnote that rule richness may finish in 2D. Source priority matrix lists Loyalty as P1; SM-12 is secondary; success-metrics.md says do not gate P0 on Loyalty. The PRD wave table does not say 2C is *done* without earn/redeem. Fast-path “Loyalty happy path in 2C” is an assumption wearing a P0 badge. That is how 2D work delays the Shift drill.

- **[high] FR-110 and FR-112 are 2C checkout changes hiding in §4.18 Multi-Store** — IDs 1–112 exist; document order lies. Split tender and customer-specific price sit after FR-109, labeled Phase 2C, inside the 2D feature. FR-111 is parked after FR-27 with a footnote. Story extraction and wave 2C scope will miss the two FRs that actually mutate payment and price — the locked sell path. Numbering hygiene is not the same as navigable requirements.

- **[high] Exchange and split tender mutate payment without a Sale document model** — FR-68 “Return + replacement lines” never says whether the replacement is a new complete Sale (FR-9–FR-12, Receipt, STOCK OUT, Shift attach) or a single mutant document. FR-110 split tender has no method list; Open Question 7 still asks which methods exist besides cash and Store Credit, while FR-9 remains cash/simple paid. Store Credit balance online-first vs offline is unstated (Loyalty redeem was explicit; this was not). This is Instant Checkout being redesigned in the margins.

- **[high] In-transit Stock is missing from Transfer** — FR-107 assumes OUT at Shipped, IN at Received. Between those states quantity has left Store A and is not sellable at Store B. No glossary term, no Stock Overview line, no Damaged-like bucket, no oversell rule. SM-14 can pass endpoint-to-endpoint and still lose units in the truck. Fast-path assumption listed the posting ticks; it did not list the gap between them.

- **[high] Quantity source of truth has no conflict outcome** — §8: Local Database is cashier SoT until Sync; Stock Ledger is server SoT after Sync. Dashboard must not treat unsynced complete Sales as unreal. Missing: what happens when Sync is *rejected* or the two truths disagree (duplicate upload, clock skew, Void racing an in-flight Sale). Addendum still defers conflict-report UI. FR-48 makes double-count a test fail without Sale identity, idempotency keys, or partial-batch rules. Phase 2 ledger turns the old Offline Mode hole into wrong Stock, not just a duplicate row.

- **[medium] Same-day Void has no day, no clock, no unsynced race** — FR-63 “same calendar day” names no timezone, no Shift-day alternative, and no behavior when the Sale is still local and unsynced. Void locally then Sync both events, or Void only after ack? UJ-7’s edge is a hint, not an FR. Offline Mode plus ledger (FR-48) makes the race a quantity bug.

- **[medium] Fast-path tax “default” is imaginary** — FR-97: “tax uses Phase 1 open question default until set.” §10 Open Question 2 has no default. §11 does not invent one either. Receipts, Day Close totals, and the financial snapshot will be implemented as whoever’s last guess. Fast path was required to tag deferred tax, not to cite a default that was never written.

- **[medium] Parked carts vs Shift close vs Day Close — absent** — FR-62 hold is device-local. No consequence for Shift close or Day Close with parked carts: block, warn, discard, or survive the next Shift. A parked cart is not a Sale (good) and is also invisible to Expected Cash (dangerous). Device-local plus Register-scoped Shift (FR-75) is how a second cashier inherits someone else’s park — or loses it.

- **[medium] Catalog freshness still undefined; Phase 2 made it worse** — FR-29 still has no first-run seed, no mid-Shift price change while offline, no stale-price rule. Now add store price (FR-106), customer price fail-open (FR-112), and cached Promotion rules (FR-92). Offline Instant Checkout can ring yesterday’s list price, skip a Customer override, and apply last-cached happy hour. Fail-open is a decision; mixing three caches without a precedence FR is not.

- **[medium] Opname and receiving happy paths only** — No over-receive vs PO qty. Purchase Order state machine has no Cancel after Partially Received (only abandoned Draft). Stock Opname “system qty at count time” (FR-51) ignores Sales during the count. Concurrent Opnames on the same SKU are unmentioned. 2A/2B P0 can ship theater ledgers.

- **[medium] Two-surface Refund is unspecified** — UJ-7 puts Sari on the Cashier Return path; FR-67 denies cashier Refund at the API. Missing: does the manager approve on Cashier (PIN) or only on Dashboard (online-first)? If Dashboard-only, a coffee shop with one tablet cannot complete UJ-7. If Cashier PIN, Refund is a Cashier capability wearing a Dashboard permission — fine, but unstated. Two-surface discipline without a surface for the exception.

- **[medium] No success metric for Void or hold** — 2B P0 includes FR-62–FR-63; SM-8 covers Return → Refund only. Hold can ship as a toast. Same-day Void can ship without STOCK IN. Wave gates that do not mention a P0 FR are how it gets cut under schedule pressure.

- **[medium] Image fetch vs SM-4 latency** — §4.2 NFR is Local Database search/add/checkout. FR-40 allows a placeholder if the image fails; it does not forbid blocking add-to-cart on image load. A “visible on Cashier” reading of SM-10 will pull CDN on the menu and miss SM-C4 until after the demo.

- **[low] FR-103 role mapping is an or-gate** — `catalog_admin` maps to Admin *or* Store Manager. That is not a migration plan. One choice creates Employees admins from catalog clerks; the other strands FR-98 user-create. Pick one in the assumption or stop calling it testable.

- **[low] Receipt reprint still not an override** — Addendum Deferred lists reprint / digital Receipt URL. Intentional overrides table never says Phase 1 print-once is a deliberate cut. FR-12 retry is not reprint-after-complete. Phase 2 Returns lookup a Receipt the shop may not be able to print again. Either promote reprint to an FR or record the cut where overrides live.

- **[low] Document signals “draft” and trains extractors to think Phase 1 moved** — Frontmatter `status: draft`. FR-111 inserted after FR-27. HTML `&lt;` in NFR/assumption text. None of this is the architecture; all of it is how a locked Phase 1 set gets accidentally reopened in the next edit pass.

---

## Reviewer note (meta)

Minimum ten findings required. The combined PRD learned the Phase 1 lesson (testable consequences, FR-24 hard gate, print-failure Sale incomplete) and then spent the Fast-path budget on coverage: FR-33–FR-112 exist, waves exist, Cloudinary is named in the addendum. Coverage is not closure. The failures that matter are the missing invariants: Shift vs sell, cash vs cash, menu vs CDN, 2B vs 2C, ledger cutover, and Sync conflict. Fix those before UX or architecture treat this as a contract.
