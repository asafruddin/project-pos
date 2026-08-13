# Reconcile — vision.md

Source: `docs/01-business/vision.md` (v1.3) vs `prd.md` + `addendum.md`. Extract only. No PRD rewrite.

## Covered (keep short)

- Crown jewels: Instant Checkout + Offline Mode (Phase 1); Run the business (Phase 2) without breaking the sell path.
- Cashier JTBD pack: sell (online/offline), pay, receipt, stock-by-sale, day close, pending sync / reconnect.
- Phase 2 P0/P1 map (catalog + media, ledger/opname, purchasing, returns, customers, shifts, then promotions/loyalty/reports/RBAC/multi-store) and waves 2A–2D.
- Media isolation: Cloudinary/Media Provider never on checkout / pay / receipt / sync; outage must not block sales.
- Offline split: Cashier sell / void / hold / shift offline-capable; Admin/Dashboard online-first; CRDT / cross-store offline sync out.
- Non-goals: ERP, accounting, manufacturing, CMS, KDS, required Worker, public API, warehouse/owner/customer/self-checkout apps.
- Latency bar on local path (search &lt;100ms, add &lt;50ms, checkout &lt;300ms); zero lost sales + airplane-mode drill.
- Device as source of truth for in-flight sales until sync; durable outbox; sync status must not relabel a complete sale.
- Thin Phase 1 Admin (catalog feed only); Cashier never manages users; tenancy stub activated as multi-store in 2D.

## Gaps (2-5, the important ones)

### 1. Receipt reprint + on-device digital receipt as Instant Checkout proof

- **Input:** Phase 1 Instant Checkout includes receipt reprint by sale id, and print **and/or** on-device digital receipt from **local** data (works offline). Receipt is how the cashier proves the sale.
- **PRD+addendum:** FR-10 is print-to-complete-the-sale. §8 allows browser print **or** on-screen confirm as a **demo fallback**. Addendum lists “Receipt reprint by Sale id; digital Receipt URL” under Deferred / follow-up — not as an override of Phase 1 IN.
- **Why it matters:** FR structure turned “proof of sale, including reprint and digital, from local data” into a one-shot print step (or a demo skip). The qualitative job — customer leaves with the correct proof; cashier can pull the same sale again without the network — is dropped. On-screen confirm is not the same product as a durable digital receipt.
- **Placement:** If Phase 1 stays locked to UJ-1 print-once, **addendum Intentional overrides** (reprint/digital are not Phase 1 gates). If still a sell-loop promise, **PRD §4.2** (reprint by sale id + local digital receipt; offline-capable). Do not leave it in Deferred as if vision never made it Phase 1.

### 2. Conflict report as the Phase 1 Offline Mode done-bar

- **Input:** Instant Checkout does optimistic local stock decrement and **reports conflicts later**. Offline Mode is “done” for Phase 1 with durable outbox + visible sync status + **conflict report** — explicitly not CRDT. Reconnect must give clear success / conflict feedback. Silent drop is unacceptable; pending state must be understandable.
- **PRD+addendum:** FR-19/20 cover retry + a count indicator that must not relabel a successful sale. No FR for conflict/rejection reporting back to the cashier (vision’s API even lists “conflict / rejection reporting”). Addendum defers “Sync conflict UI beyond retry + indicator” without an Intentional overrides row, so the Phase 1 done-bar is silently lowered.
- **Why it matters:** “No lost sale” ≠ “cashier understands a rejected or conflicting sync.” The feel vision cares about is reconnect **without cashier heroics** — a count of “waiting to upload” is not a conflict report. CRDT-out is already agreed; conflict **report** is what vision substituted for CRDT.
- **Placement:** If still a Phase 1 promise → **PRD §4.3** (sync result: success vs conflict/rejection, cashier-visible, not CRDT). If the locked PRD will not take it → **addendum Intentional overrides** (Phase 1 gate = retry + indicator only; conflict report is later). Do not leave it only in Deferred.

### 3. Logged manager override for wrong price / recover-the-ring as Instant Checkout

- **Input:** Cashier JTBD: recover from wrong item / qty **without friction**. Instant Checkout: keyboard-first qty / +/− / void line / hold; **manager PIN override for wrong price and voids, always logged**. Store manager JTBD: cashiers cannot silently void everything.
- **PRD+addendum:** Qty/remove before checkout is FR-13. Void + hold + manager PIN are an **intentional** Phase 1 → 2B override (FR-62–63) — not this gap. What is missing: a logged **wrong-price** override on the sell path. Closest PRD cousin is FR-91 manager-approved discount in **2D Promotions**. Addendum’s override row names void/hold, not price.
- **Why it matters:** “Close the sale fast without thinking” includes fixing a ringing mistake without a promotions engine. FR-13 is cart edit; FR-91 is a campaign/discount control. The logged price-exception feel (trust + speed) has no home, so it will not show up in UX or epics unless someone notices.
- **Placement:** If Instant Checkout still owns recover-the-ring → **PRD §4.2** (logged manager price override; distinct from 2D promotions). If it rides with void to 2B or with FR-91 to 2D → **addendum Intentional overrides** (wrong-price PIN is not Phase 1; name the wave). Do not fold it silently into “cart qty.”

### 4. Hardware as first-class vs browser-print demo success

- **Input:** UX principle: printers, cash drawers, scanners, tablets are first-class; **prove the path early; do not assume browser print works.** Phase 1 IN risk spikes: outbox UX **and** ESC/POS (or target-device) print / scanner proof. Phase 1 success: hardware path proven on target devices.
- **PRD+addendum:** SM-1 may pass with browser print or on-screen confirm; ESC/POS is Open Question 1/7. Addendum overrides **keyboard/scanner first-class → not required for Phase 1 demo**, but does not override the broader hardware principle or “don’t assume browser print.”
- **Why it matters:** Vision’s native-feel is physical (print, scan, drawer), not only latency numbers (SM-4). The FR structure can ship a “website that feels native” that never touches a printer. That is a tone drop, not just an open question.
- **Placement:** **Addendum Intentional overrides** should state the real cut: Phase 1 demo print (browser / on-screen) is enough; hardware proof is not a Phase 1 gate (OQ remains). If hardware proof is still a gate, **PRD §7/§8** must not treat on-screen confirm as SM-1 success.

### 5. Phase 2 cashier “customer-specific pricing”

- **Input:** Phase 2 Cashier feature list includes split payment, store credit, **and customer-specific pricing**.
- **PRD+addendum:** Split tender + store credit are FR-110 / FR-68. Store-specific selling price is FR-106. Customer **groups** feed promotions (FR-73, FR-87). No per-customer price list / contract price. Not listed as an override.
- **Why it matters:** Easy to implement “promotions with a customer group” and call the vision line done. That is a different product (campaigns vs this regular’s price). Distorts Phase 2 cashier scope and owner JTBD (money in without an ERP).
- **Placement:** If in P0/P1 → **PRD §4.12 or §4.15** (customer price override, distinct from store price and from promotions). If out → **addendum Intentional overrides** (group promotions only; no per-customer price list in this PRD).

## Qualitative dropped

Tone/voice/feel the FR list did not carry (even where a related FR exists):

- **Offline Mode as pride, not apology.** Vision: a named product feature, not a fallback. PRD specifies drills and “sale remains success,” which is correct and colder — the cashier-facing voice (“we meant to work without Wi‑Fi”) is gone.
- **Instant Checkout as obsession.** “Unbelievably good,” “cashiers should never wait,” “close the sale without thinking,” “animations are secondary to responsiveness.” PRD kept the latency ASSUMPTIONs and “native-feel” SM-4; it lost the anti-chrome priority (motion, extra steps, network spinners must lose to speed).
- **Reconnect without heroics.** Pending sync must be **understandable**; the queue drains without a clever cashier. Indicator count ≠ understanding (ties to gap 2).
- **Notebook as the real competitor.** Phase 1 wins when a cashier prefers this to notebook/Excel for a **full store week including hours with no internet**. Addendum already overrides the 1-week preference **gate** to demo/portfolio — the competitive *feel* still is not in any FR/NFR (and should not be smuggled back as a metric if the override stands).
- **Hardware in the hand.** First-class printers/scanners/drawers vs a web app that prints through the browser (ties to gap 4).
- **Trust on the floor.** Logged overrides so managers can sleep; silent void/price change is a betrayal, not just a missing permission bit (ties to gap 3).
- **Correct price, short line (indirect customer).** Vision’s only customer JTBD. No FR says the line is short because the price on the receipt matched what they were told.

## Not a gap

Intentional overrides already in addendum (do not re-open as silent misses):

- **Retail-first vision vs coffee-shop Phase 1 journeys** — documented override; Phase 2 is retail ops, still no KDS.
- Phase 1 void + hold/park + manager PIN for voids → Phase 2B (FR-62–63), because locked UJ-1–3 omitted them.
- Keyboard/scanner-first → not required for Phase 1 demo (tap UI).
- 1-week live-pilot / “prefers notebook” **gate** → SM-1–3 / SM-5 demo-portfolio gates.
- CSV export as Phase 1 Admin → FR-31 list + totals; export in 2D.
- Cloudinary as a named PRD module → Media Provider in PRD; vendor + folder convention in addendum.
- Loyalty listed as both 2C and P1/2D → 2C happy path; rule richness may finish 2D.
- Long-term platform DX (100% TypeScript, Lighthouse 95+, &lt;2s load, shared packages on day one, Worker as an app, SaaS multi-currency/tax surface) — correctly out of this Phase 1+2 PRD; vision already marked several as not Phase 1 gates.
- Architecture stance (monorepo tooling must not delay first sale; hand DTOs; extract packages when duplication hurts) — belongs in architecture, not FRs.
