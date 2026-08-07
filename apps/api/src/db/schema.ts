import { sql } from "drizzle-orm";
import {
  check,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/** Server users for Account Login — no POS PIN columns (AD-6 / Story 1.2). */
export const users = pgTable(
  "users",
  {
    userId: uuid("user_id").primaryKey().defaultRandom(),
    username: text("username").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    role: text("role").notNull().$type<"cashier" | "catalog_admin">(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check(
      "users_role_check",
      sql`${t.role} in ('cashier', 'catalog_admin')`,
    ),
  ],
);

/** Catalog products — Stock lives on the product row (AD-4 AdjustStock / Story 1.3). */
export const products = pgTable(
  "products",
  {
    productId: uuid("product_id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    priceMinor: integer("price_minor").notNull(),
    stockQty: integer("stock_qty").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check("products_price_minor_nonneg", sql`${t.priceMinor} >= 0`),
    check("products_stock_qty_nonneg", sql`${t.stockQty} >= 0`),
  ],
);

export type UserRow = typeof users.$inferSelect;
export type ProductRow = typeof products.$inferSelect;

/** Synced Sales read model — writers arrive in Epic 2 AcceptCompleteSale. */
export const sales = pgTable("sales", {
  saleId: uuid("sale_id").primaryKey().defaultRandom(),
  completedAt: timestamp("completed_at", { withTimezone: true }).notNull(),
  amountMinor: integer("amount_minor").notNull(),
  deviceId: text("device_id").notNull().default("legacy"),
  payment: jsonb("payment")
    .$type<{ method: "cash"; amount_minor: number }>()
    .notNull()
    .default({ method: "cash", amount_minor: 0 }),
  lines: jsonb("lines")
    .$type<Array<{ product_id: string; qty: number; price_minor: number }>>()
    .notNull()
    .default([]),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type SaleRow = typeof sales.$inferSelect;
