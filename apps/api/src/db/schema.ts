import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/** Server users for Account Login — no POS PIN columns (AD-6 / Story 1.2). */
export const users = pgTable("users", {
  userId: uuid("user_id").primaryKey().defaultRandom(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().$type<"cashier" | "catalog_admin">(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type UserRow = typeof users.$inferSelect;
