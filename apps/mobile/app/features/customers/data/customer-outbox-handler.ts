import type { OutboxHandler } from "@/infrastructure/sync/sync-engine";

/** POST /customers (idempotent on customer_id; duplicate phone is only a warning). */
export const customerCreateHandler: OutboxHandler = async (row, { http }) => {
  await http.request({ method: "POST", path: "/customers", body: row.payload });
};
