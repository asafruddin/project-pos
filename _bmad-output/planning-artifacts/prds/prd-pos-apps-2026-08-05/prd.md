---
title: "POS Apps — Phase 1 + Phase 2 PRD"
status: final
created: 2026-08-05
updated: 2026-08-13
---

# PRD: POS Apps — Phase 1 + Phase 2
*Working title — Coffee-shop Instant Checkout + Offline Mode, then an operations platform to run the business.*

## 0. Document Purpose

This PRD defines **Phase 1** and **Phase 2** for **POS Apps** so product, design, and engineering can build a credible POS — a **website that feels like a native app** — then expand Dashboard into operations **without rewriting the sell path**.

Phase 1 is locked: Instant Checkout + Offline Mode for one coffee shop. Phase 2 is **Run the business**: catalog, Product Media, Stock Ledger, purchasing, Returns, Customers, Shifts, then growth modules (Promotions, Loyalty, reports, RBAC, multi-Store).

Grounded in `docs/01-business/` (vision, product-scope, success-metrics, stakeholders, **phase-2.md**). Phase 1 journeys and FR-1–FR-32 are preserved. Phase 2 FRs continue at FR-33. Vocabulary is Glossary-anchored; assumptions are tagged `[ASSUMPTION]` and indexed in §11. Downstream: existing UX (`_bmad-output/planning-artifacts/ux-designs/ux-pos-apps-2026-08-06/`) and architecture (`_bmad-output/planning-artifacts/architecture/architecture-pos-apps-2026-08-05/`) cover Phase 1; this update does not duplicate them. Mechanism and vendor notes live in `addendum.md`.

**Phase 1 domain note:** Vision docs are retail-first. This PRD’s Phase 1 pilot case remains **coffee shop** (cart ring-up; no kitchen tickets). Phase 2 is retail operations on that same sell path — still no KDS.

## 1. Vision

**Phase 1 — Sell reliably.** A coffee-shop POS that can be demoed and shown in a portfolio: Instant Checkout and Offline Mode for a **single shop**. A pilot may put real money through the sell loop. Phase 1 is **not** judged by subscription growth or SaaS scale.

**Phase 2 — Run the business.** Once the cashier can sell — including when the network dies — the store must trust Stock, receiving, Returns, Shifts, and catalog images. Dashboard grows into the operations console. The cashier stays fast, local, and resilient. The Media Provider enriches the catalog and **must never sit on Checkout, payment, Receipt, Sync, or Cashier Menu after catalog refresh**.

It matters now because the story after Phase 1 is: *the shop can operate — count Stock, receive a Purchase Order, take a Return, close a Shift — without turning the POS into an ERP and without breaking offline selling.*

**Offline Mode bar (both phases):** real airplane-mode / kill-Wi‑Fi drill; zero lost Sales; Sync status visible without calling the Sale incomplete.

**Phase 2 feel:** front of house vs back office — not “all-in-one business system.” Offline Mode is a product feature, not a fallback apology. *A notebook wins if the POS dies when the router does.* Dashboard should feel like operations (stock, receiving, people on Shift), not an ERP.

## 2. Target User

### 2.1 Jobs To Be Done

**Cashier (Dewi — barista-cashier; Phase 1 primary, Phase 2 still primary on the sell path)**
- Close the Sale fast without thinking (Cashier Menu → Cart Panel → Checkout → payment → Receipt)
- Keep selling when Wi‑Fi dies — no lost Sales
- Edit Cart Panel before Checkout when needed
- Day Close with sales total, cash, and Sync checked
- See Sync / upload status without panicking
- **Phase 2:** Open and close a Shift; attach a Customer; process a Return; redeem Loyalty when online

**Store manager (Sari)**
- See Stock and Sales on Dashboard
- Know money in / money out without an ERP
- **Phase 2:** Approve Refunds, Stock Adjustments, Purchase Orders, Stock Transfers, and Stock Opname variance; review Shift differences
- **Acceptance:** With Dewi, re-run Instant Checkout + Offline Mode drills after each Phase 2 wave (SM-2 / SM-10)

- **Supervisor (Phase 2D role; `[ASSUMPTION]` enhanced cashier when the manager is away)**
- Sell, Void (with approval rules), Shift, limited reports
- Cannot Refund, perform Stock Adjustment, change price, or manage users

**Inventory staff (Budi — Phase 2)**
- See Stock by Store; adjust with a reason; complete Stock Opname; record Damaged Stock

**Purchasing staff (Budi may wear this hat in a small shop — Phase 2)**
- Maintain Suppliers; raise and receive Purchase Orders so Goods Receipt becomes Stock IN

**Owner (Andi — sponsor)**
- Go/no-go for Phase 2 waves and Store #2; not the daily approver of Purchase Orders
- Catalog and Product Media when acting as operator; reports

**Admin (operator; may be Andi in a one-shop pilot)**
- Dashboard operations; **Phase 2D:** users, roles, and Permissions; cannot be created by Store Manager

**Builder / demo presenter**
- Show a native-feel web POS that proves Instant Checkout + real Offline Mode, then operations that do not regress that demo

### 2.2 Non-Users

**Phase 1 (still true)**
- Warehouse staff (no warehouse app)
- Multi-branch / regional ops as the audience Phase 1 optimizes for
- Kitchen / bar ticket operators (no KDS)
- “Paying SaaS tenant growth” as the audience Phase 1 optimizes for

**Phase 2 (still out of this PRD)**
- Warehouse app operators, owner-mobile-only operators, KDS cooks, self-checkout shoppers, public-API integrators, accountants expecting a GL

**Phase 2D in-scope but not cashier-primary:** multi-Store managers — they use Dashboard, not a second checkout product.

### 2.3 Key User Journeys

**UJ-1. Dewi rings up a coffee-shop order and prints a Receipt.** *(Phase 1 — locked)*
- **Persona + context:** Dewi, barista-cashier at a neighborhood coffee shop.
- **Entry state:** Must authenticate before the sell screen.
- **Path:** Account Login → POS PIN → select from Cashier Menu → items on Cart Panel with prices → Checkout → payment → print Receipt.
- **Climax:** Receipt prints — Sale is real.
- **Resolution:** Stock on Dashboard updates from that Sale (online path).
- **Edge case:** If Receipt print fails, the Sale is **not complete**; Stock must not update; cashier can retry print or cancel the in-progress Sale.

**UJ-2. Dewi keeps selling when the coffee shop Wi‑Fi dies.** *(Phase 1 — locked)*
- **Persona + context:** Dewi mid-shift; network drops.
- **Entry state:** POS usable against Local Database.
- **Path:** Full sell loop offline → Sale = success → on reconnect, Sync uploads → Stock/Dashboard update.
- **Climax:** Customer gets a normal completed Sale offline; no lost Sale.
- **Resolution:** Cloud/Dashboard catches up after Sync.
- **Edge case:** Sync failure keeps Sale successful on device; retries; does not block next Sale.
- **[ASSUMPTION]:** Sync / “waiting to upload” indicator allowed; must not re-label Sale as incomplete.

**UJ-3. Dewi closes the cashier at end of day.** *(Phase 1 — locked)*
- **Persona + context:** End of coffee shop day.
- **Path:** Day Close → check sales total, cash, Sync → Today’s Sales Report → confirm → Account Login.
- **Climax:** Report matches expectations.
- **Resolution:** At Account Login; day closed.
- **Edge case:** If Sync is incomplete, Day Close **cannot finish** until Sync completes or cashier explicitly acknowledges remaining unsynced Sales (hard warn; see FR-24).

**UJ-4. Andi publishes a product with images; Dewi still sells if images fail.** *(Phase 2A)* `[ASSUMPTION: protagonist names]`
- **Persona + context:** Andi, owner, adding a new pastry to the catalog on Dashboard (online).
- **Entry state:** Andi signed in on Dashboard with catalog permission.
- **Path:** Create product (name, SKU, price, category) → upload Product Media → set primary image → product active → Dewi’s Cashier Menu shows the item (and image if cached).
- **Climax:** Dewi can sell the pastry. If the Media Provider is down, Dewi still completes Instant Checkout from cached catalog data.
- **Resolution:** Dashboard shows the product with images; Cashier is not blocked.
- **Edge case:** Image load failure on Cashier Menu never blocks add-to-cart, Checkout, payment, Receipt, or Sync.

**UJ-5. Budi finishes a Stock Opname.** *(Phase 2A)*
- **Persona + context:** Budi, inventory staff, counting the pastry case at close.
- **Entry state:** Dashboard online; Store selected.
- **Path:** Create Stock Opname → select products → enter physical counts → see variance vs system → Sari reviews → approve → Stock Ledger updates.
- **Climax:** System Stock matches the count; every adjustment is auditable.
- **Resolution:** Stock Overview reflects approved counts.
- **Edge case:** Unapproved Stock Opname does not change Stock.

**UJ-6. Budi receives a Purchase Order.** *(Phase 2B)*
- **Persona + context:** Coffee beans arrive from a Supplier.
- **Entry state:** Purchase Order already Approved.
- **Path:** Record Goods Receipt (partial OK) → Stock IN on Stock Ledger → Purchase Order moves to Partially Received or Completed.
- **Climax:** Received qty is on the shelf in the system.
- **Resolution:** Stock Overview up; receiving is auditable.
- **Edge case:** Receiving is online-first; Dewi can still sell offline while Budi waits for network on Dashboard.

**UJ-7. Dewi takes a Return; Sari refunds.** *(Phase 2B)*
- **Persona + context:** Customer brings back a pastry from this morning’s Receipt.
- **Entry state:** Dewi on Cashier, online `[ASSUMPTION: receipt-lookup Return is online-first]`.
- **Path:** Find the Sale → select item → reason → inspect → inventory decision (resellable vs Damaged Stock) → Refund requires Sari → Stock Ledger updates.
- **Climax:** Customer is made whole; Stock is honest.
- **Resolution:** Return and Refund are auditable; cashier cannot Refund alone (FR-67).
- **Edge case:** Same-day Void of a Sale Dewi just completed may run on Local Database; looking up a prior Receipt to start a Return does not run on Local Database if offline.

**UJ-8. Dewi opens and closes a Shift, then Day Close.** *(Phase 2C)*
- **Persona + context:** Dewi’s working day; cash drawer in play.
- **Entry state:** After Account Login + POS PIN.
- **Path:** Open Shift (opening cash) → sell / Cash In / Cash Out / Refunds → close Shift (count drawer vs Expected Cash) → then UJ-3 Day Close (Sync + Today’s Sales Report → Account Login).
- **Climax:** Difference is visible; she is not asked to invent a number.
- **Resolution:** Shift closed; Day Close still enforces FR-24.
- **Edge case:** Shift open/close works offline; Day Close still blocks on unsynced Sales unless acknowledged.

**UJ-9. Dewi attaches a Customer and earns Points when online.** *(Phase 2C)*
- **Persona + context:** Regular wants the purchase on their Loyalty Account.
- **Entry state:** Cart Panel has items; network up `[ASSUMPTION: Loyalty earn/redeem online-first]`.
- **Path:** Search or create Customer → attach to Cart Panel → complete Sale → Points earn per shared rules.
- **Climax:** Customer sees Points; Sale still succeeds if they skip attach.
- **Resolution:** Purchase history on the Customer; Instant Checkout still works if Loyalty is unavailable.
- **Edge case:** Offline Sale completes without Loyalty; Points are not guessed locally.

### 2.4 Surfaces

| Surface | Phase 1 | Phase 2 | Offline |
|---------|---------|---------|---------|
| **Cashier (PWA)** | Instant Checkout, Offline Mode, Day Close | Returns, Shift, Customer attach, Loyalty/Promotions when available | Sell, Receipt, hold, Void, Shift ops |
| **Dashboard** | Thin: products, prices, Stock, sales list | Catalog, Product Media, Stock Ledger, purchasing, Customers, Promotions, reports, RBAC, Stores | Online-first |

Cashier never creates users or assigns roles. Multi-Store is not part of Instant Checkout.

## 3. Glossary

- **Account Login** — Username/email + password to sign into the app.
- **POS PIN** — 6-digit PIN that opens the Cashier POS after Account Login.
- **Cashier Menu** — Product selection UI for ringing up items.
- **Cart Panel** — Right panel listing selected products and prices.
- **Checkout** — Action that starts taking payment for the Cart Panel.
- **Sale** — Completed customer purchase (success even when offline). Complete only after payment **and** Receipt success (or Phase 1 on-screen Receipt confirm).
- **Receipt** — Printed (or confirmed on-screen) proof of a Sale.
- **Local Database** — On-device storage used when offline.
- **Sync** — Upload of local Sales (and other cashier-durable events) to the server database when online.
- **Stock** — Sellable quantity. Phase 1: Dashboard qty after complete Sale or Sync. Phase 2: current quantity implied by the Stock Ledger.
- **Dashboard** — Admin/back-office web surface. Thin in Phase 1; operations console in Phase 2.
- **Day Close** — End-of-day cashier close with checks + Today’s Sales Report + return to Account Login. Distinct from Shift close.
- **Today’s Sales Report** — End-of-day list of transactions, totals, and prices.
- **SKU** — Store-facing product identifier.
- **Variant** — Sellable child of a product (name, SKU, barcode, price, Stock, image).
- **Product Media** — Images for products (primary + gallery) referenced from the catalog.
- **Media Provider** — External image store/CDN for Product Media. `[ASSUMPTION: Cloudinary per phase-2.md]` Never on the cashier transaction path.
- **Stock Ledger** — Auditable list of Stock Movements. Every quantity change has a reason.
- **Stock Movement** — One ledger event (purchase IN, Sale OUT, Return IN, damage, Adjustment, Transfer).
- **Stock Adjustment** — Manual Stock ± with reason, recorded on the Stock Ledger.
- **Stock Opname** — Physical count vs system Stock; approved variance becomes Stock Adjustment(s).
- **Damaged Stock** — Quantity not sellable; separate from sellable Stock.
- **Supplier** — Vendor who supplies products.
- **Purchase Order** — Order to a Supplier. States: Draft, Submitted, Approved, Partially Received, Completed.
- **Goods Receipt** — Record of goods received against a Purchase Order; produces Stock IN.
- **Void** — Same-day cancellation of a complete Sale. Distinct from Return.
- **Return** — Post-Sale take-back of item(s) with reason and inventory decision.
- **Refund** — Money (or Store Credit) back to the customer for a Return or Void.
- **Exchange** — Return paired with a replacement Sale line.
- **Store Credit** — Balance on a Customer usable toward a later Sale.
- **Customer** — Named shopper record (profile, history, optional Loyalty Account).
- **Loyalty Account** — Points, tier, and rewards for a Customer.
- **Points** — Loyalty currency earned and redeemed under shared rules.
- **Promotion** — Discount or gift rule (percentage, fixed, BXGY, bundle, coupon, voucher, happy hour, etc.).
- **Coupon** — Code that applies a Promotion at Checkout.
- **Voucher** — Issued value instrument (distinct from Coupon).
- **Shift** — Cashier cash session: open (opening cash) → active → close (count vs Expected Cash).
- **Cash In / Cash Out** — Non-sale cash movements during a Shift.
- **Expected Cash** — Opening cash + cash Sales + Cash In − Cash Out − cash Refunds − cash Voids (FR-78).
- **RBAC** — Users, roles, and Permissions managed on Dashboard; enforced by API.
- **Permission** — Resource × action (view, create, update, delete, approve, export).
- **Store** — One location. Phase 1: exactly one. Phase 2D: many under a company.
- **Register** — Cashier station belonging to a Store.
- **Stock Transfer** — Movement of Stock from Store A to Store B with request → receive lifecycle.
- **In-transit** — Stock that has left Store A (Shipped) and is not yet sellable at Store B (Received).

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

**Out of Scope for 4.1:** SSO, biometrics. Deep RBAC is Phase 2D (FR-98+), not a Phase 1 login rewrite. Manager override PIN for voids is Phase 2 (FR-63).

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

**Phase 2 must not break these FRs.** Promotions, Loyalty, Customer attach, Product Media, split tender, and Customer-specific price may decorate Checkout; they must **fail open** so FR-6–FR-13 still pass. After wave 2C, Checkout additionally requires an open Shift (FR-75) — that is an additive gate, not a rewrite of Phase 1 (Phase 1 has no Shift module).

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
- Server gains one record per complete local Sale (no silent drop). Idempotent on local Sale id: retry must not duplicate.
- Rejected or failed Sync does not delete the local complete Sale; it retries (FR-19). `[ASSUMPTION: conflict-report UI still deferred; duplicate id = upsert, not a second Sale]`

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
Phase 1 acceptance includes an offline drill (network off → full sell loop → reconnect → Sync → Stock/Dashboard updated). Phase 2 acceptance **re-runs this drill** after catalog images and operations modules ship.

**Consequences (testable):**
- Drill checklist pass/fail recorded for SM-2 (and SM-10 after Product Media).

**Out of Scope for 4.3:** CRDT / multi-cashier conflict perfection; offline Dashboard admin; live card auth while offline; cross-Store offline Sync.

### 4.4 Day Close

**Description:** Cashier ends the day: checks totals / cash / Sync, reviews Today’s Sales Report, returns to Account Login. Realizes UJ-3. Phase 2 Shift close (FR-75+) happens **before** Day Close; it does not replace FR-22–FR-27. See FR-111.

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
- **After 2C:** cash summary for this Register equals the day’s closed Shifts (counted and Expected Cash per Shift). Day Close is per Register, not Store-wide. `[ASSUMPTION]`

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

#### FR-111: Day Close after Shift *(Phase 2C)*
After 2C, Day Close is the Register’s day gate; Shift is the cash-drawer session. Multiple Shifts per calendar day are allowed (one open at a time, FR-75). Realizes UJ-8.

**Consequences (testable):**
- Finish Day Close disabled while Shift status is open/active.
- After Shift close, FR-24 still applies.
- After 2C, Day Close with zero closed Shifts that day is blocked if any complete Sale exists (Sales require an open Shift).
- `[ASSUMPTION]` A Shift may span midnight; it is one Shift until closed. Same-calendar-day Void (FR-63) uses the Sale’s calendar date, not the Shift’s open date.
- Cash summary owner: Shift Expected Cash / counted (FR-78–FR-79); Day Close displays those Shift totals (FR-23); it does not invent a second cash formula.

### 4.5 Dashboard, products, and Stock *(Phase 1 thin Admin)*

**Description:** Thin Dashboard so products/prices exist for Cashier Menu and Stock reflects Sales. Not a full back-office suite in Phase 1. Phase 2 extends this surface in §4.6–§4.18 without removing FR-28–FR-32.

#### FR-28: Manage products
Authorized user can create/edit products (name, price, Stock qty) on Dashboard.

**Consequences (testable):**
- New product appears in Dashboard product list.
- Edited price is what Cashier Menu shows after catalog refresh.

#### FR-29: Catalog feeds Cashier Menu
Products on Dashboard are available on Cashier Menu (after catalog refresh to Local Database).

**Consequences (testable):**
- After refresh/Sync, Cashier Menu contains Dashboard products.
- Deleted/disabled products are not selectable on Cashier Menu.

#### FR-30: Stock reflects Sales
Dashboard shows Stock levels updated by complete online Sales and by Sync’d offline complete Sales.

**Consequences (testable):**
- Stock never decreases for incomplete Sales.
- After Sync, Stock matches server truth for synced Sales.

#### FR-31: Sales list and daily totals
Dashboard can list recent Sales / daily totals sufficient to verify Stock movement. `[ASSUMPTION: list + totals, not analytics charts]` Phase 2D reports (FR-93+) add charts; they do not replace this list.

**Consequences (testable):**
- List shows Sale id/time/total at minimum.
- Daily total matches sum of listed complete Sales for that day.

#### FR-32: Role separation for catalog
`[ASSUMPTION]` Account Login supports a role that can manage products/Stock on Dashboard; cashier-only accounts cannot change catalog. Phase 1 seeded roles: cashier vs catalog_admin. Phase 2D RBAC (FR-98+) replaces hardcoded roles without breaking this gate.

**Consequences (testable):**
- Cashier-only Account Login cannot open product edit on Dashboard.
- Catalog role can create/edit products (FR-28).

**Out of Scope for Phase 1 §4.5:** Suppliers, Promotions, deep analytics, multi-Store, kitchen display — those move to Phase 2 features below, not into FR-28–FR-32.

---

### 4.6 Product catalog *(Phase 2A, P0)*

**Description:** Phase 1 product CRUD becomes a full catalog. Admin owns create/edit. Cashier consumes a cached catalog. Realizes UJ-4.

#### FR-33: Catalog fields
Authorized Dashboard user can maintain product name, SKU, barcode, description, category, brand, tags, and status (active/inactive).

**Consequences (testable):**
- Inactive products are not selectable on Cashier Menu after catalog refresh.
- SKU is unique per catalog `[ASSUMPTION: unique per company, not globally across tenants]`.

#### FR-34: Pricing fields
Product has cost, selling price, and optional compare-at price. `[ASSUMPTION: Phase 2A is one-Store pricing; store-specific selling price is FR-106 in 2D]`

**Consequences (testable):**
- Cashier Menu uses selling price, not cost.
- Cost is visible on Dashboard to permitted roles only (not cashier-only).

#### FR-35: Inventory fields on product
Product can track Stock with current, min, and max. Current is not freely typed once Stock Ledger exists (FR-45); min/max drive low-Stock (FR-50).

**Consequences (testable):**
- Turning track-Stock off stops ledger quantity gates for that product `[ASSUMPTION: non-tracked items can still sell]`.
- Min/max persist independently of current qty.

#### FR-36: Categories and brands
Dashboard user can manage categories and brands and assign them to products.

**Consequences (testable):**
- Cashier Menu can filter or group by category after catalog refresh.
- Deleting a category in use is blocked or requires reassignment.

#### FR-37: Variants
A product may have Variants (name, SKU, barcode, price, Stock, image). Cashier sells a Variant, not an abstract parent, when Variants exist.

**Consequences (testable):**
- Adding a parent with Variants does not add an unpriced parent line to Cart Panel.
- Variant Stock is independent per Variant.

#### FR-38: Catalog does not block Instant Checkout
Catalog richness (images, Variants, SKU) must not add a required round-trip to Instant Checkout beyond Phase 1 Local Database rules.

**Consequences (testable):**
- Offline Cashier Menu still lists last-synced catalog (FR-14).
- Missing optional fields (barcode, brand) do not prevent Sale.

### 4.7 Product Media *(Phase 2A, P0)*

**Description:** Product images are required in Phase 2 for Dashboard and Cashier. Upload and metadata live on Dashboard. Cashier uses cached/optimized images. Media Provider is never on Checkout, payment, Receipt, or Sync. Realizes UJ-4.

#### FR-39: Upload and attach Product Media
Authorized Dashboard user can upload images for a product (primary + gallery), set sort order, alt text, and primary flag.

**Consequences (testable):**
- A product can have one primary image and zero or more gallery images.
- Metadata (including Media Provider id/URL) is stored with the catalog, not only at the Media Provider.

#### FR-40: Images required, load optional at sell
Phase 2 products intended for Cashier Menu are expected to have a primary image. Cashier still sells if the image fails to load.

**Consequences (testable):**
- Dashboard warns when publishing without a primary image `[ASSUMPTION: warn, not hard-block publish — so a shop can still sell]`.
- Cashier Menu placeholder is allowed; add-to-cart still works.

#### FR-41: Cashier consumes cached catalog images
Cashier displays Product Media from **Local Database / durable image cache** after catalog refresh. Cashier Menu, Checkout, payment, Receipt, and Sync must not require a live Media Provider call.

**Consequences (testable):**
- After a successful catalog refresh, airplane-mode Cashier Menu renders from cache (images or placeholders) with no Media Provider request.
- Catalog refresh stores enough image payload (bytes or an already-fetched cache) that a cold CDN is not needed to sell.
- Add-to-cart is never blocked by a missing image (FR-40).

#### FR-42: Media Provider outage does not block sales
If the Media Provider is down or slow, cashiers complete Instant Checkout using cached product data/images.

**Consequences (testable):**
- Forced Media Provider failure: SM-1 path still completes.
- Dashboard upload may fail with a clear error; Cashier is unaffected.

#### FR-43: Delete Product Media without orphans
Deleting an image removes it from the catalog **and** from the Media Provider. Reorder and set-primary are catalog-only (no re-upload).

**Consequences (testable):**
- After delete, product no longer references the image; Media Provider object is gone or a retry job will delete it.
- Set-primary does not duplicate bytes at the Media Provider.

**Notes:** Category, brand, Promotion, and Store images may use the same Media Provider (addendum folder convention). They are **not** a Phase 2A success gate — SM-10 is product images.

### 4.8 Inventory / Stock Ledger *(Phase 2A, P0)*

**Description:** Every Stock change has a reason and an auditable Stock Ledger. Phase 1 local decrement on Sale remains; Sync must post a Sale Stock Movement. Realizes UJ-5; preserves FR-11, FR-18, FR-30.

#### FR-44: Stock Overview
Authorized Dashboard user can see sellable Stock (and Damaged Stock) by product and, in 2D, by Store.

**Consequences (testable):**
- Overview qty equals sum of Stock Ledger for that product (and Store).
- Cashier does not need this screen to sell.

#### FR-45: Stock Ledger
Every quantity change is a Stock Movement with reason, actor, timestamp, and source document (Sale, Return, Goods Receipt, Stock Adjustment, Stock Opname, Stock Transfer).

**Consequences (testable):**
- There is no silent qty edit that bypasses the ledger.
- A complete Sale produces STOCK OUT; incomplete Sale does not.
- **2A cutover:** each tracked product’s Phase 1 qty is posted as one opening Stock Movement; afterwards FR-28 “Stock qty” is a projection of the ledger, not a free-typed field.

#### FR-46: Stock Adjustment
Permitted role (manager/admin; not cashier) can Stock Adjustment ± with a mandatory reason.

**Consequences (testable):**
- Adjustment without reason is rejected.
- Cashier-only account cannot adjust (see also FR-101).

#### FR-47: Damaged Stock
User can move quantity to Damaged Stock (STOCK OUT from sellable). Damaged is not sold on Cashier Menu.

**Consequences (testable):**
- Damaged qty does not appear as sellable Stock.
- Movement is on the Stock Ledger.

#### FR-48: Sale and Return post to ledger
Complete Sale → STOCK OUT. Resellable Return → STOCK IN. Damaged Return → Damaged Stock. Sync’d offline Sales post the same way after Sync (FR-18).

**Consequences (testable):**
- Double-counting a synced Sale on the ledger is a test fail.
- FR-12 incomplete Sale still produces zero Stock Movement.

#### FR-49: Purchase and Transfer events
Goods Receipt → STOCK IN. Stock Transfer → Store A OUT / Store B IN when received (FR-107). Unavailable until those waves; ledger must accept these event types.

**Consequences (testable):**
- Event types exist in the ledger model even if 2B/2D UI is not shipped yet `[ASSUMPTION: model in 2A, UI when wave says]`.

#### FR-50: Low / out of Stock
Dashboard surfaces products at or below min, and at zero. Cashier may still sell `[ASSUMPTION: no hard stop on oversell in Phase 2; warn only]` so Instant Checkout never waits on a live count.

**Consequences (testable):**
- Low-Stock list includes products at/under min.
- Oversell does not block Checkout; negative or zero is visible after Sync.

### 4.9 Stock Opname *(Phase 2A, P0)*

**Description:** Physical count vs system. Unapproved counts do not change Stock. Realizes UJ-5. Online-first on Dashboard.

#### FR-51: Create Stock Opname
Permitted user creates a Stock Opname for a Store and selected products.

**Consequences (testable):**
- Draft Stock Opname does not change Stock.
- Products listed show system qty at count time.

#### FR-52: Enter physical counts
User enters counted qty; system shows variance vs system qty.

**Consequences (testable):**
- Variance = counted − system.
- Saving counts without approve leaves Stock unchanged.

#### FR-53: Approve Stock Opname
Permitted approver (manager/admin) `[ASSUMPTION]` approves; each variance becomes an auditable Stock Adjustment.

**Consequences (testable):**
- After approve, Stock Overview matches counted qty for included products.
- Reject/cancel leaves Stock unchanged.

#### FR-54: Cashier does not own Stock Opname
Stock Opname is Dashboard, not Cashier Instant Checkout.

**Consequences (testable):**
- Cashier PWA has no Stock Opname complete-flow `[ASSUMPTION: no count-on-POS in Phase 2]`.

### 4.10 Purchasing and Suppliers *(Phase 2B, P0)*

**Description:** Suppliers and Purchase Orders. Workflow: Supplier → Purchase Order → Approval → Goods Receipt → Stock IN. Invoice/payment recorded, not a full AP/GL. Realizes UJ-6. Online-first. Cashier has no purchasing role.

#### FR-55: Supplier profile
Authorized user can create/edit Supplier (contacts, products they supply, pricing, payment terms, purchase history).

**Consequences (testable):**
- Supplier list is searchable on Dashboard.
- Cashier-only account cannot mutate Suppliers.

#### FR-56: Purchase Order lifecycle
Purchase Order states: Draft → Submitted → Approved → Partially Received → Completed.

**Consequences (testable):**
- Invalid skips (e.g. Draft → Completed) are rejected.
- Cancelled/abandoned Draft does not affect Stock.

#### FR-57: Create and submit Purchase Order
Purchasing staff can create a Purchase Order against a Supplier with lines (product, qty, cost).

**Consequences (testable):**
- Submitted Purchase Order is visible to an approver.
- Stock does not change on submit.

#### FR-58: Approve Purchase Order
Permitted approver `[ASSUMPTION: Store Manager or Admin]` moves Submitted → Approved.

**Consequences (testable):**
- Unapproved Purchase Order cannot be received.
- Approver identity is auditable.

#### FR-59: Goods Receipt (including partial)
User records Goods Receipt against an Approved Purchase Order. Partial receiving is allowed.

**Consequences (testable):**
- Partial receipt sets Partially Received; remaining qty still open.
- Full receipt of all lines sets Completed.

#### FR-60: Goods Receipt posts Stock IN
Each received line posts Stock IN on the Stock Ledger (FR-45).

**Consequences (testable):**
- Stock Overview increases by received qty.
- Receiving is not available offline on Dashboard.

#### FR-61: Invoice and payment status
User can record invoice reference and payment status against a Purchase Order. `[ASSUMPTION: status + reference only — not bank/GL posting]`

**Consequences (testable):**
- Purchase Order can be Completed for Stock while payment status is still unpaid.
- No general-ledger document is required to complete receiving.

### 4.11 Void, hold, Returns, and Refunds *(Phase 2B, P0)*

**Description:** Phase 1 deferred Void and hold/park; `phase-2.md` treats them as cashier operations. This PRD places them here so Returns have a boundary. Same-day Void ≠ Return. Realizes UJ-7.

#### FR-62: Hold / park Cart Panel
Cashier can park a Cart Panel before payment and resume it later. `[ASSUMPTION: parked carts are device-local; not a multi-Register shared queue]`

**Consequences (testable):**
- Parked cart is not a Sale and does not change Stock.
- Resume restores lines and totals.

#### FR-63: Same-day Void
Cashier can Void a complete Sale from the same calendar day, subject to manager approval rules `[ASSUMPTION: cashier Void requires manager Permission or PIN; manager/admin Void freely]`.

**Consequences (testable):**
- Void reverses Stock (STOCK IN) via Stock Ledger.
- Void is auditable; silent delete of a Sale is impossible.
- Void of a cash Sale decreases that Shift’s Expected Cash by the cash tendered (FR-78). Non-cash Void does not change Expected Cash.

#### FR-64: Find Sale for Return
Cashier or manager can look up a complete Sale (Receipt / Sale id) to start a Return. `[ASSUMPTION: lookup is online-first]`

**Consequences (testable):**
- Incomplete (print-failed) Sales cannot be Returned.
- Offline: lookup of server-only history fails clearly; local same-day Sales may still Void (FR-63).

#### FR-65: Full and partial Return
User selects items/qty, reason, and inspects. Partial Return of a multi-line Sale is allowed.

**Consequences (testable):**
- Returned qty cannot exceed original sold qty minus already returned qty.
- Reason is mandatory.

#### FR-66: Inventory decision on Return
Each returned line is resellable (STOCK IN), Damaged Stock, or warranty. `[ASSUMPTION: warranty is “flag + do not restock”; no warranty module]`

**Consequences (testable):**
- Resellable increases sellable Stock.
- Damaged does not increase sellable Stock.
- Warranty does not silently restock.

#### FR-67: Refund Permission
Cashier cannot Refund. Manager and Admin can. Cashier may complete inventory decision and then wait for Refund. Realizes UJ-7.

**Consequences (testable):**
- Cashier-only Refund action is rejected by API, not only hidden in UI.
- Manager Refund of an approved Return succeeds.
- `[ASSUMPTION]` Approval is manager POS PIN (or Account Login) **in-session at the Register** so the customer can be made whole without a Dashboard round-trip. Other Instant Checkout Sales are not blocked while waiting. A Return may be parked if the manager is not present.

#### FR-68: Exchange and Store Credit
User may Exchange (Return + replacement lines) or issue Store Credit instead of cash Refund. Store Credit requires a Customer and is **wave 2C** (FR-70). Wave 2B Returns settle in cash only (or a reverse of the simple paid record in FR-9).

**Consequences (testable):**
- Replacement lines are a **new complete Sale** (FR-9–FR-12) linked to the Return — not a mutant original Sale. STOCK OUT for replacements; STOCK IN/Damaged per FR-66 for returned lines.
- Even exchange: payable may be zero and still requires Receipt success on the replacement Sale.
- Price difference: collect extra (payment) or Refund the difference (FR-67 applies to money out).
- Store Credit without a Customer is rejected; Store Credit UI is out of 2B.

#### FR-69: Return is auditable
Return, inventory decision, Refund, and actor are on an audit trail. Stock Ledger matches the inventory decision.

**Consequences (testable):**
- A Return without a Stock Movement (when restock/damage was chosen) is a test fail.

### 4.12 Customers *(Phase 2C, P0)*

**Description:** CRM was Phase 1 out. Phase 2: profile, history, group, optional Loyalty Account. Cashier search/create/attach. Realizes UJ-9. Dashboard is online-first; attach at Cart Panel must not block Instant Checkout.

#### FR-70: Customer profile
Authorized user can create/edit Customer (contact, notes, group). `[ASSUMPTION: name + one phone or email required; other fields optional]`

**Consequences (testable):**
- Duplicate exact phone warns `[ASSUMPTION: warn, not merge-automatically]`.
- Cashier can create a Customer; cashier cannot delete Customers `[ASSUMPTION]`.

#### FR-71: Attach Customer to Cart Panel
Cashier can search and attach a Customer before Checkout. Sale can complete without a Customer.

**Consequences (testable):**
- Unattached Sale still satisfies FR-9–FR-12.
- Attached Sale appears on that Customer’s history after Sync.

#### FR-72: Purchase history and spend
Dashboard and cashier (view) can see a Customer’s Sales, Returns, and total spending.

**Consequences (testable):**
- History includes synced offline Sales after Sync.
- Cashier cannot see cost/margin on this view.

#### FR-73: Customer groups
Admin can assign a Customer to a group (used later by Promotions).

**Consequences (testable):**
- Group is visible on the Customer.
- Missing group does not block attach or Sale.

#### FR-74: Offline Customer behavior
`[ASSUMPTION]` Cashier may attach a previously cached Customer offline. Creating a new Customer offline queues for Sync. Loyalty (FR-82+) is not applied offline.

**Consequences (testable):**
- Offline Sale without Customer still succeeds (UJ-2).
- Queued create does not block the next Sale.

### 4.13 Cashier Shift *(Phase 2C, P0)*

**Description:** Open → active → close with Expected Cash vs counted drawer. Offline-capable. After 2C, Checkout requires an open Shift (FR-75). Coexists with Day Close (UJ-8, FR-111). Does not replace FR-24. Split tender and Customer-specific price: FR-110, FR-112.

#### FR-75: Open Shift
Cashier opens a Shift with opening cash. `[ASSUMPTION: one open Shift per Register]`

**Consequences (testable):**
- Opening cash is recorded.
- Second open on the same Register is rejected until close.
- **After 2C ships:** Checkout is disabled unless Shift status is open/active. Phase 1 Instant Checkout (no Shift module) is unchanged until this wave. Sales never have `shift_id = null` after 2C.

#### FR-76: Active Shift records
While active, complete Sales, Cash In, Cash Out, and cash Refunds attach to the Shift.

**Consequences (testable):**
- A complete Sale during an open Shift appears in that Shift’s totals.
- Cash In / Cash Out require a reason.

#### FR-77: Cash In / Cash Out
Cashier can record Cash In and Cash Out during an open Shift.

**Consequences (testable):**
- These change Expected Cash and do not change Stock.
- Available offline (durable locally, Sync later).

#### FR-78: Expected Cash
Expected Cash = opening cash + cash Sales + Cash In − Cash Out − cash Refunds − cash Voids.

**Consequences (testable):**
- Formula matches the Shift’s cash-tender complete Sales and movements, including cash Voids (FR-63).
- Non-cash Sales do not inflate Expected Cash.

#### FR-79: Close Shift
Cashier counts the drawer; system shows counted vs Expected Cash vs difference.

**Consequences (testable):**
- Close is possible with a non-zero difference (difference is recorded, not silently forced to zero) `[ASSUMPTION: warn, do not hard-block close]`.
- After close, FR-75 can open a new Shift.

#### FR-80: Shift offline
Open, Cash In / Cash Out, cash count, and close work on Local Database. Realizes UJ-8 edge.

**Consequences (testable):**
- Airplane-mode Shift close persists; Sync uploads Shift on reconnect.
- Shift close does not require FR-24 (that remains Day Close).

#### FR-81: Manager review of Shift
Manager/admin can review closed Shifts and differences on Dashboard (online-first).

**Consequences (testable):**
- Difference and actor are visible.
- Cashier cannot edit another user’s closed Shift.

#### FR-110: Split tender and extra pay methods *(Phase 2C cashier checkout)*
`[ASSUMPTION]` After 2C, cashier may split payment across **cash and Store Credit** (Customer attached). Live card gateway remains out. Physical cash drawer is optional; on-screen count satisfies FR-79.

**Consequences (testable):**
- Split sums must equal payable total to complete Sale.
- Store Credit without Customer is rejected (FR-68).
- Methods other than cash and Store Credit are out until a later decision.

See **FR-111** in §4.4 (Day Close after Shift) — ID is global; behavior lives with Day Close.

#### FR-112: Customer-specific selling price *(Phase 2C)*
When a Customer is attached, Checkout may use that Customer’s selling price (or group price) if configured. Missing override falls back to Store then catalog selling price. Must not block Instant Checkout.

**Consequences (testable):**
- Unattached Sale uses Store/catalog price (FR-34 / FR-106).
- Attached Customer with no override still completes at catalog/Store price.
- Price lookup failure fails open to catalog/Store price, not a blocked Sale.

### 4.14 Loyalty and rewards *(P1; start 2C, complete 2D)*

**Description:** Membership, Points, tiers, earn/redeem. Rules live **once** (shared logic), not copied between Dashboard and Cashier. Realizes UJ-9. Online-first for earn/redeem.

#### FR-82: Loyalty Account
A Customer may have a Loyalty Account (Points, tier).

**Consequences (testable):**
- Attaching a Customer with Loyalty Account shows Points on Cashier when online.
- No Loyalty Account: Sale still completes.

#### FR-83: Earn Points
Complete Sale earns Points per centralized rules.

**Consequences (testable):**
- Same rules fire for Dashboard simulation and Cashier Checkout.
- Offline complete Sale does not invent Points locally; earn happens after Sync when online rules run `[ASSUMPTION]`.

#### FR-84: Redeem rewards
Cashier can redeem a reward / Points when online, reducing payable total or granting the configured reward.

**Consequences (testable):**
- Redeem is refused if Points are insufficient.
- Redeem is auditable on the Loyalty Account.

#### FR-85: Tiers and expiration
Rules may include tiers, expiration, and bonus Points. Admin configures; Cashier does not edit rules.

**Consequences (testable):**
- Cashier PWA has no rule-editor.
- Expired Points cannot be redeemed.

#### FR-86: Loyalty must not block Instant Checkout
If Loyalty service/rules are unavailable, Instant Checkout still completes (skip earn/redeem).

**Consequences (testable):**
- Forced Loyalty failure: FR-9–FR-12 still pass.
- No double-spend of Points `[ASSUMPTION: redeem is online-only to avoid CRDT]`.

### 4.15 Promotions, Coupons, and Vouchers *(Phase 2D, P1)*

**Description:** Conditions → reward. Cashier gets auto discounts, Coupon, Voucher, Loyalty, manager-approved discount. Admin configures campaigns.

#### FR-87: Promotion types
Admin can configure percentage, fixed, buy-X-get-Y, bundle, product/category, customer-group, minimum purchase, happy hour, Coupon, Voucher.

**Consequences (testable):**
- Inactive Promotion does not apply at Checkout.
- Date/time window is honored.

#### FR-88: Shared rule evaluation
Promotion rules evaluate once in shared logic for Cashier and Dashboard.

**Consequences (testable):**
- The same Cart Panel totals the same discount in both surfaces.
- Rules are not reimplemented as Cashier-only special cases.

#### FR-89: Auto-apply and Coupon
Eligible Promotions may auto-apply. Cashier can enter a Coupon code.

**Consequences (testable):**
- Invalid Coupon is a clear error; Sale can proceed without it.
- Stacking policy is explicit `[ASSUMPTION: one Coupon; auto Promotions may combine unless marked exclusive]`.

#### FR-90: Voucher
Cashier can apply a Voucher with remaining value.

**Consequences (testable):**
- Over-tender Voucher leaves remaining value or rounds per rules `[ASSUMPTION: remaining value stored; no cash-out of Voucher in Phase 2]`.
- Used Voucher cannot be reused.

#### FR-91: Manager-approved discount
Cashier cannot apply an arbitrary extra discount; manager/admin can. `[ASSUMPTION: PIN or Dashboard approval]`

**Consequences (testable):**
- Cashier-only extra discount is API-rejected.
- Approved discount appears on Receipt and reports.

#### FR-92: Promotions must not block Instant Checkout
If Promotion evaluation is unavailable, cashier can complete at list price (or last-cached auto rules) `[ASSUMPTION: fail open to list price, not fail closed]`.

**Consequences (testable):**
- Promotion outage does not prevent FR-9–FR-12.
- Offline: cached rules may apply; Coupon that needs server validation is refused clearly.

### 4.16 Reports and analytics *(Phase 2D, P1)*

**Description:** Beyond Phase 1 list + totals (FR-31). Online-first on Dashboard. `[ASSUMPTION: COGS/margin uses product cost field, not FIFO/average costing]`

#### FR-93: Sales analytics
Dashboard shows revenue, transaction count, units, AOV, discount, Refund, net for a date range and Store.

**Consequences (testable):**
- Net accounts for Refunds.
- Cashier-only accounts see a limited version of this view, or none (FR-101).

#### FR-94: Product analytics
Top/slow sellers and margin (selling vs cost).

**Consequences (testable):**
- Inactive products can still appear historically.
- Margin is hidden from cashier-only.

#### FR-95: Inventory analytics
Stock value, movement, Stock Opname variance, dead Stock.

**Consequences (testable):**
- Value uses cost `[ASSUMPTION]`.
- Variance ties to approved Stock Opname ids.

#### FR-96: Cashier performance
Sales and Refunds by cashier / Shift.

**Consequences (testable):**
- A cashier cannot see others’ performance `[ASSUMPTION]`.
- Manager can.

#### FR-97: Financial snapshot
Revenue, COGS, gross profit, tax, fees as recorded. Not a GL. `[ASSUMPTION: tax uses Phase 1 open question default until set; fees optional]`

**Consequences (testable):**
- Snapshot matches summed complete Sales minus Refunds for the period.
- Export is Permission-gated (export action).

### 4.17 Employees and RBAC *(Phase 2D, P1)*

**Description:** Users, roles, Permissions live **only** on Dashboard. API enforces resource × action. Cashier never manages users. Phase 1 FR-32 remains until this wave replaces seeded roles.

#### FR-98: Users on Dashboard
Owner and Admin can create, deactivate, reset password, assign role, and assign Store to users. Store Manager cannot create admins or edit the Permission matrix.

**Consequences (testable):**
- Cashier PWA has no user-create UI; API rejects user-admin from cashier-only tokens.
- Deactivated user cannot Account Login.

#### FR-99: Seeded roles
Roles include Owner, Admin, Store Manager, Supervisor, Cashier, Inventory Staff, Purchasing Staff. Custom roles later OK `[ASSUMPTION: custom roles in 2D are optional, not a gate]`.

**Consequences (testable):**
- Each seeded role can be assigned.
- Only Owner and Admin can open Employees/Access.

#### FR-100: Permission matrix
Permissions are resource × action (view, create, update, delete, approve, export) on products, inventory, purchases, Returns, Customers, reports, users, etc.

**Consequences (testable):**
- Changing a role’s Permissions changes API authorization on next request.
- UI hide/show without API check is not sufficient (test both).

#### FR-101: Default action matrix
Cashier: sell; Void subject to approval; Shift; limited reports. Supervisor: cashier plus Void without waiting on a manager when rules allow `[ASSUMPTION]`; still cannot Refund, perform Stock Adjustment, change price, or manage users. Manager: sell, Void, Refund, Stock Adjustment, price change, reports. Admin: manager + manage users. Owner: go/no-go, not a distinct daily Permission set beyond Admin unless configured. Cashier cannot Refund, adjust Stock, or change price.

**Consequences (testable):**
- Cashier Refund → API deny (FR-67).
- Manager Refund → API allow.
- Supervisor Refund → API deny.

#### FR-102: Cashier uses signed-in Permissions
Cashier PWA uses the signed-in user’s Permissions for sell, Void, Shift. No local “become manager” without Account Login of a permitted user.

**Consequences (testable):**
- POS PIN does not grant extra Permissions beyond the Account Login user.
- Manager PIN for Void `[ASSUMPTION]` is an approval, not a role rewrite on the cashier user.

#### FR-103: Phase 1 role migration
`[ASSUMPTION]` Existing `cashier` / `catalog_admin` map to Cashier and Admin (or Store Manager) at 2D rollout; FR-32 tests still pass after mapping.

**Consequences (testable):**
- Pre-2D cashier-only accounts still cannot edit catalog.
- Pre-2D catalog_admin can still edit catalog.

### 4.18 Multi-Store and Stock Transfer *(Phase 2D, P1)*

**Description:** Activates Phase 1 tenancy stub: company → Stores → Registers, per-Store Stock, store pricing, store reports, Stock Transfer. **Not** part of Instant Checkout. Cross-Store offline Sync is out.

#### FR-104: Stores and Registers
Admin can define Stores and Registers. Phase 1 is one implicit Store (tenancy stub); 2D activates additional Stores. Phase 1 data becomes Store #1.

**Consequences (testable):**
- Cashier session is bound to one Store + Register.
- Instant Checkout does not ask the cashier to pick a Store per line item.
- A Phase 1 deployment has exactly one Store record (even if the UI never showed it).

#### FR-105: Store-level Stock
Stock Ledger is per Store. Sale at Store A does not decrement Store B.

**Consequences (testable):**
- Stock Overview can filter by Store.
- Sync of an offline Sale posts to the cashier’s Store.

#### FR-106: Store-specific selling price
Admin may override selling price per Store. Cashier Menu uses that Store’s price after catalog refresh.

**Consequences (testable):**
- Store A and Store B can differ on the same SKU.
- Missing override falls back to catalog selling price.

#### FR-107: Stock Transfer lifecycle
Statuses: Draft → Requested → Approved → Preparing → Shipped → Received → Completed.

**Consequences (testable):**
- Invalid skips rejected.
- Stock does not leave Store A until Shipped. Between Shipped and Received, qty is **in-transit**: not sellable at A or B (does not appear as sellable Stock on either Store).
- Received posts STOCK IN at Store B. `[ASSUMPTION: OUT at Shipped, IN at Received; in-transit is a ledger state, not a third Store]`

#### FR-108: Stock Transfer posts ledger
Shipped/Received post Store A → Store B Stock Movements. Both sides auditable.

**Consequences (testable):**
- Completed transfer: A decreased, B increased by the same qty.
- Rejected Draft: no Stock change.

#### FR-109: Multi-Store must not enter Checkout
Media Provider, Dashboard, and multi-Store are not part of cashier Checkout. Cross-Store offline Sync is not a Phase 2 gate.

**Consequences (testable):**
- Instant Checkout path has no required Store-picker beyond the signed-in Register.
- FR-21 drill still passes on one Store after 2D ships.

## 5. Non-Goals (Explicit)

**Still true for Phase 1 success (do not gate Phase 1 on these):**
- SaaS subscription / MRR growth
- Multi-Store as a Phase 1 requirement
- Promotions, Loyalty, Suppliers, full Returns as Phase 1 requirements

**Out of this PRD entirely (P2+ / never-ERP):**
- Kitchen Display / bar tickets
- Warehouse app, owner mobile app as a required app, customer app, self-checkout
- Live card payment gateway / offline card authorization (unless a later decision reopens FR-9)
- CRDT / multi-cashier / cross-Store offline conflict perfection
- Public API, marketplace, accounting/GL integrations, payroll
- Becoming an ERP, accounting system, manufacturing system, or CMS
- Required Background Worker app
- Warranty management module (flag only, FR-66)
- Recipe/ingredient depletion, production batches, 3-way invoice match, bin locations, serial/batch/expiry

**Not a Phase 2 feel:** “all-in-one business system.” Two surfaces: Cashier vs Dashboard.

## 6. Scope by phase and wave

Do not ship Phase 2 as one giant release. Waves are delivery order, not an excuse to rewrite Instant Checkout.

### 6.1 Phase 1 (locked)

- Single coffee shop
- Cashier web/PWA: Account Login + POS PIN, Instant Checkout, Offline Mode, Day Close
- Thin Dashboard: products, prices, Stock, sales list/totals
- FR-1 through FR-32
- Offline acceptance drill (FR-21)
- Receipt print path as part of Sale success (FR-10–FR-12)

### 6.2 Phase 2A — Product and inventory (P0)

- FR-33–FR-54 (catalog, Product Media, Stock Ledger, Stock Opname)
- Images in Dashboard and Cashier; Media Provider isolated from transaction path

### 6.3 Phase 2B — Purchasing and Returns (P0)

- FR-55–FR-67, FR-69 (Suppliers, Purchase Order, Goods Receipt, hold, Void, Return, cash Refund)
- Store Credit waits for 2C (FR-68 remainder / FR-70); 2B Exchange still settles in cash
- Until 2D RBAC, `catalog_admin` is the approver identity for Purchase Order / Stock Opname / Refund / price `[ASSUMPTION]`

### 6.4 Phase 2C — Customers and cashier operations (P0)

- FR-70–FR-81, FR-110, FR-111, FR-112
- Shift required for Checkout; Day Close per Register
- **2C is done without Loyalty.** FR-82–FR-86 are P1 and must not gate SM-9
- Store Credit (FR-68 remainder) lands here with Customers

### 6.5 Phase 2D — Growth and management (P1)

- FR-87–FR-109 (Promotions, reports, RBAC, multi-Store, Stock Transfer)
- Custom roles optional, not a gate

### 6.6 Out of scope for this PRD

- Everything in §5 “out of this PRD entirely”
- Drink modifiers / size matrix beyond Variants `[ASSUMPTION: Variants cover size; complex modifier matrix still out]`
- Offline Dashboard receiving / Supplier flows
- Count-on-POS Stock Opname (FR-54)

## 7. Success Metrics

**Phase 1 primary (unchanged)**
- **SM-1:** UJ-1 completes end-to-end (Account Login → complete Sale with Receipt → Stock update online). Validates FR-1–FR-12, FR-28–FR-30.
- **SM-2:** Offline drill passes with zero lost complete Sales; Sync updates Stock/Dashboard. Validates FR-14–FR-21. **Re-run after Phase 2A media.** Acceptance owners: Dewi (Cashier) and Sari (Store manager).
- **SM-3:** Day Close produces Today’s Sales Report and returns to Account Login with FR-24 satisfied. Validates FR-22–FR-27.

**Phase 1 secondary (unchanged)**
- **SM-4:** Native-feel — Local Database path meets latency ASSUMPTION targets (§4.2 NFR).
- **SM-5:** Portfolio/demo ready — presenter can run UJ-1 and UJ-2 on PWA without changing the story mid-demo.

**Phase 2 primary**
- **SM-6:** Stock Ledger is accurate; Stock Opname approve updates Stock (UJ-5). Validates FR-44–FR-53.
- **SM-7:** Purchase Order → Goods Receipt → Stock IN (UJ-6). Validates FR-55–FR-60.
- **SM-8:** Return → inventory decision → Refund (UJ-7); cashier cannot Refund. Validates FR-64–FR-69.
- **SM-9:** Shift Expected Cash vs counted drawer is recorded (UJ-8); Day Close still enforces FR-24. Validates FR-75–FR-80, FR-111.
- **SM-10:** Product Media visible on Dashboard and Cashier; Media Provider outage does not block Instant Checkout; no orphaned media after delete. Validates FR-39–FR-43. **SM-2 still passes.**

**Phase 2 secondary (2C–2D)**
- **SM-11:** Customer history exists for attached Sales (UJ-9). Validates FR-70–FR-72.
- **SM-12:** Promotions apply per shared rules; Loyalty Points calculate per shared rules; Instant Checkout still works if either is down. Validates FR-82–FR-92.
- **SM-13:** RBAC managed on Dashboard; API denies cashier Refund / user-admin. Validates FR-98–FR-102.
- **SM-14:** Two Stores: independent Stock; Stock Transfer completes ledger-correct. Validates FR-104–FR-108.

**Counter-metrics (do not optimize)**
- **SM-C1:** Subscription count / MRR — must not gate Phase 1 (still).
- **SM-C2:** Feature breadth that delays Instant Checkout + Offline Mode — still forbidden in Phase 1; Phase 2 waves exist so 2D cannot delay 2A.
- **SM-C3:** ERP completeness (GL, warehouse, recipe costing, public API) — counterbalances SM-6–SM-14.
- **SM-C4:** Checkout latency / offline drill regressions after images or Promotions — counterbalances SM-10 and SM-12.
- **SM-C5:** Media Provider uptime as a checkout dependency — any design that makes SM-1 require Cloudinary fails this counter-metric.

## 8. Cross-Cutting NFRs

- **Quantity truth:** Until Sync succeeds, the cashier’s Local Database is source of truth for that device’s complete Sales (cashier-facing). After Sync, the Stock Ledger is server source of truth. Dashboard must not treat an unsynced complete Sale as “not real.”
- **Reliability:** No silent loss of offline complete Sales (FR-16, FR-19). Phase 2 modules must not introduce a new silent-drop path.
- **Performance:** Instant Checkout latency ASSUMPTIONs on Local Database path (§4.2). Phase 2A+ must re-measure SM-4.
- **Platform:** Cashier is **web/PWA**. Dashboard is web. Native shell is only a contingency if the chosen device cannot meet FR-10 or FR-14 on PWA.
- **Receipt output:** Phase 1 demo accepts (a) device/browser print or (b) on-screen Receipt confirm. Physical ESC/POS remains an Open Question.
- **Security:** Passwords and POS PIN not logged in plaintext. Phase 1: FR-32. Phase 2D: API-enforced RBAC (FR-100).
- **Two-surface discipline:** Sell path stays on Cashier; run-the-business stays on Dashboard.
- **Media isolation:** Media Provider is infrastructure, not transaction infrastructure. After catalog refresh, Cashier Menu, Checkout, payment, Receipt, and Sync must not require a live Media Provider call (FR-41).
- **Offline split:** Cashier: search, cart, Checkout, payment record, Receipt, hold, Void, Shift. Dashboard: receiving, Purchase Orders, Suppliers, products, Customers, reports, Promotions — online-first.
- **Audit:** Stock Movements, Returns, Refunds, Shift differences, RBAC changes, Day Close unsynced acknowledgements are attributable.
- **Centralized rules:** Loyalty and Promotion logic is shared; not duplicated per app.

## 9. Guardrails

- Do not rewrite Instant Checkout or Offline Mode to “make room” for operations.
- Do not put Media Provider on Cashier Menu after the first successful catalog refresh (placeholders are allowed; blocked add-to-cart is not).
- Do not put Admin or multi-Store into cashier Checkout.
- Do not treat Phase 2 success as SaaS tenant count.
- Do not ship 2D Promotions/RBAC/multi-Store as a prerequisite for 2A Stock Ledger.
- Do not require CRDT to close Phase 2.

## 10. Open Questions

1. Target tablet + Receipt printer for production-feel demos? (browser print / on-screen Receipt OK for SM-1 until chosen)
2. Tax inclusive/exclusive for prices (target market)? One tax profile per Store is assumed when tax is set; not a Phase 1 UI.
3. Hold/park: device-local only (FR-62 assumption) vs shared Register queue?
4. Store Credit expiry and partial redeem rules?
5. First 2D tenant timing: when does Store #2 go live relative to 2A–2C in production? Owner (Andi) is go/no-go.

**Resolved this finalize:**
- Approvers: Store Manager or Admin (until 2D, `catalog_admin`). Owner is wave go/no-go, not daily approver.
- 2C hardware: on-screen cash count; physical drawer optional. `[ASSUMPTION]`
- 2C tenders: cash + Store Credit only. `[ASSUMPTION]`
- After 2C, Checkout requires an open Shift.

`[NOTE FOR PM]` Revisit money-path assumptions (Shift gate, Void→cash, Refund PIN-in-session, drawer optional) before scheduling 2B/2C epics — they are decided here for story-readiness, not because a live shop confirmed them.

**Resolved vs Phase 1 OQ:** Vision docs stayed retail-first; this PRD keeps coffee-shop Phase 1 journeys and treats Phase 2 as retail operations without KDS. Void / hold / Returns are Phase 2B, not a Phase 1 rewrite. CSV/deep analytics wait for FR-93+. Conflict-report UI (product-scope Phase 1 IN) stays deferred — retry + indicator in Phase 1; not CRDT.

## 11. Assumptions Index

**Phase 1 (unchanged)**
- FR-5: Offline POS PIN after prior Account Login on device
- FR-9: Payment = cash / simple paid record; no live card gateway
- FR-13: Cart Panel qty/remove before Checkout
- §4.2 NFR: search &lt;100ms, add &lt;50ms, checkout &lt;300ms on Local Database
- FR-20: Sync indicator visible; complete Sale remains success
- FR-24: Hard block finish Day Close until Sync=0 or explicit acknowledge
- FR-31: Dashboard list + totals, not charts (Phase 1)
- FR-32: Catalog role vs cashier-only until 2D
- §6.6: Simple product list (no complex modifiers) for Phase 1
- §8: PWA first; Receipt may be browser print or on-screen confirm until hardware chosen

**Phase 2 (Fast path — confirm on review)**
- Domain: Phase 1 stays coffee-shop journeys; Phase 2 is retail ops, no KDS
- Day Close and Shift coexist; open Shift blocks Day Close finish (FR-111)
- Full Phase 2 P0+P1 in this PRD; waves are delivery order; multi-Store not in Checkout
- Media Provider is Cloudinary (addendum)
- SKU unique per company
- Phase 2A one-Store pricing; store-specific price in 2D
- Non-tracked products can sell; oversell warned not hard-blocked
- Stock Opname approved by manager/admin; no count-on-POS
- PO / Stock Opname / Stock Transfer approved by Store Manager or Admin; Owner is wave go/no-go
- Supervisor = enhanced cashier; cannot Refund / adjust Stock / change price / manage users
- Customer-specific price (FR-112) fails open to Store/catalog price
- Until Sync, Local Database is cashier SoT; after Sync, Stock Ledger is server SoT
- Hold/park is device-local
- Cashier Void needs manager approval; Refund is manager/admin only
- Return lookup online-first; warranty = flag, no module
- Store Credit requires Customer; no Voucher cash-out
- Customer: name + phone or email; warn on duplicate phone; cashier cannot delete
- Offline: cached Customer attach OK; new Customer queued; Loyalty not applied offline
- After 2C, Checkout requires an open Shift; Sales always have a Shift
- 2C tenders: cash + Store Credit; on-screen count; physical drawer optional
- Until 2D, `catalog_admin` is the approve identity
- 2C P0 is done without Loyalty
- In-transit Stock between Shipped and Received
- Sync is idempotent on local Sale id
- Exchange replacement is a new complete Sale
- Refund approval is in-session manager PIN; Return may be parked
- Loyalty earn after Sync for offline Sales; redeem online-only
- Promotion fail-open to list price; one Coupon; auto Promotions combinable unless exclusive
- Reports COGS = product cost field, not FIFO
- Cashier cannot see others’ performance or margin
- Custom RBAC roles optional in 2D; Phase 1 roles map cashier → Cashier, catalog_admin → Admin
- Manager PIN is approval, not a role change
- Stock Transfer: OUT at Shipped, IN at Received
- Split tender in 2C; live card still out
- Dashboard warns (does not hard-block) publish without primary image
- Variants cover size; complex modifier matrix still out
- Loyalty 2C = happy path; richer Admin rules may finish in 2D
