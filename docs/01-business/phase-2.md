# POS Phase 2 — Business Operations Platform

Version: 1.0
Status: Draft
Last Updated: August 2026
Source: [vision.md](./vision.md) v1.3 · [product-scope.md](./product-scope.md) v1.1

---

## How to read this

This is the **canonical Phase 2 specification**. Phase 1 remains Instant Checkout + Offline Mode for one store. Phase 2 expands that transactional foundation into operations — without rewriting the sell path and without making Cloudinary, Admin, or multi-branch part of cashier checkout.

| Phase | Promise | Boundary |
|-------|---------|----------|
| **Phase 1** | **Sell reliably.** Instant Checkout + Offline Mode. Thin Admin. | One store. Same-day void only. Basic stock. Two roles. |
| **Phase 2** | **Run the business.** Inventory, purchasing, returns, customers, shifts, media, then growth modules. | Not an ERP, KDS, warehouse app, accounting system, or full SaaS ecosystem. |
| **Later (P2+)** | Platform expansion. | Owner app, warehouse, KDS, public API, marketplace, CRDT, accounting integrations. |

---

## 1. Phase 2 vision

```text
                         POS PLATFORM
                              │
             ┌────────────────┼────────────────┐
             │                │                │
             ▼                ▼                ▼
         CASHIER          OPERATIONS       MANAGEMENT
             │                │                │
             │          ┌─────┴─────┐          │
             ▼          ▼           ▼          ▼
          SALES      INVENTORY   PURCHASING  ANALYTICS
             │          │           │          │
             ▼          ▼           ▼          ▼
         RETURNS    SUPPLIERS     STOCK      REPORTS
             │          │         TRANSFER      │
             └──────────┼───────────┬──────────┘
                        │           │
                        ▼           ▼
                    CUSTOMERS   PROMOTIONS
                        │           │
                        ▼           ▼
                     LOYALTY      VOUCHERS
                        │
                        ▼
                  MULTI-BRANCH
```

Phase 1 Admin stays thin (products/prices, basic stock, sales/day totals, basic settings). Phase 2 is when those deferred domains become real modules.

---

## 2. Main modules

| # | Module | Priority | Wave |
|---|--------|----------|------|
| 1 | Product Management + Media | P0 | 2A |
| 2 | Inventory Management | P0 | 2A |
| 3 | Purchasing & Suppliers | P0 | 2B |
| 4 | Returns & Refunds | P0 | 2B |
| 5 | Customer Management | P0 | 2C |
| 6 | Cashier Shift Management | P0 | 2C |
| 7 | Cloudinary Asset Management | P0 | 2A |
| 8 | Promotions & Vouchers | P1 | 2D |
| 9 | Loyalty & Rewards | P1 | 2C–2D |
| 10 | Reports & Analytics | P1 | 2D |
| 11 | Employee & RBAC (Admin Dashboard) | P1 | 2D |
| 12 | Multi-Store & Stock Transfer | P1 | 2D |

P2 (not Phase 2 requirements): advanced offline conflict / CRDT, warehouse app, owner app, KDS, customer app, self-checkout, public API, marketplace, accounting integrations.

---

## 3. Product management

Phase 1 product CRUD (name, price, basic stock, catalog payload) becomes a full catalog.

```text
Product
├── Basic Information — name, SKU, barcode, description, category, brand, tags, status
├── Product Images — primary, gallery, sort order, alt text, metadata
├── Pricing — cost, selling, compare-at, store-specific
├── Inventory — track stock, current / min / max
└── Variants — name, SKU, barcode, price, stock, image
```

Product images are **required** in Phase 2 for both Admin and Cashier. Cashier still sells from cached catalog data if images fail to load.

---

## 4. Cloudinary media architecture

Cloudinary is the **asset/media layer**. Product ownership and image **references** stay in the POS database.

```text
ADMIN DASHBOARD
      │ multipart/form-data
      ▼
 POS API (auth, validation, permissions)
      │ upload
      ▼
 Cloudinary (original, optimized, transformations)
      │ asset metadata
      ▼
 POS Database (public_id, secure_url, dimensions, metadata)
```

### Tables (conceptual)

`products` — catalog fields (id, name, sku, barcode, description, category_id, brand_id, cost_price, selling_price, status, timestamps).

`product_images` — id, product_id, cloudinary_public_id, secure_url, width, height, format, bytes, alt_text, sort_order, is_primary, timestamps.

### Folder convention

```text
pos/
├── products/{product-id}/  (primary, gallery-01, …)
├── categories/
├── brands/
├── promotions/
└── stores/
```

### Delivery

Do **not** store separate 150/400/800px files. Use Cloudinary dynamic transforms + CDN (`q_auto`, `f_auto`) so Admin detail, Admin list, and Cashier cards each request the size they need.

### Hard rule

**Cloudinary is never on the cashier transaction-critical path.** Checkout, payment, receipt, and offline sync must not call Cloudinary. If Cloudinary is down, cashiers still sell using cached product data/images.

See: [Node.js upload](https://cloudinary.com/documentation/node_image_and_video_upload), [image transformations](https://cloudinary.com/documentation/image_transformations), [image optimization](https://cloudinary.com/documentation/image_optimization).

---

## 5. Inventory management

Every stock change has a reason and an auditable ledger — an evolution from Phase 1’s basic qty / local decrement.

```text
INVENTORY
├── Stock Overview / by Store
├── Stock Movement / Ledger
├── Stock Adjustment
├── Stock Opname
├── Low / Out of Stock
├── Damaged Stock
└── Stock Transfer
```

| Event | Effect |
|-------|--------|
| Purchase | STOCK IN |
| Sale | STOCK OUT |
| Return (resellable) | STOCK IN |
| Damage | STOCK OUT (damaged) |
| Adjustment | STOCK ± |
| Transfer | STORE A → STORE B |

---

## 6. Stock opname

Create opname → select store & products → physical count → compare system count → variance → review → approve → update stock. Every adjustment is auditable.

---

## 7. Purchasing & suppliers

Suppliers are Phase 1 OUT. Phase 2 adds supplier profile, contacts, supplier products, pricing, payment terms, purchase history.

Purchase order states: Draft → Submitted → Approved → Partially Received → Completed.

Workflow: Supplier → PO → Approval → Goods Received → Stock IN → Invoice → Payment.

---

## 8. Returns & refunds

Phase 1: same-day void only. Phase 2: same-day void, full/partial return, exchange, refund, store credit.

Find transaction → select items → reason → inspect → inventory decision → refund/exchange → update stock → audit.

| Outcome | Inventory |
|---------|-----------|
| Resellable | Stock IN |
| Damaged | Damaged stock |
| Warranty | Separate process |

---

## 9. Customer management

Phase 1 keeps CRM out. Phase 2: profile, contact, purchase history, total spending, customer group, loyalty account, rewards, notes.

Cashier: search / create customer → attach to cart → purchase → history → loyalty/rewards.

---

## 10. Loyalty & rewards

Membership, points, tiers, earning/redemption rules, rewards, expiration, bonus points.

Purchase → earn points → reach tier → unlock reward → redeem.

Reward rules live **once** (shared business logic) — not duplicated between Admin and Cashier.

---

## 11. Promotions

Types: percentage / fixed discount, buy X get Y, bundle, product/category discount, customer group, minimum purchase, happy hour, coupon, voucher.

Conditions (product, category, quantity, customer, min amount, date, time) → reward (discount, free product, points).

---

## 12. Cashier app — Phase 2

Phase 1 Cashier already: auth, local catalog, cart, checkout, payment, receipt, offline, void, hold/park, day close.

Phase 2 adds:

| Area | Capabilities |
|------|----------------|
| Customer | Search, create, attach, view points, redeem |
| Promotions | Auto discounts, coupon, voucher, loyalty, manager-approved discount |
| Returns | Find tx, full/partial return, exchange, refund |
| Shift | Open, cash in/out, cash count, close, reconciliation |
| Checkout | Split payment, more methods, store credit, advanced discounts, customer pricing |

---

## 13. Shift management

Open (opening cash) → active (sales, cash in/out, refunds) → close (expected vs actual vs difference).

Example: opening + cash sales + cash in − cash out − refunds = expected cash; compare to counted drawer.

---

## 14. Reports & analytics

Phase 1: sales/day totals/CSV only.

Phase 2: sales (revenue, tx, units, AOV, discount, refund, net), product (top/slow, margin), inventory (value, movement, variance, dead stock), cashier performance, financial (revenue, COGS, gross profit, tax, fees).

---

## 15. Employee & RBAC

**Decision:** User, role, and permission management lives on the **Admin Dashboard**. The Cashier app never creates users or assigns roles. The API is the enforcement layer — Dashboard UI hide/show is not enough.

Phase 1: two hardcoded roles (`cashier` / `catalog_admin` or manager). No Employees screen. Catalog mutate is role-gated on the API.

Phase 2 (wave 2D): Dashboard becomes the RBAC admin for the store.

### Where it lives

| Surface | Does | Does not |
|---------|------|----------|
| **Admin Dashboard** | Create/deactivate users; assign role + store; define/edit roles; permission matrix | Sell, offline checkout |
| **Backend API** | JWT carries role/permissions; every endpoint checks resource × action | Trust the UI |
| **Cashier PWA** | Uses the signed-in user’s permissions (sell, void*, shift) | Manage users, roles, or permissions |

### Dashboard screens (Employees)

```text
ADMIN DASHBOARD
└── Employees / Access
      ├── Users — create, deactivate, reset, assign role, assign store
      ├── Roles — Owner, Admin, Store Manager, Supervisor, Cashier,
      │            Inventory Staff, Purchasing Staff (custom roles later OK)
      └── Permissions — per resource: view, create, update, delete, approve, export
```

Only **Owner** and **Admin** may open this area (`Manage users`). Store Manager cannot create admins or edit the permission matrix.

### Roles

```text
OWNER
 │
 ├── ADMIN          ← Dashboard RBAC admin
 ├── STORE MANAGER
 ├── SUPERVISOR
 ├── CASHIER        ← Cashier app
 ├── INVENTORY STAFF
 └── PURCHASING STAFF
```

### Permission model

```text
Resource (products, inventory, purchases, returns, customers, reports, users, …)
│
├── View
├── Create
├── Update
├── Delete
├── Approve
└── Export
```

| Action | Cashier | Manager | Admin |
|--------|:-------:|:-------:|:-----:|
| Sell | ✓ | ✓ | ✓ |
| Void | ✓* | ✓ | ✓ |
| Refund | ✗ | ✓ | ✓ |
| Adjust stock | ✗ | ✓ | ✓ |
| Change price | ✗ | ✓ | ✓ |
| **Manage users (Dashboard RBAC)** | ✗ | ✗ | ✓ |
| Reports | Limited | ✓ | ✓ |

`*` subject to manager approval rules.

---

## 16. Multi-store & stock transfer

Phase 1: one store + tenancy stub. Phase 2 activates company → stores → registers, inventory, employees, store pricing, store reports, transfers.

Transfer: request → approve → preparing → shipped → received → inventory updated. Statuses: Draft, Requested, Approved, Preparing, Shipped, Received, Completed.

---

## 17. Backend API — Phase 2 domains

```text
/api
├── auth, users, roles, permissions
├── stores, registers, shifts
├── products, categories, brands, product-images
├── inventory, stock-movements, stock-adjustments, stock-opnames, stock-transfers
├── suppliers, purchase-orders, goods-receipts
├── customers, loyalty, rewards
├── promotions, coupons, vouchers
├── sales, payments, returns, refunds
└── reports
```

Media lives behind infrastructure (`MediaService` → Cloudinary upload/delete/transform/delivery). Product module never talks to Cloudinary directly from checkout.

---

## 18. Product image lifecycle

Create product → upload images → Cloudinary → save metadata → Admin (large) + Cashier catalog (optimized).

Edit: add (upload + DB insert), reorder / set primary (DB), delete (Cloudinary delete + DB delete). No orphaned media.

---

## 19. Database domains (conceptual)

Platform: stores, registers, shifts, cash movements, users, roles, permissions.

Products: images, variants, categories, brands → inventory (ledger, adjustments, opname, transfers) → purchasing (suppliers, POs, goods receipts).

Customers: sales, loyalty, rewards.

---

## 20. Phase 2 offline strategy

**Do not break the Phase 1 offline promise** (local catalog, durable outbox, sync status, reconnect, conflict report, local checkout/receipt/stock decrement).

| Mode | Surface |
|------|---------|
| **Offline-capable** | Cashier: search, cart, checkout, payment record, receipt, hold, void, shift ops |
| **Online-first** | Admin: receiving, POs, suppliers, products, customers, reports, promotions |
| **Later (not Phase 2 gate)** | CRDT, multi-device conflict perfection, cross-branch offline sync |

---

## 21. Phase 2 applications

```text
POS PLATFORM
├── CASHIER — sales, checkout, returns, shift, loyalty, offline
├── ADMIN — products, inventory, purchasing, customers, promotions, reports, **Employees/RBAC**, stores
└── OWNER (prepare, not required) — analytics overview
```

Prepare architecture for owner mobile, warehouse, KDS, customer app, self-checkout, public API, marketplace — **do not require them in Phase 2**.

---

## 22. Recommended architecture

```text
CASHIER APP              ADMIN DASHBOARD
Checkout, sales          Products, inventory
Returns, shift           Purchasing, customers
Loyalty, offline         Promotions, reports, **Employees/RBAC**, stores
────────────────────────────────────────────
API / DOMAIN
Auth, products, inventory, sales, payments, customers
Purchasing, returns, loyalty, promotions, reports
Stores, users, roles, permissions, shifts
────────────────────────────────────────────
INFRASTRUCTURE
PostgreSQL, cache, Cloudinary (media only), jobs
Offline sync, monitoring, audit log, notifications
```

Modular design: Inventory, Orders, Products, Customers, Reports, Payments, Promotions as independent modules reusable by apps.

---

## 23. Delivery plan (do not ship as one giant release)

### Phase 2A — Product & inventory

Product management → Cloudinary media → categories/brands → inventory → stock ledger → adjustment → opname.

**Deliverable:** reliable product + inventory foundation.

### Phase 2B — Purchasing & returns

Suppliers → POs → goods receiving → stock IN. Sales → returns → refunds → stock IN / damaged.

**Deliverable:** complete stock lifecycle.

### Phase 2C — Customers & cashier operations

Customers → history → loyalty → rewards. Cashier shift, returns, advanced payment.

**Deliverable:** complete front-of-store operations.

### Phase 2D — Growth & management

Promotions, coupons, vouchers, loyalty; analytics, reports; **Admin Dashboard RBAC** (users, roles, permission matrix); multi-store.

**Deliverable:** business management platform. User/role admin is Dashboard-only.

---

## 24. Priority matrix

**P0 — Core:** product management, Cloudinary images, inventory, stock ledger, opname, suppliers, purchasing, returns, refunds, customers, cashier shift.

**P1 — Growth:** promotions, coupons, vouchers, loyalty, rewards, advanced reports, analytics, **Dashboard RBAC**, stock transfer, multi-store.

**P2 — Platform expansion (after Phase 2):** advanced offline conflict, warehouse/owner/KDS/customer/self-checkout apps, public API, marketplace, accounting integrations.

---

## 25. Phase 2 success criteria

Phase 1 gates remain: zero lost sales, offline checkout, sub-300ms local checkout, understandable sync, day-close accuracy, proven hardware.

### Operations

- Accurate stock ledger
- Successful stock opname
- Purchase → receiving → inventory
- Return → refund → inventory
- Shift reconciliation

### Product / media

- Images in Admin and Cashier
- Cloudinary assets linked to products
- Optimized delivery; no orphaned media after delete
- Cloudinary failure cannot block checkout

### Business

- Customer purchase history
- Promotions applied correctly
- Loyalty points calculated correctly
- Sales and inventory analytics available

### Organization (P1 modules)

- Permission-based access, **managed on Admin Dashboard** (users, roles, permission matrix); API enforces
- Multiple stores, store-level inventory and reporting
- Stock transfer

### Architecture

- Business rules centralized
- Modules independent
- Type-safe API/domain contracts
- Cloudinary isolated behind media infrastructure
- Phase 1 offline checkout remains reliable

---

## 26. Phase 1 → Phase 2 roadmap

```text
PHASE 1 "SELL RELIABLY"          PHASE 2 "RUN THE BUSINESS"
Instant Checkout                 Product Management + Cloudinary
Offline Mode                     Inventory
Sales / Payment / Receipt        Purchasing / Suppliers
Basic Product / Basic Stock      Returns / Refunds
                                 Customers / Loyalty
                                 Promotions
                                 Reports / Analytics
                                 RBAC / Multi-store
```

**Most important architectural decision:** Cloudinary is Phase 2 **media** infrastructure, not POS **transaction** infrastructure. Sale (product, cart, payment, receipt, offline sync) stays independent of image CDN.

That preserves Phase 1: **the cashier must keep selling even when external services or the network are unavailable.**

---

## Traceability

| This doc | Other docs |
|----------|------------|
| Vision / modules | [vision.md](./vision.md) Phase 2 Scope |
| IN/OUT / waves | [product-scope.md](./product-scope.md) |
| Success | [success-metrics.md](./success-metrics.md) Phase 2 gates |
| People | [stakeholders.md](./stakeholders.md) Phase 2 map |
