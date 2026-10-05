import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const printJobs = sqliteTable("print_jobs", {
  jobId: text("job_id").primaryKey(),
  saleId: text("sale_id"),
  /** ESC/POS bytes, base64. */
  payloadB64: text("payload_b64").notNull(),
  status: text("status", { enum: ["pending", "printed", "failed"] })
    .notNull()
    .default("pending"),
  attempts: integer("attempts").notNull().default(0),
  lastError: text("last_error"),
  createdAt: integer("created_at").notNull(),
  printedAt: integer("printed_at"),
});
