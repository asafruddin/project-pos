import type { CashSaleView } from "@/features/shift/domain/shift";
import type { CompletedSale } from "./sale";

export interface SalesRepository {
  /**
   * Atomically: store the sale, decrement local stock for tracked products,
   * and queue the sale for sync. Idempotent on `saleId`.
   */
  recordCompletedSale(sale: CompletedSale): void;
  getSale(saleId: string): CompletedSale | null;
  /** Complete sales whose `completedAt` falls in the local calendar day of `day`, newest first. */
  listForLocalDay(day: Date): CompletedSale[];
  /** Complete sales (voided included) with `completedAt >= sinceIso`, any day. */
  listCompletedSince(sinceIso: string): CompletedSale[];
  /**
   * Delete sales of closed shifts that the server already has (nothing waiting in the outbox).
   * Returns how many were removed. Called when a new shift opens.
   */
  purgeClosedShiftSales(): number;
  /** Every sale (voided included) recorded under `shiftId`, oldest first. */
  listForShift(shiftId: string): CompletedSale[];
  listCashViews(): CashSaleView[];
  /**
   * Atomically: mark the sale voided, put sold quantities back (tracked products only)
   * and queue the void for sync.
   */
  voidSale(input: { saleId: string; voidId: string; voidedAt: string }): CompletedSale;
  /** Sale ids with a sale/void still waiting to reach the server. */
  unsyncedSaleIds(): Set<string>;
}

/** Stable per-install id sent with every sale. */
export interface DeviceIdProvider {
  getDeviceId(): string;
}
