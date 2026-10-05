import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Durable queue of writes that still have to reach the API.
 * `seq` gives a strict creation order (shift open must precede its sales).
 */
export const outbox = sqliteTable(
  "outbox",
  {
    seq: integer("seq").primaryKey({ autoIncrement: true }),
    id: text("id").notNull().unique(),
    kind: text("kind").notNull(),
    /** Id of the aggregate (saleId, shiftId, ...); lets us re-point/inspect rows. */
    entityId: text("entity_id").notNull(),
    payload: text("payload").notNull(),
    status: text("status", { enum: ["pending", "in_flight", "dead"] })
      .notNull()
      .default("pending"),
    attempts: integer("attempts").notNull().default(0),
    /** Epoch ms; row is not retried before this. */
    nextAttemptAt: integer("next_attempt_at").notNull().default(0),
    lastError: text("last_error"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("outbox_status_idx").on(t.status, t.nextAttemptAt)],
);
