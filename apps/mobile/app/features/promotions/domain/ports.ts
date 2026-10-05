import type { Promotion, Voucher } from "@pos-apps/types";

/** Promotion rules cached for offline pricing (last successful pull wins). */
export interface PromotionRepository {
  get(): Promotion[];
  replace(promotions: Promotion[]): void;
}

export interface VoucherRemote {
  /** Throws `AppError` (API 404 → unknown code, NETWORK, ...). */
  lookup(code: string): Promise<Voucher>;
}

export interface PromotionRemote {
  fetchAll(): Promise<Promotion[]>;
}
