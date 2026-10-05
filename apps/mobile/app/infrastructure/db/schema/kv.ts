import { sqliteTable, text } from "drizzle-orm/sqlite-core";

/** Small non-secret key/value state (device id, session meta, sync cursors). */
export const kv = sqliteTable("kv", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
