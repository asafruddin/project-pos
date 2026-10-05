import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const shifts = sqliteTable("shifts", {
  shiftId: text("shift_id").primaryKey(),
  storeId: text("store_id"),
  registerId: text("register_id"),
  openedAt: text("opened_at").notNull(),
  openingCashMinor: integer("opening_cash_minor").notNull(),
  status: text("status", { enum: ["open", "closed"] }).notNull().default("open"),
  closedAt: text("closed_at"),
  countedCashMinor: integer("counted_cash_minor"),
  expectedCashMinor: integer("expected_cash_minor"),
  differenceMinor: integer("difference_minor"),
});

export const cashMovements = sqliteTable(
  "cash_movements",
  {
    movementId: text("movement_id").primaryKey(),
    shiftId: text("shift_id").notNull(),
    kind: text("kind", { enum: ["in", "out"] }).notNull(),
    amountMinor: integer("amount_minor").notNull(),
    reason: text("reason").notNull(),
    occurredAt: text("occurred_at").notNull(),
  },
  (t) => [index("cash_movements_shift_idx").on(t.shiftId)],
);
