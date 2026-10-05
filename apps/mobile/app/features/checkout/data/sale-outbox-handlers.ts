import type { SyncSaleResponse, SyncVoidResponse } from "@pos-apps/types";
import type { OutboxHandler } from "@/infrastructure/sync/sync-engine";

/**
 * POST /sales/sync. The API is idempotent on sale_id (`already_accepted`), so
 * a retry after a lost response is safe and treated as success.
 */
export const saleSyncHandler: OutboxHandler = async (row, { http }) => {
  await http.request<SyncSaleResponse>({ method: "POST", path: "/sales/sync", body: row.payload });
};

/** POST /sales/void (idempotent on void_id). */
export const saleVoidHandler: OutboxHandler = async (row, { http }) => {
  await http.request<SyncVoidResponse>({ method: "POST", path: "/sales/void", body: row.payload });
};
