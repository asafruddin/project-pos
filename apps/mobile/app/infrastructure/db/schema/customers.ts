import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const customers = sqliteTable("customers", {
  customerId: text("customer_id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone"),
  email: text("email"),
  notes: text("notes"),
  groupName: text("group_name"),
  storeCreditMinor: integer("store_credit_minor").notNull().default(0),
  loyaltyPoints: integer("loyalty_points").notNull().default(0),
  loyaltyTier: text("loyalty_tier"),
  pulledAt: text("pulled_at").notNull(),
});
