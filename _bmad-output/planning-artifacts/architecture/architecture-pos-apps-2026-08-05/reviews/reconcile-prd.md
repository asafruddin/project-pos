---
title: "Reconcile — Phase 2 PRD vs Architecture Spine"
status: extract
created: 2026-08-13
updated: 2026-08-13
sources:
  - _bmad-output/planning-artifacts/prds/prd-pos-apps-2026-08-05/prd.md
  - _bmad-output/planning-artifacts/prds/prd-pos-apps-2026-08-05/addendum.md
against: _bmad-output/planning-artifacts/architecture/architecture-pos-apps-2026-08-05/ARCHITECTURE-SPINE.md
---

# Reconcile — PRD + addendum → Architecture Spine

**Input:** `prd.md` (final, 2026-08-13) + `addendum.md`  
**Against:** `ARCHITECTURE-SPINE.md` (draft, Phase 1 + Phase 2, AD-1..19)  
**Date:** 2026-08-13  
**Job:** What from the PRD did not land in the spine — especially quiet constraints the AD structure dropped. Not a PRD rewrite. Not a re-litigation of Phase 1 gaps already closed (catalog pull, single Sale write path, AdjustStock).

## Covered (keep short)

Phase 1 locked path: local-primary Sale write (AD-1), completeness = payment + Receipt (AD-2), idempotent Sync (AD-3), single server Stock mutator (AD-4), apps→packages (AD-5), Account Login vs POS PIN (AD-6), Day Close vs unsynced acknowledge (AD-8), catalog pull into Local Database including image cache (AD-9), line `price_minor` snapshot (AD-10).

Phase 2 ADs exist for the named quiet constraints at headline level: MediaService-only Cloudinary (AD-12) + no live Media Provider after catalog refresh (AD-9); Stock Ledger as server qty truth + cutover opening movement (AD-13, AD-4); Shift required for Checkout / `AcceptCompleteSale` requires `shift_id` (AD-16); promo / loyalty / customer-price eval once in `packages/domain` with fail-open to last-cached catalog / Store / list price (AD-18); two apps, Offline Mode cashier-only, Dashboard online-only, no third Phase 2 app (AD-7). Durable outbox extended to Shift / Void / queued Customer create; Return lookup and Loyalty redeem online-first (AD-14). API Permission enforcement (AD-17). Store/Register stub (AD-19). Nest domain seams (AD-15). Oversell-on-Sync warn-not-block in Deferred. Non-goals (CRDT, KDS, card gateway, native shell, owner-mobile required) match PRD §5.

## Gaps (2–5, the important ones)

### 1. Fail-open is narrower than Instant Checkout decorations

- **Input:** §4.2: Promotions, Loyalty, **Customer attach**, **Product Media**, **split tender**, and Customer-specific price may decorate Checkout; they must **fail open** so FR-6–FR-13 still pass. FR-71 unattached Sale still completes. FR-86 / FR-92 Loyalty and Promotion outage. FR-112 price lookup fails open. FR-50 oversell **warn**, never wait on a live count. FR-89 invalid Coupon → Sale proceeds. FR-40 / UJ-4: image load failure never blocks add-to-cart.
- **Spine:** AD-18 fail-open names **last-cached catalog / Store / list price** and says completeness (AD-2) never waits on **Media Provider, Loyalty, or Promotion evaluation**. AD-14: Return lookup and Loyalty redeem must not block Instant Checkout if unavailable.
- **Why it matters:** The quiet rule is “every decoration fails open,” not “promo/loyalty/CDN fail open.” Customer attach down, Store Credit / split tender unavailable, missing image bytes, invalid Coupon, and oversell-at-zero can still grow a second completeness gate beside AD-2. AD-18’s Prevents (“decorations blocking Instant Checkout”) is broader than its Rule.
- **Placement:** **Spine AD-18** — extend the fail-open set to Customer attach, Product Media load, split tender / Store Credit, Coupon, oversell-warn (cite FR-50 already in Deferred). Completeness waits on payment + Receipt (+ open Shift after 2C) only.

### 2. Dual SoT: unsynced complete Sale is still real

- **Input:** §8 Quantity truth: until Sync succeeds, Local Database is SoT for **that device’s complete Sales** (cashier-facing). After Sync, Stock Ledger is server SoT. **Dashboard must not treat an unsynced complete Sale as “not real.”** Addendum: until Sync ack, device Local Database is SoT for those Sales; ledger is server truth after. FR-15 / FR-18 / FR-45: complete Sale is success; Sync posts STOCK OUT once; double-count is a test fail.
- **Spine:** AD-13 = ledger is **server quantity** truth after 2A. AD-1 = Local Database write path. AD-3 = rejected Sync does not delete the local complete Sale. No AD says Dashboard / reports / Day Close **must count local-complete-but-unsynced Sales as real**, or that ledger SoT starts **at Sync ack**, not at Receipt.
- **Why it matters:** Easy to implement “Stock Overview = sum(movements)” and hide or zero unsynced Sales on Dashboard (contradicts FR-15 + §8). Also easy to post STOCK OUT at local complete (two qty truths) or skip the post and treat the Sale as incomplete until ack. The quiet split is **cashier SoT vs server SoT**, not “ledger replaces Local Database.”
- **Placement:** **Spine AD-13** (or a one-line amendment on AD-1/AD-4): Local-complete unsynced Sale is real on Cashier and must not be denied on Dashboard; ledger movement is created by `AcceptCompleteSale` on Sync ack; no double-post. Damaged vs sellable and non-tracked products (FR-35, FR-47) still unnamed.

### 3. Shift gate leftovers (Day Close coupling, Expected Cash, close ≠ Sync)

- **Input:** FR-75 / AD-16 headline is adopted: after 2C, Checkout disabled without open Shift; Sales never have `shift_id = null`. FR-111 extra: finish Day Close **disabled while Shift open**; Day Close with **zero closed Shifts that day is blocked if any complete Sale exists**; cash summary **displays** closed Shift Expected Cash / counted — does not invent a second formula. FR-78 formula (opening + cash Sales + Cash In − Cash Out − cash Refunds − cash Voids). FR-80: Shift close does **not** require FR-24 (Sync drain stays Day Close). FR-79: non-zero difference **warn, not hard-block**. Midnight-spanning Shift; same-calendar-day Void uses Sale date, not Shift open date.
- **Spine:** AD-16: Checkout off without open Shift; `AcceptCompleteSale` requires `shift_id`; one open Shift per Register. AD-8: Day Close cannot finish while a Shift is open; cash summary displays closed Shift Expected Cash / counted. Conventions still mark Sync DTO `shift_id?`.
- **Why it matters:** SM-9 assumes every Sale has a Shift; a builder can ship optional `shift_id` forever (conventions still `?`). Day Close can pass with Sales and **no** closed Shift. Shift close can be incorrectly blocked on unsynced Sales (collapsing Shift into Day Close). Expected Cash can be re-derived on Day Close and disagree with FR-78. Midnight Shift + calendar-day Void will split cash.
- **Placement:** **Spine AD-8 / AD-16 / conventions:** after 2C, `shift_id` required on complete Sale + Accept; Day Close blocked if complete Sales exist with zero closed Shifts; Shift close independent of FR-24; Expected Cash owned by Shift (formula or “FR-78, do not fork”); Void date = Sale calendar date.

### 4. Two surfaces: capability placement + Register-local Refund, not only “no third app”

- **Input:** §2.4 / §5 / §8: two surfaces — sell path on Cashier, run-the-business on Dashboard; not “all-in-one.” Offline split: Cashier search / cart / Checkout / payment / Receipt / **hold** / Void / Shift; Dashboard receiving / PO / Suppliers / products / Customers / reports / Promotions — online-first. FR-54 Stock Opname not on Cashier. FR-109 multi-Store not in Checkout. FR-62 hold/park **device-local**. FR-67 quiet exception: Refund is manager/admin, **API-enforced**, but approval is **in-session manager PIN at the Register** so the customer is made whole **without a Dashboard round-trip**; Return may be parked. Addendum already flattened three pillars → two surfaces (do not re-open a third app).
- **Spine:** AD-7 Prevents “ops screens on Instant Checkout” and a third Phase 2 app; Rule is Offline Mode / Local Database cashier-only, Dashboard online-only, multi-Store not in Instant Checkout. AD-11: Cashier never creates users. Capability map puts Opname / purchasing / RBAC on Dashboard. **Hold/park has no AD or map row.** Refund in-session at Register is absent (AD-17 only: cashier tokens cannot call Refund endpoints).
- **Why it matters:** AD-7 reads as “two Next apps + no KDS.” The quiet discipline is **which jobs may live on Instant Checkout**. Without it, Stock Opname-on-POS or PO-on-Cashier can still ship “because AD-7 didn’t name them.” Conversely, FR-67 without the Register-PIN exception becomes “go to Dashboard to Refund,” which breaks UJ-7 on the floor. Hold/park (FR-62) can become a shared Register queue (PRD OQ-3) or a Sale, mutating Stock.
- **Placement:** **Spine AD-7** — name the offline split (hold/Void/Shift on Cashier; receiving/PO/Opname/RBAC/reports on Dashboard). **AD-14 or AD-17:** Refund Permission stays API-enforced; the UX path is in-session at Register, not a Dashboard detour. Hold/park = device-local, not a Sale, no Stock.

### 5. Media isolation remainder: sell-path never depends on bytes or publish-with-image

- **Input:** Manifesto: Media Provider is infrastructure, **not transaction infrastructure**; must never sit on Checkout, payment, Receipt, Sync, **or Cashier Menu after catalog refresh**. FR-41 / SM-10 / SM-C5: after refresh, airplane-mode Menu renders from cache; **any design that makes SM-1 require Cloudinary fails**. FR-40: warn, **not hard-block**, publish without primary image; placeholder allowed; add-to-cart still works. FR-42: forced provider failure, SM-1 still completes. Notes: category / brand / Promotion / Store images may share the provider; they are **not** a 2A success gate.
- **Spine:** Paradigm sentence + AD-12 (MediaService-only SDK, DB references, delete+retry, transforms) + AD-9 (durable image cache; Menu/Checkout/payment/Receipt/Sync must not require a live Media Provider call). Strong on **SDK / live-call isolation**. Silent on: add-to-cart when cache is empty or fetch failed; warn-not-hard-block publish; SM-C5 as a gate; non-product folders not a 2A gate.
- **Why it matters:** A builder can isolate the SDK, still `hard-block` publish without a primary image, or treat a missing cache entry as a blocked Menu tile — SM-1 then depends on Cloudinary/cache fullness. That is the isolation *feel* the AD dropped while keeping the mechanism.
- **Placement:** **Spine AD-9 or AD-12:** missing/failed image → placeholder; add-to-cart never blocked (FR-40). Publish warn-not-block. SM-C5: SM-1 must not require the Media Provider. Non-product assets = convention, not 2A gate (PRD already cut this).

## Qualitative dropped

Tone the ADs kept as slogans or Prevents but not as Rules:

- **“Not all-in-one / Dashboard feels like operations, not an ERP.”** AD-7 bans a third app; it does not bind Dashboard IA (ops vs management). PRD addendum already flattened three pillars — do not revive a third surface — but the anti-ERP *feel* has no AD. Builders can still dump 2A–2D into one Admin monolith and “pass” AD-7.
- **“Do not ship Phase 2 as one giant release” / 2D cannot delay 2A / 2C done without Loyalty.** Waves appear in AD names (2A cutover, 2C Shift). No invariant that Loyalty/Promotions/RBAC are not gates for 2A ledger or 2C Shift (SM-C2, §6.4). Capability map lists Customers / Loyalty in one row — easy to couple SM-9 to FR-82.
- **Offline Mode as pride, not apology.** Drills (FR-21) and “complete Sale remains success” landed; cashier-facing voice did not (architecture-appropriate to skip, unless UX copy is derived from the spine).
- **Audit as a cross-cutting NFR.** Ledger has reason/actor/timestamp (AD-13). Returns, Refunds, Shift differences, RBAC changes, Day Close unsynced acknowledgements are attributable in PRD §8 — only ledger is bound. Day Close acknowledge persistence (local vs API) still unnamed.
- **Native-feel latency.** §4.2 NFR search &lt;100ms / add &lt;50ms / checkout &lt;300ms; SM-4 re-measure after Phase 2A+. Operations envelope has hosts, not the Local Database latency bar.
- **Exchange = new complete Sale** (FR-68), not a mutant original — no AD; STOCK OUT for replacements can be implemented as line-edits on the old Sale.
- **Payments / Store Credit / split tender** have no module or command. Addendum suggested a Payments module; spine Nest list has no Payments. Money-out (Refund, Store Credit, split) can land as ad-hoc Sales fields.

## Not a gap

Do not re-open; already in spine or explicit PRD/addendum cuts:

- Dual online-POST vs local-first Sale path — AD-1 closed it (local always, Sync when online).
- Catalog pull vs Sales Sync overload — AD-9 vs AD-3.
- Completeness gate, idempotent `sale_id`, Day Close vs unsynced acknowledge, POS PIN offline — AD-2, AD-3, AD-8, AD-6.
- MediaService-only Cloudinary SDK + no live CDN after refresh — AD-12 + AD-9 (remainder is gap 5, not “AD-12 missing”).
- Ledger as server qty after 2A + `AdjustStock` ≠ Sync — AD-13 + AD-4 (remainder is gap 2).
- Shift required for Checkout after 2C — AD-16 (remainder is gap 3).
- Shared promo/loyalty/customer-price eval — AD-18 (remainder is gap 1).
- Two Next apps, no owner-mobile / warehouse / KDS required — AD-7 + addendum three-pillars override (remainder is gap 4).
- Cloudinary named in addendum; PRD capability = Media Provider.
- Category/brand/promo/store folders = ops convention, not 2A SM-10 gate (PRD §4.7 Notes).
- Oversell warn-not-hard-block — Deferred (aligned with FR-50).
- CRDT / cross-Store offline Sync / card gateway / native shell / Background Worker as required app — Deferred + PRD §5.
- Until 2D, `cashier` | `catalog_admin`; `catalog_admin` is approver — AD-11.
- Type-safe contracts as architecture bar not SM-* — addendum override; AD-15 typed DTOs is the landing.
- Phase 1 coffee-shop journeys vs retail-first vision docs — PRD domain note, not a spine miss.

## Priority for spine amend (before Reviewer Gate)

1. **AD-18** — fail-open set = all Instant Checkout decorations, not only promo/loyalty/CDN.
2. **AD-13 (+ AD-1/AD-4)** — dual SoT: unsynced complete Sale is real; ledger posts on Sync ack; no double-count.
3. **AD-8 / AD-16 / Sync DTO** — required `shift_id` after 2C; Day Close vs zero closed Shifts; Shift close ≠ FR-24; Expected Cash owner.
4. **AD-7 / hold / FR-67** — capability split + device-local hold + Register-local Refund PIN.
5. **AD-9 / AD-12** — placeholder / never-block add-to-cart; warn-not-block publish; SM-C5.

Medium leftovers (Damaged vs sellable, non-tracked sell, Exchange = new Sale, Payments/Store Credit home, Day Close ack persistence, latency NFR, 2C-without-Loyalty wave gate, audit beyond ledger) can be Deferred or Open Questions if the five amends land.
