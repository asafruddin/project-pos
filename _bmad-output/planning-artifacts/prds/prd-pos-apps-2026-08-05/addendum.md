# Addendum — POS Apps Phase 1 + Phase 2 PRD

Companion to `prd.md`. Holds deferred depth, mechanism, and intentional cuts. Not a substitute for the PRD.

## Intentional overrides of `docs/01-business/`

| Input said | PRD says | Why |
|------------|----------|-----|
| Retail-first | Phase 1 journeys remain coffee-shop pilot; Phase 2 is retail operations, no KDS | Phase 1 coaching decision kept; vision docs stayed retail-first |
| Phase 1 Cashier already has void + hold/park | Void + hold are Phase 2B FRs (FR-62–FR-63); not a rewrite of FR-1–32 | Locked Phase 1 PRD deferred them |
| Same-day void + manager PIN in Phase 1 | Phase 2B | Not in UJ-1–3 |
| Cloudinary as a named module in the PRD spine | PRD capability = Product Media / Media Provider; Cloudinary named here | Tech/vendor belongs in addendum; isolation rules stay in PRD |
| 1-week live pilot preference gate | Phase 1 demo/portfolio gates (SM-1–3) | Coaching: Phase 1 judged on Instant Checkout + Offline Mode demo, not a live-week preference KPI; not because of SaaS |
| CSV export as Phase 1 | FR-31 list + totals; export Permission in 2D reports | Thin Admin in Phase 1 |
| Keyboard/scanner first-class | Not required for Phase 1 demo | Coffee-shop tap UI primary |
| Loyalty listed as both 2C deliverable and P1/2D | PRD: 2C happy path (attach/earn/redeem); rule richness may finish 2D | Source listed both waves |
| API path list / DB tables / Cloudinary folder convention | Architecture, not FRs | See mechanism notes |
| Conflict report as Phase 1 IN (product-scope) | Phase 1: retry + Sync indicator (FR-19–FR-20); conflict-report UI deferred | Locked Phase 1 PRD; not CRDT |
| Hardware print/scanner as Phase 1 done-gate | Browser print / on-screen Receipt OK for SM-1 | Locked Phase 1 platform decision |
| Day-close cash physical match | SM-3 = report shown + confirm; Shift SM-9 records difference (may be non-zero) | Physical drawer ritual deferred |
| Three pillars Cashier / Operations / Management | Two surfaces: Cashier vs Dashboard (ops + management on Dashboard by wave) | Avoid a third app in Phase 2 |
| Independent modules + type-safe contracts as success criteria | Architecture bar in this addendum, not SM-* | Platform craft, not cashier-facing done |

## Media Provider (Cloudinary)

Phase 2 source names **Cloudinary** as the asset/media layer. Product records and image **references** stay in the POS database.

- Upload path: Dashboard → POS API (auth, validation, Permissions) → Cloudinary → metadata in POS DB (`public_id`, `secure_url`, dimensions, format, bytes, alt, sort, primary).
- Delivery: dynamic transforms + CDN (`q_auto`, `f_auto`); do not store separate 150/400/800px files.
- Folder convention (ops, not FR): `pos/products/{id}/`, `categories/`, `brands/`, `promotions/`, `stores/`.
- Lifecycle: upload + DB insert; reorder/set-primary = DB only; delete = Cloudinary delete + DB delete; retry if provider delete fails (orphan prevention).
- Isolation: `MediaService` only. Checkout, payment, Receipt, Sync must not call Cloudinary. Product module must not talk to Cloudinary from Instant Checkout.

## Mechanism notes (architecture — not PRD FRs)

- Local Database + Sync upload queue remains the Offline Mode mechanism; CRDT out of scope.
- Receipt may be browser print or ESC/POS once hardware matrix is chosen (Open Question in PRD).
- Phase 2 cashier durable events that Sync must carry besides Sales: Shift open/close, Cash In / Cash Out, same-day Void, queued Customer creates. Returns/Loyalty redeem are online-first unless a later decision says otherwise.
- Stock Ledger is the quantity source of truth after 2A; Phase 1 qty field becomes a projection.
- Purchase Order invoice/payment is status + reference, not AP/GL.
- Reports COGS uses product cost field (not FIFO/average) until a costing decision is made.
- Suggested domain modules (independent, reusable): Inventory, Orders, Products, Customers, Reports, Payments, Promotions; plus Stores, users/roles/Permissions, Shifts. Type-safe API/domain contracts are an architecture bar, not a PRD SM.
- Wave 2A should accept ledger event types for Goods Receipt and Stock Transfer in the model even if 2B/2D UI is not shipped.
- Until Sync ack, device Local Database is source of truth for that cashier’s complete Sales; Stock Ledger is server truth after Sync.

## Phase 2 offline split (from source)

| Mode | Surface |
|------|---------|
| Offline-capable | Cashier: search, cart, Checkout, payment record, Receipt, hold, Void, Shift |
| Online-first | Dashboard: receiving, Purchase Orders, Suppliers, products, Customers, reports, Promotions |
| Not a Phase 2 gate | CRDT, multi-device conflict perfection, cross-Store offline Sync |

Landscape pattern (research digest, not a requirement): receipt-lookup refunds and live inventory across devices usually stay online; POS inventory reconciles after the payment batch uploads.

## Deferred / follow-up (not dropped — not in FRs)

- Native shell (only if PWA fails print/offline on chosen device)
- Drink modifier matrix beyond Variants
- Receipt reprint by Sale id; digital Receipt URL
- Sync conflict UI beyond retry + indicator
- Accountant-grade CSV / tax filings
- Custom RBAC roles as a 2D gate (optional in PRD)
- Owner mobile app (prepare architecture; not required)
- Warranty process beyond a flag
- Card gateway / offline card settle

## Options considered (not chosen in PRD)

| Topic | Options | PRD default |
|-------|---------|-------------|
| Domain | Reframe Phase 1 as retail; keep coffee-shop UJs | Keep coffee-shop UJs |
| Day Close vs Shift | Replace Day Close with Shift; coexist | Coexist; Shift first, then Day Close (FR-111) |
| Phase 2 coverage | P0 only vs P0+P1 | P0+P1; waves are delivery order |
| Return while offline | Full offline Returns vs lookup online-first | Lookup online-first; same-day Void may be local |
| Loyalty offline | Local Points vs online-only redeem | Earn after Sync; redeem online-only |
| Oversell | Hard-block vs warn | Warn; Instant Checkout never waits on live count |
| Publish without image | Hard-block vs warn | Warn |
| Costing | FIFO / average / last cost | Product cost field |
