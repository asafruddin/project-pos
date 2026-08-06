# Reconcile: Vision → PRD Gap Analysis

| Field | Value |
| --- | --- |
| Input | `docs/01-business/vision.md` (v1.2) |
| PRD | `prd-pos-apps-2026-08-05/prd.md` |
| Addendum | none (folder contains only `prd.md` + `.memlog.md`) |
| Date | 2026-08-05 |
| Focus | Qualitative ideas, IN/OUT, Offline Mode, Instant Checkout, metrics, domain (retail vs coffee shop), intentional PRD overrides |

---

## 1. Extract — Vision (what the input asserts)

### 1.1 North star & Phase 1 framing

- Long-term: scalable, offline-first POS **platform** (SaaS-capable, multi-app monorepo).
- Phase 1: prove **one retail store** can sell all day with **Instant Checkout + Offline Mode** (co-equal pillars).
- Phase 1 win: cashier prefers the system to notebook/spreadsheet for a **full store week**, including hours with no internet — not monorepo/module completeness.
- **Domain boundary:** retail-first; Kitchen Display / F&B-specific flows are **future options, not Phase 1 drivers**.

### 1.2 Jobs to Be Done (vision)

| Actor | Job (vision) |
| --- | --- |
| Cashier | Fast close; recover wrong item/qty; sell when Wi‑Fi dies; cash drawer matches at EOD |
| Store Manager | What sold / what’s low; cashiers cannot silently void (manager PIN / logged overrides) |
| Business Owner | Money in/out without ERP; second branch later without rewrite |
| Accountant | Clean daily sales export for bookkeeping/tax |
| Administrator | Onboard cashier in minutes |
| Indirect customer | Leave line quickly with correct price |

Phase 1 JTBD pack: sell (online/offline) → payment → receipt → stock by sale → day close → pending sync / reconnect without losing work.

### 1.3 Instant Checkout (vision crown jewel)

- Zero-latency local catalog cache
- Keyboard-first (mouse optional); numeric qty, +/−, void line, hold sale
- Local commit first, sync second (checkout must not block on network)
- Receipt reprint by sale id
- Manager PIN override for wrong price / voids, always logged
- Optimistic stock decrement with conflict report later
- Latency targets: search &lt;100ms, add to cart &lt;50ms, checkout &lt;300ms

### 1.4 Offline Mode (vision Phase 1 capability)

Named Cashier feature, not implementation detail.

**Must work offline:**

- Local product catalog (prefetched/cached)
- Cart, checkout, payment (cash + recorded non-cash that don’t need live auth — or clearly blocked)
- Durable local outbox (never silently drop)
- Receipt print and/or on-device digital receipt from local data
- Same-day void / hold sale under same role rules
- Always-visible connectivity + **pending sync count**
- Auto-sync on reconnect; clear success / **conflict feedback**
- Day close includes local + already-synced sales for that store day

**Explicitly later:** CRDT/multi-device perfection; offline Admin/receiving; offline card auth; cross-branch catalog sync while offline.

### 1.5 Phase 1 IN (vision)

- Auth (cashier / manager roles; session usable offline after online login)
- Products CRUD → catalog download/cache
- Cart, checkout, payment record (cash + one simple card/other method recording)
- Receipt (print and/or digital)
- Basic stock qty (local decrement; reconcile on sync)
- Offline Mode (catalog, durable outbox, sync status, reconnect sync)
- Day close / sales list + totals (**CSV export acceptable**)
- Store entity (single store; tenancy stub)
- Risk spikes: offline outbox + reconnect UX + ESC/POS (or target-device) printing / scanner proof

### 1.6 Phase 1 OUT (vision)

- Multi-branch as launch requirement
- Promotions / loyalty
- Full returns (same-day void only)
- Suppliers
- Deep analytics
- Required Background Worker
- KDS, warehouse, public API, marketplace
- Multi-currency / multi-tax SaaS surface
- Deep RBAC / employees / CRM
- Shared packages before second consumer
- Advanced offline sync beyond durable outbox + clear conflict report

### 1.7 Success metrics (vision)

**Phase 1 (store-day):**

- Zero lost sales (including offline / airplane-mode drill)
- Full Instant Checkout loop with network off
- Checkout feels &lt;300ms on target device (local path)
- Pending sync visible; reconnect drains outbox without cashier heroics
- Day close cash matches (local + synced)
- Cashier prefers system to notebook after **one week**
- Printer / scanner path proven on target hardware

**Long-term (platform):** Lighthouse 95+, multi-cashier offline hardened, 100% TS, load/nav targets, DX, multi-branch / payments / currencies / tax — not Phase 1 gates.

### 1.8 Qualitative / architectural stance (vision)

- Monorepo allowed; ship Cashier + API first; Admin thin (feeds Instant Checkout)
- Device is source of truth for in-flight sales until sync ack
- Prefer hand DTOs until domain stabilizes
- Hardware (printers, drawers, scanners, tablets) first-class
- PWA first; native shell if PWA hardware/offline proves insufficient
- Worker deferred; type safety / shared logic as long-term principles

---

## 2. Extract — PRD (what Phase 1 currently specifies)

### 2.1 Framing & intentional domain override

- Phase 1 = **coffee-shop / cafe** Instant Checkout + Offline Mode for **demo / portfolio / optional live pilot**.
- Website that feels native; **not** judged by SaaS subscription / MRR.
- Explicit note: earlier vision said retail-first; **PRD reframes pilot as coffee shop** (cart ring-up; no kitchen tickets). Open Q #4: should vision.md be updated?

### 2.2 Users & journeys

- Primary: barista-cashier (Dewi); light manager/owner; **builder / demo presenter** (PRD-only persona).
- UJ-1 sell + print; UJ-2 offline sell + Sync; UJ-3 Day Close → Today’s Sales Report → Account Login.
- Non-users: warehouse, multi-branch ops, KDS operators, “paying SaaS tenant growth” audience.

### 2.3 Instant Checkout (PRD)

- Cashier Menu → Cart Panel → Checkout → payment → Receipt → Stock/Dashboard.
- FR-6–FR-13: select, cart with prices, checkout, payment record, print receipt, stock after successful online sale, print-failure must not silently update stock, edit cart before checkout.
- Latency ASSUMPTIONs match vision (&lt;100 / &lt;50 / &lt;300ms) on Local Database path.
- Payment ASSUMPTION: cash and/or simple “paid” record; live card gateway out.

### 2.4 Offline Mode (PRD)

- FR-14–FR-21: full sell loop on Local Database; Sale = success offline; durable persistence; Sync on reconnect; Stock/Dashboard after Sync; retry without blocking; Sync status indicator (must not re-label Sale incomplete); offline acceptance drill.
- Out: CRDT, offline Dashboard admin, live card auth offline.

### 2.5 Auth / Day Close / Dashboard (PRD)

- Two-step: Account Login + 6-digit POS PIN; offline POS PIN after prior login (ASSUMPTION).
- Day Close: totals, cash, Sync check; **warn if Sync incomplete**; Today’s Sales Report; confirm → Account Login.
- Thin Dashboard: products/prices/stock, sales list/totals, role split for catalog.

### 2.6 Explicit PRD OUT (MVP)

- §5 non-goals align largely with vision OUT + SaaS MRR as success criterion.
- Additionally deferred in §6.2: **manager void/override PIN flows**; drink modifiers / size matrix beyond simple products.

### 2.7 Success metrics (PRD)

- SM-1…SM-3: demo UJ-1, offline drill zero lost sales, Day Close report path.
- SM-4…SM-5: latency ASSUMPTION / portfolio readiness.
- Counter-metrics: do not optimize MRR or feature breadth.

---

## 3. Intentional PRD overrides of vision

These are **coaching / PRD decisions**, not accidental omissions. Treat as accepted unless product reverses them.

| # | Vision said | PRD override | Implication |
| --- | --- | --- | --- |
| O1 | Retail-first; F&B/KDS not Phase 1 drivers | Phase 1 pilot = **coffee shop** (still no KDS) | Domain language, personas (barista), catalog assumptions shift; vision sync called out as open Q |
| O2 | Phase 1 win = **1 week real store use**, cashier prefers vs notebook | Phase 1 judged by **demo/portfolio (+ optional live pilot)**; UJ + offline drill + Day Close | Softens “store-week preference” and “cash drawer matches” as hard gates |
| O3 | SaaS-capable platform north star (long-term) | SaaS subscription / MRR **explicit Phase 1 non-goal / counter-metric** | Aligns with vision’s “not when monorepo complete” but goes further: growth is anti-metric |
| O4 | Cashier/manager roles; manager PIN for voids/wrong price | **Account Login + POS PIN**; manager override PIN **deferred** | Stronger gate UX for demo; weaker trust/control JTBD from vision manager |
| O5 | Receipt print **and/or digital**; reprint by sale id | Print path central to UJ-1; **print failure ↔ Stock** coupling (FR-12); no reprint FR | Digital receipt / reprint deferred; new stock-print integrity rule |
| O6 | Payment: cash + one simple card/other **recording** | Cash / simple “paid”; live gateway out (aligned); card recording less emphasized | Compatible; wording narrower |
| O7 | Success includes scanner path proven | Hardware acceptance = Receipt print on demo device(s); scanner not FR’d | Scanner/barcode wedge de-emphasized for coffee-shop menu UI |

---

## 4. Gap analysis

Legend: **Gap** = vision idea missing or weakened in PRD · **Partial** = present but thinner · **Aligned** · **PRD-only** = PRD adds beyond vision · **Override** = intentional (see §3)

### 4.1 Domain (retail vs coffee shop)

| Item | Status | Notes |
| --- | --- | --- |
| Retail-first Phase 1 | **Override (O1)** | Vision boundary vs PRD coffee-shop pilot; docs diverge until vision updated |
| No KDS in Phase 1 | **Aligned** | Both keep kitchen/bar tickets out |
| Coffee-shop catalog (sizes/modifiers) | **PRD open Q / ASSUMPTION** | Vision didn’t specify; PRD assumes simple products |

### 4.2 Instant Checkout

| Vision idea | Status | Notes |
| --- | --- | --- |
| Local catalog / zero-latency cache | **Aligned** (via Local Database + catalog feed) | |
| Latency &lt;100/&lt;50/&lt;300ms | **Aligned** | PRD marks ASSUMPTION |
| Local commit first, sync second | **Aligned** | Offline Sale = success; Sync separate |
| Edit/recover wrong qty before pay | **Partial** | FR-13 cart edit; no post-line void-with-manager during/after |
| Keyboard-first / shortcuts | **Gap** | Vision UX principle; no FR / NFR |
| Hold / park sale | **Gap** | Vision Instant Checkout + Offline must-work; absent from PRD |
| Void line + manager PIN (logged) | **Override / Gap (O4)** | Explicitly OUT in PRD §6.2 |
| Receipt reprint by sale id | **Gap** | Vision Instant Checkout; not in PRD |
| Optimistic stock + conflict report later | **Partial** | Stock after Sync/online; **conflict report** not FR’d (vision Offline + Instant Checkout) |
| Barcode / scanner wedge | **Gap** (softened by O7) | Vision Cashier Phase 1 + hardware risk spike |
| Print failure must not silently update Stock | **PRD-only** | Stronger than vision; good integrity rule |

### 4.3 Offline Mode

| Vision idea | Status | Notes |
| --- | --- | --- |
| Full sell loop offline | **Aligned** | FR-14–FR-16, FR-21 |
| Durable outbox / no silent drop | **Aligned** | FR-16, FR-19; Reliability NFR |
| Connectivity + pending sync **count** | **Partial** | FR-20 status / “waiting to upload”; **count** not required |
| Conflict / rejection feedback on sync | **Gap** | Vision API + Offline must-have; PRD Sync retry only |
| Same-day void / hold offline under role rules | **Gap** | Deferred with manager PIN (O4) + no hold |
| Digital receipt from local data | **Gap / Partial** | Print emphasized; on-device digital not specified |
| Day close includes local + synced | **Partial** | FR-23 Sync status + warn; cash match as metric weaker than vision |
| Offline Admin / CRDT / offline card auth OUT | **Aligned** | |

### 4.4 IN / OUT inventory

| Vision Phase 1 IN | In PRD? | Notes |
| --- | --- | --- |
| Cashier + manager roles | **Partial** | FR-32 catalog role vs cashier; not manager-void role |
| Products CRUD → catalog cache | **Yes** | FR-28–FR-29 |
| Cart / checkout / payment record | **Yes** | FR-6–FR-9 |
| Receipt print and/or digital | **Partial** | Print yes; digital no |
| Basic stock | **Yes** | FR-11, FR-18, FR-30 |
| Offline Mode | **Yes** | §4.3 |
| Day close + sales list/totals | **Yes** | §4.4, FR-31 |
| CSV export | **Gap** | Vision “CSV acceptable”; PRD report UI only |
| Store entity / tenancy stub | **Gap** | Implicit single shop; no entity/stub called out |
| ESC/POS / printer proof | **Yes** (ASSUMPTION matrix TBD) | §8 Hardware |
| Scanner proof | **Gap** | |

| Vision Phase 1 OUT | PRD? | Notes |
| --- | --- | --- |
| Multi-branch, promos, loyalty, suppliers, analytics suite, Worker, KDS, public API, marketplace, multi-currency/tax, deep RBAC, CRM, CRDT | **Aligned OUT** | §5 |
| Full returns | **Aligned OUT** | |
| Same-day void only (until ledger trustworthy) | **Conflict** | Vision IN as same-day void; PRD defers manager void entirely |

### 4.5 Metrics

| Vision Phase 1 metric | PRD | Status |
| --- | --- | --- |
| Zero lost sales + offline drill | SM-2 / FR-21 | **Aligned** |
| Full offline Instant Checkout loop | SM-2 | **Aligned** |
| Checkout &lt;300ms local | SM-4 | **Aligned** (ASSUMPTION) |
| Pending sync visible; reconnect drains queue | FR-20, FR-17–19 | **Partial** (no count / conflict UX metric) |
| Day close **cash matches** (local + synced) | SM-3 = report path + Sync warn | **Gap / Partial** — report completeness ≠ cash reconciliation gate |
| Cashier prefers vs notebook after **1 week** | — | **Override (O2)** — replaced by demo/portfolio SMs |
| Printer / scanner proven | Print in UJ-1 acceptance | **Partial** (print yes; scanner no) |
| SaaS/MRR growth | SM-C1 counter-metric | **Aligned** with “not Phase 1 win”; stronger anti-goal |

Long-term vision metrics (Lighthouse, multi-branch, etc.): correctly out of PRD Phase 1 — **Aligned** (deferred).

### 4.6 Qualitative ideas & JTBD not carried forward

| Idea | Status |
| --- | --- |
| Platform / monorepo / shared packages / type-safety spine | **Absent from PRD** (OK if architecture doc owns; not Phase 1 product FRs) |
| Device as source of truth until sync ack | **Aligned** in spirit (Sale = success offline) |
| Accountant clean daily export | **Gap** (CSV / export path) |
| Admin onboard cashier in minutes | **Gap** (no onboarding FR) |
| Owner “second branch without rewrite” migration path | **Partial** — multi-branch OUT; no tenancy stub |
| Manager trust: logged overrides / cannot silent void | **Gap** (O4) |
| Builder / demo presenter audience | **PRD-only** |
| Dual Account Login + POS PIN | **PRD-only** (beyond vision’s role auth) |

### 4.7 PRD open questions that touch vision gaps

1. Printer / tablet matrix — affects hardware acceptance (vision risk spike).
2. Drink catalog shape — coffee-shop override vs simple products.
3. Tax inclusive/exclusive — vision assumed one tax profile; PRD unsettled for cafe.
4. **Update vision.md retail → coffee-shop?** — documents currently inconsistent by design until answered.

---

## 5. Priority gap shortlist (for follow-up)

Highest-signal items if reconciling vision ↔ PRD without undoing intentional overrides:

1. **Domain doc sync (O1):** Update vision Phase 1 language to coffee-shop pilot *or* keep retail and mark PRD as temporary demo domain — resolve open Q #4.
2. **Manager void / logged override + same-day void:** Vision Phase 1 IN and Offline must-work; PRD explicitly deferred — confirm keep override or restore thin FR.
3. **Hold/park sale + receipt reprint:** Vision Instant Checkout crown features with no PRD FR.
4. **Sync conflict / rejection feedback + pending sync count:** Vision Offline Mode bar; PRD only has status + retry.
5. **Day-close cash reconciliation metric + CSV/export:** Vision success + accountant JTBD thinner in PRD (report + warn only).
6. **Keyboard-first / scanner:** Vision cashier UX + hardware proof; PRD menu-first coffee UI.

---

## 6. Summary verdict

PRD **preserves** the vision’s two crown jewels (Instant Checkout + Offline Mode), single-shop scope, thin admin, and most Phase 1 OUTs. It **intentionally overrides** retail → coffee-shop pilot and store-week preference → demo/portfolio success. Material **gaps** vs vision (if not accepted as overrides) cluster around: manager void/hold/reprint, sync conflict feedback, cash-match/export metrics, keyboard/scanner hardware, and domain-doc consistency.
