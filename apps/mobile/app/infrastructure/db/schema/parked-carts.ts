import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/** Held ("parked") carts. Device-local; never synced and never a Sale. */
export const parkedCarts = sqliteTable("parked_carts", {
  parkId: text("park_id").primaryKey(),
  createdAt: text("created_at").notNull(),
  /** JSON: Array<{ productId, name, priceMinor, qty }> */
  linesJson: text("lines_json").notNull(),
  totalMinor: integer("total_minor").notNull(),
  customerName: text("customer_name"),
});
