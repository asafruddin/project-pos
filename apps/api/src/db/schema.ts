import type { PlatformRole, Role } from "@pos-apps/types";
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  primaryKey,
} from "drizzle-orm/pg-core";

/** Server users for Account Login — no POS PIN columns (AD-6 / Story 1.2). */
export const users = pgTable(
  "users",
  {
    userId: uuid("user_id").primaryKey().defaultRandom(),
    username: text("username").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    role: text("role").notNull().$type<Role>(),
    active: boolean("active").notNull().default(true),
    storeId: uuid("store_id")
      .notNull()
      .default("00000000-0000-4000-8000-000000000001"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check(
      "users_role_check",
      sql`${t.role} in ('owner', 'catalog_admin', 'store_manager', 'supervisor', 'cashier', 'inventory_staff', 'purchasing_staff')`,
    ),
  ],
);

/** Platform operators — not store staff (AD-20). */
export const platformUsers = pgTable(
  "platform_users",
  {
    platformUserId: uuid("platform_user_id").primaryKey().defaultRandom(),
    username: text("username").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    role: text("role").notNull().$type<PlatformRole>(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check(
      "platform_users_role_check",
      sql`${t.role} in ('super_admin')`,
    ),
  ],
);

export const rolePermissions = pgTable(
  "role_permissions",
  {
    role: text("role").notNull().$type<Role>(),
    resource: text("resource").notNull(),
    action: text("action").notNull(),
  },
  (t) => [primaryKey({ columns: [t.role, t.resource, t.action] })],
);

/** Store / Register tenancy stub (AD-19). Phase 1 data is Store #1 + one Register. */
export const stores = pgTable("stores", {
  storeId: uuid("store_id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const registers = pgTable("registers", {
  registerId: uuid("register_id").primaryKey(),
  storeId: uuid("store_id")
    .notNull()
    .references(() => stores.storeId),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const categories = pgTable(
  "categories",
  {
    categoryId: uuid("category_id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.storeId),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("categories_store_name_unique").on(t.storeId, t.name)],
);

export const brands = pgTable("brands", {
  brandId: uuid("brand_id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Store-scoped sell unit (pcs, kg, slop) — not report quantity sold. */
export const units = pgTable(
  "units",
  {
    unitId: uuid("unit_id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.storeId),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("units_store_name_unique").on(t.storeId, t.name)],
);

/** Catalog products — `stock_qty` is a cached ledger projection (AD-4 / AD-13). */
export const products = pgTable(
  "products",
  {
    productId: uuid("product_id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    priceMinor: integer("price_minor").notNull(),
    stockQty: integer("stock_qty").notNull(),
    sku: text("sku"),
    barcode: text("barcode"),
    description: text("description"),
    status: text("status")
      .notNull()
      .default("active")
      .$type<"active" | "inactive">(),
    costMinor: integer("cost_minor"),
    compareAtMinor: integer("compare_at_minor"),
    minQty: integer("min_qty"),
    maxQty: integer("max_qty"),
    trackStock: boolean("track_stock").notNull().default(true),
    parentId: uuid("parent_id"),
    categoryId: uuid("category_id").references(() => categories.categoryId),
    brandId: uuid("brand_id").references(() => brands.brandId),
    unitId: uuid("unit_id").references(() => units.unitId),
    tags: text("tags").array().notNull().default(sql`'{}'`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check("products_price_minor_nonneg", sql`${t.priceMinor} >= 0`),
    check("products_status_check", sql`${t.status} in ('active', 'inactive')`),
    check(
      "products_cost_minor_nonneg",
      sql`${t.costMinor} IS NULL OR ${t.costMinor} >= 0`,
    ),
    check(
      "products_compare_at_minor_nonneg",
      sql`${t.compareAtMinor} IS NULL OR ${t.compareAtMinor} >= 0`,
    ),
    uniqueIndex("products_sku_unique").on(t.sku),
    foreignKey({
      columns: [t.parentId],
      foreignColumns: [t.productId],
      name: "products_parent_id_products_product_id_fk",
    }),
  ],
);

/**
 * Explicit Pack→pcs (or similar) link between two sellable SKUs.
 * `from` is the larger unit (pack); `to` is the smaller (pcs).
 * Factor: `from_qty` of from → `to_qty` of to (typically 1 pack = N pcs).
 */
export const productUnitConversions = pgTable(
  "product_unit_conversions",
  {
    conversionId: uuid("conversion_id").primaryKey().defaultRandom(),
    fromProductId: uuid("from_product_id")
      .notNull()
      .references(() => products.productId),
    toProductId: uuid("to_product_id")
      .notNull()
      .references(() => products.productId),
    fromQty: integer("from_qty").notNull().default(1),
    toQty: integer("to_qty").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("product_unit_conversions_to_product_unique").on(t.toProductId),
    uniqueIndex("product_unit_conversions_pair_unique").on(
      t.fromProductId,
      t.toProductId,
    ),
    check(
      "product_unit_conversions_from_qty_pos",
      sql`${t.fromQty} > 0`,
    ),
    check("product_unit_conversions_to_qty_pos", sql`${t.toQty} > 0`),
    check(
      "product_unit_conversions_not_self",
      sql`${t.fromProductId} <> ${t.toProductId}`,
    ),
  ],
);

/** Server quantity truth (AD-13). Only named domain commands insert rows. */
export const stockMovements = pgTable(
  "stock_movements",
  {
    movementId: uuid("movement_id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.productId),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.storeId),
    qtyDelta: integer("qty_delta").notNull(),
    bucket: text("bucket")
      .notNull()
      .$type<"sellable" | "damaged" | "in_transit">(),
    reason: text("reason").notNull(),
    sourceType: text("source_type").notNull(),
    sourceId: uuid("source_id"),
    actorId: uuid("actor_id"),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      "stock_movements_bucket_check",
      sql`${t.bucket} in ('sellable', 'damaged', 'in_transit')`,
    ),
  ],
);

export const productImages = pgTable(
  "product_images",
  {
    imageId: uuid("image_id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.productId),
    publicId: text("public_id").notNull().unique(),
    secureUrl: text("secure_url").notNull(),
    width: integer("width"),
    height: integer("height"),
    format: text("format"),
    bytes: integer("bytes"),
    altText: text("alt_text"),
    sortOrder: integer("sort_order").notNull().default(0),
    isPrimary: boolean("is_primary").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("product_images_one_primary")
      .on(t.productId)
      .where(sql`${t.isPrimary} = true`),
  ],
);

export const mediaDeleteRetries = pgTable("media_delete_retries", {
  retryId: uuid("retry_id").primaryKey().defaultRandom(),
  publicId: text("public_id").notNull(),
  attempts: integer("attempts").notNull().default(0),
  lastError: text("last_error"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type OpnameStatus = "draft" | "approved" | "rejected" | "cancelled";

export const stockOpnames = pgTable(
  "stock_opnames",
  {
    opnameId: uuid("opname_id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.storeId),
    status: text("status").notNull().$type<OpnameStatus>(),
    createdBy: uuid("created_by"),
    decidedBy: uuid("decided_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
  },
  (t) => [
    check(
      "stock_opnames_status_check",
      sql`${t.status} in ('draft', 'approved', 'rejected', 'cancelled')`,
    ),
  ],
);

export const stockOpnameLines = pgTable(
  "stock_opname_lines",
  {
    opnameId: uuid("opname_id")
      .notNull()
      .references(() => stockOpnames.opnameId),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.productId),
    systemQty: integer("system_qty").notNull(),
    countedQty: integer("counted_qty"),
  },
  (t) => [primaryKey({ columns: [t.opnameId, t.productId] })],
);

export type UserRow = typeof users.$inferSelect;
export type ProductRow = typeof products.$inferSelect;
export type CategoryRow = typeof categories.$inferSelect;
export type BrandRow = typeof brands.$inferSelect;
export type UnitRow = typeof units.$inferSelect;
export type ProductImageRow = typeof productImages.$inferSelect;
export type MediaDeleteRetryRow = typeof mediaDeleteRetries.$inferSelect;
export type StoreRow = typeof stores.$inferSelect;
export type RegisterRow = typeof registers.$inferSelect;
export type StockMovementRow = typeof stockMovements.$inferSelect;
export type StockOpnameRow = typeof stockOpnames.$inferSelect;
export type StockOpnameLineRow = typeof stockOpnameLines.$inferSelect;

export type PurchaseOrderStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "partially_received"
  | "completed"
  | "cancelled";

export const suppliers = pgTable("suppliers", {
  supplierId: uuid("supplier_id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  contactName: text("contact_name"),
  phone: text("phone"),
  email: text("email"),
  paymentTerms: text("payment_terms"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const supplierProducts = pgTable(
  "supplier_products",
  {
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.supplierId),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.productId),
    costMinor: integer("cost_minor"),
  },
  (t) => [primaryKey({ columns: [t.supplierId, t.productId] })],
);

export const purchaseOrders = pgTable(
  "purchase_orders",
  {
    poId: uuid("po_id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.storeId),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.supplierId),
    status: text("status").notNull().$type<PurchaseOrderStatus>(),
    createdBy: uuid("created_by"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    submittedBy: uuid("submitted_by"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    approvedBy: uuid("approved_by"),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelledBy: uuid("cancelled_by"),
    invoiceRef: text("invoice_ref"),
    paymentStatus: text("payment_status")
      .notNull()
      .default("unpaid")
      .$type<"unpaid" | "partial" | "paid">(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check(
      "purchase_orders_status_check",
      sql`${t.status} in ('draft', 'submitted', 'approved', 'partially_received', 'completed', 'cancelled')`,
    ),
    check(
      "purchase_orders_payment_status_check",
      sql`${t.paymentStatus} in ('unpaid', 'partial', 'paid')`,
    ),
  ],
);

export const purchaseOrderLines = pgTable(
  "purchase_order_lines",
  {
    poId: uuid("po_id")
      .notNull()
      .references(() => purchaseOrders.poId),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.productId),
    qty: integer("qty").notNull(),
    costMinor: integer("cost_minor").notNull(),
    receivedQty: integer("received_qty").notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.poId, t.productId] }),
    check("purchase_order_lines_qty_check", sql`${t.qty} >= 1`),
    check("purchase_order_lines_cost_check", sql`${t.costMinor} >= 0`),
    check("purchase_order_lines_received_check", sql`${t.receivedQty} >= 0`),
  ],
);

export type SupplierRow = typeof suppliers.$inferSelect;
export type SupplierProductRow = typeof supplierProducts.$inferSelect;
export type PurchaseOrderRow = typeof purchaseOrders.$inferSelect;
export type PurchaseOrderLineRow = typeof purchaseOrderLines.$inferSelect;

export const goodsReceipts = pgTable("goods_receipts", {
  receiptId: uuid("receipt_id").primaryKey().defaultRandom(),
  poId: uuid("po_id")
    .notNull()
    .references(() => purchaseOrders.poId),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const goodsReceiptLines = pgTable(
  "goods_receipt_lines",
  {
    receiptId: uuid("receipt_id")
      .notNull()
      .references(() => goodsReceipts.receiptId),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.productId),
    qty: integer("qty").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.receiptId, t.productId] }),
    check("goods_receipt_lines_qty_check", sql`${t.qty} >= 1`),
  ],
);

export type GoodsReceiptRow = typeof goodsReceipts.$inferSelect;
export type GoodsReceiptLineRow = typeof goodsReceiptLines.$inferSelect;

/** Synced Sales read model — writers arrive in Epic 2 AcceptCompleteSale. */
export const sales = pgTable("sales", {
  saleId: uuid("sale_id").primaryKey().defaultRandom(),
  completedAt: timestamp("completed_at", { withTimezone: true }).notNull(),
  amountMinor: integer("amount_minor").notNull(),
  deviceId: text("device_id").notNull().default("legacy"),
  storeId: uuid("store_id")
    .notNull()
    .references(() => stores.storeId)
    .default("00000000-0000-4000-8000-000000000001"),
  registerId: uuid("register_id")
    .notNull()
    .references(() => registers.registerId)
    .default("00000000-0000-4000-8000-000000000002"),
  payment: jsonb("payment")
    .$type<{
      method: "cash" | "store_credit" | "split";
      amount_minor: number;
      tenders?: Array<{ method: "cash" | "store_credit"; amount_minor: number }>;
    }>()
    .notNull()
    .default({ method: "cash", amount_minor: 0 }),
  lines: jsonb("lines")
    .$type<Array<{ product_id: string; qty: number; price_minor: number }>>()
    .notNull()
    .default([]),
  /** Optional Customer attach (FR-71). No FK — Sale Sync never waits on Customer (AD-3 / AD-18). */
  customerId: uuid("customer_id"),
  /** Required on new Sync after 2C (AD-16). No FK — sale retry must not wait on Shift row. */
  shiftId: uuid("shift_id"),
  loyalty: jsonb("loyalty").$type<{
    redeem_points?: number;
    discount_minor?: number;
    earned_points?: number;
  } | null>(),
  promotions: jsonb("promotions").$type<{
    discount_minor?: number;
    coupon_code?: string | null;
    voucher_code?: string | null;
    voucher_minor?: number;
    manager_discount_minor?: number;
    applied?: Array<{
      promotion_id: string;
      name: string;
      discount_minor: number;
    }>;
  } | null>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type SaleRow = typeof sales.$inferSelect;

/** Auditable same-day Void — Sale row is never deleted (AD-2 / FR-63). */
export const saleVoids = pgTable("sale_voids", {
  voidId: uuid("void_id").primaryKey().defaultRandom(),
  saleId: uuid("sale_id")
    .notNull()
    .references(() => sales.saleId)
    .unique(),
  voidedAt: timestamp("voided_at", { withTimezone: true }).notNull(),
  actorId: uuid("actor_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type SaleVoidRow = typeof saleVoids.$inferSelect;

export const saleReturns = pgTable("sale_returns", {
  returnId: uuid("return_id").primaryKey().defaultRandom(),
  saleId: uuid("sale_id")
    .notNull()
    .references(() => sales.saleId),
  reason: text("reason").notNull(),
  status: text("status").notNull().$type<"open" | "refunded">().default("open"),
  refundAmountMinor: integer("refund_amount_minor"),
  refundedAt: timestamp("refunded_at", { withTimezone: true }),
  refundedBy: uuid("refunded_by"),
  exchangeSaleId: uuid("exchange_sale_id").references(() => sales.saleId),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  /** Cash Refund attaches to the open Shift when present (FR-76). No FK. */
  shiftId: uuid("shift_id"),
});

export const saleReturnLines = pgTable(
  "sale_return_lines",
  {
    returnId: uuid("return_id")
      .notNull()
      .references(() => saleReturns.returnId),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.productId),
    qty: integer("qty").notNull(),
    decision: text("decision")
      .notNull()
      .$type<"resellable" | "damaged" | "warranty">(),
  },
  (t) => [
    primaryKey({ columns: [t.returnId, t.productId] }),
    check("sale_return_lines_qty_check", sql`${t.qty} >= 1`),
    check(
      "sale_return_lines_decision_check",
      sql`${t.decision} in ('resellable', 'damaged', 'warranty')`,
    ),
  ],
);

export type SaleReturnRow = typeof saleReturns.$inferSelect;
export type SaleReturnLineRow = typeof saleReturnLines.$inferSelect;

/** Named shopper (FR-70). Phone is not unique — duplicate warns, does not merge. */
export const customers = pgTable(
  "customers",
  {
    customerId: uuid("customer_id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    phone: text("phone"),
    email: text("email"),
    notes: text("notes"),
    groupName: text("group_name"),
    storeCreditMinor: integer("store_credit_minor").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check("customers_name_check", sql`char_length(trim(${t.name})) > 0`),
    check(
      "customers_contact_check",
      sql`(
        (${t.phone} IS NOT NULL AND char_length(trim(${t.phone})) > 0)
        OR (${t.email} IS NOT NULL AND char_length(trim(${t.email})) > 0)
      )`,
    ),
    check("customers_store_credit_check", sql`${t.storeCreditMinor} >= 0`),
  ],
);

export type CustomerRow = typeof customers.$inferSelect;

export const customerPrices = pgTable(
  "customer_prices",
  {
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.customerId, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.productId, { onDelete: "cascade" }),
    priceMinor: integer("price_minor").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.customerId, t.productId] }),
    check("customer_prices_price_check", sql`${t.priceMinor} >= 0`),
  ],
);

export const customerGroupPrices = pgTable(
  "customer_group_prices",
  {
    groupName: text("group_name").notNull(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.productId, { onDelete: "cascade" }),
    priceMinor: integer("price_minor").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.groupName, t.productId] }),
    check(
      "customer_group_prices_name_check",
      sql`char_length(trim(${t.groupName})) > 0`,
    ),
    check("customer_group_prices_price_check", sql`${t.priceMinor} >= 0`),
  ],
);

export type CustomerPriceRow = typeof customerPrices.$inferSelect;
export type CustomerGroupPriceRow = typeof customerGroupPrices.$inferSelect;

/** Cashier Shift (FR-75 / AD-16). Close snapshots Expected Cash (FR-78 / FR-79). */
export const shifts = pgTable(
  "shifts",
  {
    shiftId: uuid("shift_id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.storeId)
      .default("00000000-0000-4000-8000-000000000001"),
    registerId: uuid("register_id")
      .notNull()
      .references(() => registers.registerId)
      .default("00000000-0000-4000-8000-000000000002"),
    openedAt: timestamp("opened_at", { withTimezone: true }).notNull(),
    openingCashMinor: integer("opening_cash_minor").notNull(),
    status: text("status").notNull().$type<"open" | "closed">().default("open"),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    countedCashMinor: integer("counted_cash_minor"),
    expectedCashMinor: integer("expected_cash_minor"),
    differenceMinor: integer("difference_minor"),
    actorId: uuid("actor_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check("shifts_opening_cash_nonneg", sql`${t.openingCashMinor} >= 0`),
    check("shifts_status_check", sql`${t.status} in ('open', 'closed')`),
    uniqueIndex("shifts_one_open_per_register")
      .on(t.registerId)
      .where(sql`${t.status} = 'open'`),
  ],
);

export type ShiftRow = typeof shifts.$inferSelect;

/** Cash In / Out during an open Shift (FR-77). Never writes Stock. */
export const shiftCashMovements = pgTable(
  "shift_cash_movements",
  {
    movementId: uuid("movement_id").primaryKey().defaultRandom(),
    shiftId: uuid("shift_id")
      .notNull()
      .references(() => shifts.shiftId),
    kind: text("kind").notNull().$type<"in" | "out">(),
    amountMinor: integer("amount_minor").notNull(),
    reason: text("reason").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    actorId: uuid("actor_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check("shift_cash_kind_check", sql`${t.kind} in ('in', 'out')`),
    check("shift_cash_amount_check", sql`${t.amountMinor} >= 1`),
    check(
      "shift_cash_reason_check",
      sql`char_length(trim(${t.reason})) > 0`,
    ),
  ],
);

export type ShiftCashMovementRow = typeof shiftCashMovements.$inferSelect;

export const loyaltyPrograms = pgTable("loyalty_programs", {
  programId: uuid("program_id").primaryKey().defaultRandom(),
  storeId: uuid("store_id")
    .notNull()
    .references(() => stores.storeId)
    .default("00000000-0000-4000-8000-000000000001"),
  enabled: boolean("enabled").notNull().default(true),
  earnPerMinor: integer("earn_per_minor").notNull().default(10000),
  pointValueMinor: integer("point_value_minor").notNull().default(100),
  expireDays: integer("expire_days"),
  tiers: jsonb("tiers")
    .$type<
      Array<{
        name: string;
        min_lifetime_points: number;
        earn_multiplier_bps: number;
      }>
    >()
    .notNull()
    .default([]),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const loyaltyAccounts = pgTable("loyalty_accounts", {
  customerId: uuid("customer_id")
    .primaryKey()
    .references(() => customers.customerId, { onDelete: "cascade" }),
  pointsBalance: integer("points_balance").notNull().default(0),
  lifetimeEarned: integer("lifetime_earned").notNull().default(0),
  tier: text("tier"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const loyaltyLedger = pgTable(
  "loyalty_ledger",
  {
    entryId: uuid("entry_id").primaryKey().defaultRandom(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.customerId, { onDelete: "cascade" }),
    kind: text("kind")
      .notNull()
      .$type<
        | "earn"
        | "redeem"
        | "expire"
        | "adjust"
        | "void_earn"
        | "void_redeem"
      >(),
    pointsDelta: integer("points_delta").notNull(),
    remainingPoints: integer("remaining_points"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    saleId: uuid("sale_id"),
    actorId: uuid("actor_id"),
    note: text("note"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    check(
      "loyalty_ledger_kind_check",
      sql`${t.kind} in ('earn','redeem','expire','adjust','void_earn','void_redeem')`,
    ),
  ],
);

export type LoyaltyProgramRow = typeof loyaltyPrograms.$inferSelect;
export type LoyaltyAccountRow = typeof loyaltyAccounts.$inferSelect;
export type LoyaltyLedgerRow = typeof loyaltyLedger.$inferSelect;

export const promotions = pgTable(
  "promotions",
  {
    promotionId: uuid("promotion_id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.storeId)
      .default("00000000-0000-4000-8000-000000000001"),
    name: text("name").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    kind: text("kind").notNull().$type<"percent" | "fixed">(),
    percentBps: integer("percent_bps"),
    fixedMinor: integer("fixed_minor"),
    couponCode: text("coupon_code"),
    exclusive: boolean("exclusive").notNull().default(false),
    minSubtotalMinor: integer("min_subtotal_minor"),
    customerGroup: text("customer_group"),
    productIds: jsonb("product_ids").$type<string[]>().notNull().default([]),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    hourStart: integer("hour_start"),
    hourEnd: integer("hour_end"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check("promotions_kind_check", sql`${t.kind} in ('percent', 'fixed')`),
  ],
);

export const vouchers = pgTable("vouchers", {
  voucherId: uuid("voucher_id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  remainingMinor: integer("remaining_minor").notNull().default(0),
  enabled: boolean("enabled").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type PromotionRow = typeof promotions.$inferSelect;
export type VoucherRow = typeof vouchers.$inferSelect;

export type StockTransferStatus =
  | "draft"
  | "requested"
  | "approved"
  | "preparing"
  | "shipped"
  | "received"
  | "completed"
  | "cancelled";

export const storePrices = pgTable(
  "store_prices",
  {
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.storeId),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.productId),
    priceMinor: integer("price_minor"),
  },
  (t) => [primaryKey({ columns: [t.storeId, t.productId] })],
);

export const stockTransfers = pgTable(
  "stock_transfers",
  {
    transferId: uuid("transfer_id").primaryKey().defaultRandom(),
    fromStoreId: uuid("from_store_id")
      .notNull()
      .references(() => stores.storeId),
    toStoreId: uuid("to_store_id")
      .notNull()
      .references(() => stores.storeId),
    status: text("status").notNull().$type<StockTransferStatus>(),
    createdBy: uuid("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check(
      "stock_transfers_status_check",
      sql`${t.status} in ('draft', 'requested', 'approved', 'preparing', 'shipped', 'received', 'completed', 'cancelled')`,
    ),
  ],
);

export const stockTransferLines = pgTable(
  "stock_transfer_lines",
  {
    transferId: uuid("transfer_id")
      .notNull()
      .references(() => stockTransfers.transferId),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.productId),
    qty: integer("qty").notNull(),
  },
  (t) => [primaryKey({ columns: [t.transferId, t.productId] })],
);

export type StorePriceRow = typeof storePrices.$inferSelect;
export type StockTransferRow = typeof stockTransfers.$inferSelect;
export type StockTransferLineRow = typeof stockTransferLines.$inferSelect;
