---
title: "POS Apps — Phase 1 PRD"
status: final
created: 2026-08-05
updated: 2026-08-05
---

# PRD: POS Apps — Phase 1
*Working title — Coffee-shop Instant Checkout + Offline Mode (demo / portfolio / optional live pilot).*

## 0. Document Purpose

This PRD defines **Phase 1** for **POS Apps** so product, design, and engineering can build and demo a credible **cafe / coffee shop** POS — a **website that feels like a native app** — without treating SaaS subscription growth as a success gate.

Grounded in `docs/01-business/` (vision, product-scope, success-metrics, stakeholders), with coaching decisions that **reframe Phase 1 around a coffee-shop pilot** (cart ring-up; no kitchen tickets). Vocabulary is Glossary-anchored; features use globally numbered FRs; assumptions are tagged `[ASSUMPTION]` and indexed in §9. Downstream: UX, architecture, epics/stories.

**Note:** Earlier vision docs said retail-first; this PRD’s Phase 1 pilot case is **coffee shop**. Sync vision docs in a follow-up if needed.

## 1. Vision

Phase 1 ships a **coffee-shop POS** experience that can be **demoed to users and shown in a portfolio**: a **website that feels like a native app**, centered on **Instant Checkout** and **Offline Mode** for a **single shop**. A pilot may put **real money through the sell loop** to prove credibility — but Phase 1 is **not judged by subscription growth or SaaS scale**.

It matters now because the story to tell is: *a barista-cashier can sell fast, including when the network dies, and close the day with a clear report* — not *we already have paying SaaS tenants*.

**Phase 1 success non-goal:** SaaS subscription / MRR growth.

**Offline Mode bar:** real — airplane-mode / kill-Wi‑Fi drill; zero lost Sales; Sync status visible without calling the Sale incomplete. Instant Checkout and Offline Mode are co-equal Phase 1 pillars.

## 2. Target User

### 2.1 Jobs To Be Done

**Cashier (barista-cashier)**
- Close the Sale fast without thinking (Cashier Menu → Cart Panel → Checkout → payment → Receipt)
- Keep selling when Wi‑Fi dies — no lost Sales
- Edit Cart Panel before Checkout when needed
- Day Close with sales total, cash, and Sync checked
- See Sync / upload status without panicking

**Store manager / owner (light)**
- See Stock and Sales on Dashboard
- Know money in / money out without an ERP

**Builder / demo presenter**
- Show a native-feel web POS that proves Instant Checkout + real Offline Mode

### 2.2 Non-Users (v1)

- Warehouse staff
- Multi-branch / regional ops as primary audience
- Kitchen / bar ticket operators (no KDS in Phase 1)
- “Paying SaaS tenant growth” as the audience Phase 1 optimizes for

### 2.3 Key User Journeys

**UJ-1. Dewi rings up a coffee-shop order and prints a Receipt.**
- **Persona + context:** Dewi, barista-cashier at a neighborhood coffee shop.
- **Entry state:** Must authenticate before the sell screen.
- **Path:** Account Login → POS PIN → select from Cashier Menu → items on Cart Panel with prices → Checkout → payment → print Receipt.
- **Climax:** Receipt prints — Sale is real.
- **Resolution:** Stock on Dashboard updates from that Sale (online path).
- **Edge case:** If Receipt print fails, the Sale is **not complete**; Stock must not update; cashier can retry print or cancel the in-progress Sale.

**UJ-2. Dewi keeps selling when the coffee shop Wi‑Fi dies.**
- **Persona + context:** Dewi mid-shift; network drops.
- **Entry state:** POS usable against Local Database.
- **Path:** Full sell loop offline → Sale = success → on reconnect, Sync uploads → Stock/Dashboard update.
- **Climax:** Customer gets a normal completed Sale offline; no lost Sale.
- **Resolution:** Cloud/Dashboard catches up after Sync.
- **Edge case:** Sync failure keeps Sale successful on device; retries; does not block next Sale.
- **[ASSUMPTION]:** Sync / “waiting to upload” indicator allowed; must not re-label Sale as incomplete.

**UJ-3. Dewi closes the cashier at end of day.**
- **Persona + context:** End of coffee shop day.
- **Path:** Day Close → check sales total, cash, Sync → Today’s Sales Report → confirm → Account Login.
- **Climax:** Report matches expectations.
- **Resolution:** At Account Login; day closed.
- **Edge case:** If Sync is incomplete, Day Close **cannot finish** until Sync completes or cashier explicitly acknowledges remaining unsynced Sales (hard warn; see FR-24).

## 3. Glossary

- **Account Login** — Username/email + password to sign into the app.
- **POS PIN** — 6-digit PIN that opens the Cashier POS after Account Login.
- **Cashier Menu** — Product selection UI for ringing up items.
- **Cart Panel** — Right panel listing selected products and prices.
- **Checkout** — Action that starts taking payment for the Cart Panel.
- **Sale** — Completed customer purchase (success even when offline).
- **Receipt** — Printed proof of a Sale.
- **Local Database** — On-device storage used when offline.
- **Sync** — Upload of local Sales to the server database when online.
- **Stock** — Product quantity shown/updated on Dashboard after Sync (or online Sale).
- **Dashboard** — Admin/back-office view of Stock and business data.
- **Day Close** — End-of-day cashier close with checks + Today’s Sales Report.
- **Today’s Sales Report** — End-of-day list of transactions, totals, and prices.

## 4. Features

### 4.1 Account Login and POS PIN

**Description:** Cashier reaches the sell screen only after Account Login, then POS PIN. Realizes UJ-1; enables UJ-2 and UJ-3.

#### FR-1: Account Login
Cashier can sign in with username/email + password (Account Login).

**Consequences (testable):**
- Valid credentials grant progress to POS PIN entry.
- Invalid credentials deny access to Cashier Menu.

#### FR-2: POS PIN gate
After Account Login, cashier must enter a 6-digit POS PIN before Cashier Menu is usable.

**Consequences (testable):**
- Correct 6-digit POS PIN opens Cashier Menu.
- Cashier Menu / Cart Panel / Checkout unavailable before successful POS PIN.

#### FR-3: Auth error feedback
Wrong Account Login or wrong POS PIN is rejected with a clear error.

**Consequences (testable):**
- User sees an error state; no access to Cart Panel or Checkout after failed attempt.

#### FR-4: Return to Account Login after Day Close
After Day Close completes, the app returns to Account Login. Realizes UJ-3.

**Consequences (testable):**
- Post–Day Close screen is Account Login.
- Prior POS PIN session cannot continue without Account Login + POS PIN again.

#### FR-5: Offline POS PIN unlock
`[ASSUMPTION]` POS PIN can unlock Cashier while offline if Account Login already succeeded earlier and Local Database has required session/PIN material. Needed for UJ-2.

**Consequences (testable):**
- With Local Database present, offline POS PIN unlock works after prior Account Login on that device.
- Without session material, offline unlock fails clearly.

**Out of Scope for 4.1:** SSO, biometrics, deep RBAC, manager override PIN for voids.

### 4.2 Instant Checkout

**Description:** Coffee-shop ring-up: Cashier Menu → Cart Panel → Checkout → payment → Receipt → Stock/Dashboard (online or after Sync). Realizes UJ-1.

**Sale lifecycle:** A Sale is **complete** only after payment is recorded **and** Receipt print succeeds (or an explicit Phase 1 demo fallback: on-screen Receipt confirmed — see §8). Stock updates only for complete Sales.

#### FR-6: Cashier Menu selection
Cashier can browse/select products from Cashier Menu.

**Consequences (testable):**
- Selecting a product adds it to Cart Panel.
- Products without price cannot be added (or show blocked state).

#### FR-7: Cart Panel with prices
Each selected product appears on Cart Panel with its price; panel stays in sync with selections.

**Consequences (testable):**
- Cart Panel line count and total match selected items.
- Removing a selection updates Cart Panel immediately.

#### FR-8: Start Checkout
Cashier can start Checkout when Cart Panel has at least one item.

**Consequences (testable):**
- Checkout disabled when Cart Panel is empty.
- Checkout shows payable total equal to Cart Panel total.

#### FR-9: Record payment
Cashier can record payment for the Checkout total. `[ASSUMPTION: cash and/or simple “paid” record; live card gateway out of Phase 1]`

**Consequences (testable):**
- Recording payment advances to Receipt step.
- Cancel before payment leaves Cart Panel intact.

#### FR-10: Print Receipt
Cashier can print Receipt for a Sale after payment is recorded.

**Consequences (testable):**
- Successful print marks Sale complete.
- Failed print leaves Sale incomplete; Stock unchanged; retry print available.

#### FR-11: Stock update after complete Sale (online)
After a **complete** Sale (payment + Receipt success) on the online path, Stock on Dashboard updates from that Sale. Realizes UJ-1.

**Consequences (testable):**
- Dashboard Stock decreases by sold quantities after complete online Sale.
- Incomplete Sale (print failed) does not change Dashboard Stock.

#### FR-12: Print failure — Sale incomplete
If Receipt print fails, Sale is incomplete; Stock must not update. Realizes UJ-1 edge.

**Consequences (testable):**
- Cashier sees print-failed state with retry and cancel.
- Cancel discards incomplete Sale without Stock change.

#### FR-13: Edit Cart Panel before Checkout
`[ASSUMPTION]` Cashier can remove/change qty on Cart Panel before Checkout.

**Consequences (testable):**
- Qty change updates line price and Cart Panel total.
- Edits unavailable after Checkout payment step starts.

**Feature-specific NFRs:**
- `[ASSUMPTION]` On Local Database path: product search &lt;100ms, add to Cart Panel &lt;50ms, Checkout commit &lt;300ms.

### 4.3 Offline Mode

**Description:** Full Instant Checkout on Local Database when offline; complete Sale is success for cashier; Sync on reconnect updates Stock / Dashboard. Realizes UJ-2.

#### FR-14: Offline sell loop on Local Database
While offline, Cashier can use POS against Local Database (Cashier Menu, Cart Panel, Checkout, payment, Receipt print).

**Consequences (testable):**
- With network off and Local Database present, UJ-1 path completes to Receipt.
- Without Local Database, offline sell is blocked with a clear error.

#### FR-15: Offline complete Sale is success
An offline **complete** Sale (payment + Receipt success) is success for the cashier (not a “pending sale”). Sync may still be waiting.

**Consequences (testable):**
- Cashier-facing UI shows Sale success after offline Receipt success.
- Sync pending does not change Sale success label.

#### FR-16: Durable local persistence
Offline complete Sale is persisted durably in Local Database (survives app restart).

**Consequences (testable):**
- After force-quit and reopen, unsynced complete Sales remain and can Sync.

#### FR-17: Sync on reconnect
When connectivity returns, app Syncs local complete Sales to the server database.

**Consequences (testable):**
- Reconnect triggers Sync without cashier re-entering Sales.
- Server gains one record per complete local Sale (no silent drop).

#### FR-18: Stock and Dashboard after Sync
After successful Sync, Stock and Dashboard reflect those Sales.

**Consequences (testable):**
- Post-Sync Stock matches sum of synced Sale lines.
- Dashboard sales list includes synced offline Sales.

#### FR-19: Sync retry without blocking sales
If Sync fails, Sale remains successful on device; Sync retries; cashier is not blocked from the next Sale.

**Consequences (testable):**
- Cashier can start a new Sale while prior Sync is retrying.
- Failed Sync is visible via Sync status (FR-20).

#### FR-20: Sync status indicator
UI shows Sync / “waiting to upload” status; it must not re-label a completed Sale as incomplete.

**Consequences (testable):**
- Indicator count matches unsynced complete Sales.
- Opening a past successful Sale does not show it as failed because Sync is pending.

#### FR-21: Offline acceptance drill
Phase 1 acceptance includes an offline drill (network off → full sell loop → reconnect → Sync → Stock/Dashboard updated).

**Consequences (testable):**
- Drill checklist pass/fail recorded for SM-2.

**Out of Scope for 4.3:** CRDT / multi-cashier conflict perfection; offline Dashboard admin; live card auth while offline.

### 4.4 Day Close

**Description:** Cashier ends the day: checks totals / cash / Sync, reviews Today’s Sales Report, returns to Account Login. Realizes UJ-3.

#### FR-22: Start Day Close
Cashier can start Day Close from POS.

**Consequences (testable):**
- Day Close entry is available from POS after POS PIN session.
- Starting Day Close does not delete Sales.

#### FR-23: Day Close checks
Day Close shows sales total, cash summary, and offline Sync status for review.

**Consequences (testable):**
- Sales total equals sum of complete Sales for the day (local + already synced).
- Sync status shows unsynced count if any.

#### FR-24: Block complete Day Close if Sync incomplete
If Sync is incomplete, app **blocks** finishing Day Close until Sync completes **or** cashier explicitly acknowledges remaining unsynced Sales (recorded). Soft ignore without acknowledge is not allowed.

**Consequences (testable):**
- Finish disabled while unsynced &gt; 0 until acknowledge or Sync drains to 0.
- Acknowledge leaves an audit note that Day Close completed with unsynced Sales.

#### FR-25: Today’s Sales Report
On Day Close path, app shows Today’s Sales Report (transactions, totals, prices).

**Consequences (testable):**
- Report lists each complete Sale with line prices and day total.
- Incomplete (print-failed) Sales are excluded or clearly marked incomplete — not counted in day total.

#### FR-26: Confirm report
Cashier can confirm the report is correct to finish Day Close.

**Consequences (testable):**
- Confirm requires FR-24 satisfied.
- Confirm triggers session end (FR-27).

#### FR-27: Return to Account Login
After confirm, POS session ends and app returns to Account Login.

**Consequences (testable):**
- POS PIN session cannot resume without Account Login + POS PIN.
- Unsynced Sales (if acknowledged) remain in Local Database for later Sync after next login.

### 4.5 Dashboard, products, and Stock

**Description:** Thin Dashboard so products/prices exist for Cashier Menu and Stock reflects Sales. Not a full back-office suite.

#### FR-28: Manage products
Authorized user can create/edit products (name, price, Stock qty) on Dashboard.

**Consequences (testable):**
- New product appears in Dashboard product list.
- Edited price is what Cashier Menu shows after catalog refresh.

#### FR-29: Catalog feeds Cashier Menu
Products on Dashboard are available on Cashier Menu (after catalog refresh / Sync to Local Database).

**Consequences (testable):**
- After refresh/Sync, Cashier Menu contains Dashboard products.
- Deleted/disabled products are not selectable on Cashier Menu.

#### FR-30: Stock reflects Sales
Dashboard shows Stock levels updated by complete online Sales and by Sync’d offline complete Sales.

**Consequences (testable):**
- Stock never decreases for incomplete Sales.
- After Sync, Stock matches server truth for synced Sales.

#### FR-31: Sales list and daily totals
Dashboard can list recent Sales / daily totals sufficient to verify Stock movement. `[ASSUMPTION: list + totals, not analytics charts]`

**Consequences (testable):**
- List shows Sale id/time/total at minimum.
- Daily total matches sum of listed complete Sales for that day.

#### FR-32: Role separation for catalog
`[ASSUMPTION]` Account Login supports a role that can manage products/Stock on Dashboard; cashier-only accounts cannot change catalog.

**Consequences (testable):**
- Cashier-only Account Login cannot open product edit on Dashboard.
- Catalog role can create/edit products (FR-28).

**Out of Scope for 4.5:** Suppliers, promotions, deep analytics, multi-branch, kitchen display.

## 5. Non-Goals (Explicit)

- SaaS subscription / MRR growth as a Phase 1 success criterion
- Multi-branch / multi-store
- Kitchen Display / bar tickets
- Live card payment gateway / offline card authorization
- Promotions, loyalty, suppliers, full returns
- Deep analytics charts
- CRDT / multi-cashier offline conflict perfection
- Becoming an ERP, accounting system, manufacturing system, or CMS
- Required Background Worker app, public API, marketplace

## 6. MVP Scope

### 6.1 In Scope

- Single coffee shop
- Cashier web app (native-feel): Account Login + POS PIN, Instant Checkout, Offline Mode, Day Close
- Thin Dashboard: products, prices, Stock, sales list/totals
- FR-1 through FR-32
- Offline acceptance drill (FR-21)
- Receipt print path as part of Sale success (FR-10–FR-12)

### 6.2 Out of Scope for MVP

- Everything in §5
- Manager void/override PIN flows (deferred; not in UJ-1–3)
- Drink modifiers / size matrix complexity beyond simple products `[ASSUMPTION: simple product list is enough for Phase 1 demo]`

## 7. Success Metrics

**Primary**
- **SM-1:** UJ-1 completes end-to-end in demo (Account Login → complete Sale with Receipt → Stock update online). Validates FR-1–FR-12, FR-28–FR-30.
- **SM-2:** Offline drill passes with zero lost complete Sales; Sync updates Stock/Dashboard. Validates FR-14–FR-21.
- **SM-3:** Day Close produces Today’s Sales Report and returns to Account Login with FR-24 satisfied. Validates FR-22–FR-27.

**Secondary**
- **SM-4:** Native-feel — Local Database path meets latency ASSUMPTION targets (§4.2 NFR).
- **SM-5:** Portfolio/demo ready — presenter can run UJ-1 and UJ-2 on the Phase 1 platform (PWA) without changing the story mid-demo.

**Counter-metrics (do not optimize)**
- **SM-C1:** Subscription count / MRR — must not gate Phase 1.
- **SM-C2:** Feature breadth (KDS, multi-branch, promotions, voids) — must not delay Instant Checkout + Offline Mode.

## 8. Cross-Cutting NFRs

- **Reliability:** No silent loss of offline complete Sales (FR-16, FR-19).
- **Performance:** Instant Checkout latency ASSUMPTIONs on Local Database path (§4.2).
- **Platform:** Phase 1 Cashier + Dashboard are **web/PWA**. Native shell is only a contingency if the chosen demo device cannot meet FR-10 or FR-14 on PWA — track as a spike, not an apology path in the demo script.
- **Receipt output:** Phase 1 demo accepts (a) device/browser print or (b) on-screen Receipt confirm as complete Sale if physical printer is not yet available. Physical ESC/POS matrix remains an Open Question for production-feel demos.
- **Security:** Passwords and POS PIN not logged in plaintext; basic role split (FR-32).

## 9. Open Questions

1. Target tablet + Receipt printer for production-feel demos? (browser print / on-screen Receipt OK for SM-1 until chosen)
2. Drink catalog: flat products only vs sizes/modifiers in Phase 1? (default: flat — §6.2)
3. Tax inclusive/exclusive for coffee-shop prices (target market)?
4. Update `docs/01-business/vision.md` from retail-first to coffee-shop Phase 1 pilot?
5. Post–Phase 1: manager voids, hold/park, CSV export, reprint — prioritize which first?

## 10. Assumptions Index

- FR-5: Offline POS PIN after prior Account Login on device
- FR-9: Payment = cash / simple paid record; no live card gateway
- FR-13: Cart Panel qty/remove before Checkout
- §4.2 NFR: search &lt;100ms, add &lt;50ms, checkout &lt;300ms on Local Database
- FR-20: Sync indicator visible; complete Sale remains success
- FR-24: Hard block finish Day Close until Sync=0 or explicit acknowledge
- FR-31: Dashboard list + totals, not charts
- FR-32: Catalog role vs cashier-only
- §6.2: Simple product list (no complex modifiers) for Phase 1
- §8: PWA first; Receipt may be browser print or on-screen confirm until hardware chosen
