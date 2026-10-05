import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const sales = sqliteTable(
  "sales",
  {
    saleId: text("sale_id").primaryKey(),
    deviceId: text("device_id").notNull(),
    createdAt: text("created_at").notNull(),
    completedAt: text("completed_at").notNull(),
    paymentMethod: text("payment_method").notNull(),
    paymentAmountMinor: integer("payment_amount_minor").notNull(),
    /** JSON: Array<{ method, amountMinor }> */
    tendersJson: text("tenders_json"),
    customerId: text("customer_id"),
    guestName: text("guest_name"),
    shiftId: text("shift_id"),
    /** JSON: coupon/voucher/manager discount snapshot (see `SalePromotions`). */
    promotionsJson: text("promotions_json"),
    voidedAt: text("voided_at"),
    voidId: text("void_id"),
  },
  (t) => [index("sales_completed_at_idx").on(t.completedAt)],
);

export const saleLines = sqliteTable(
  "sale_lines",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    saleId: text("sale_id")
      .notNull()
      .references(() => sales.saleId, { onDelete: "cascade" }),
    productId: text("product_id").notNull(),
    name: text("name").notNull(),
    qty: integer("qty").notNull(),
    priceMinor: integer("price_minor").notNull(),
  },
  (t) => [index("sale_lines_sale_idx").on(t.saleId)],
);
