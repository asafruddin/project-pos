import type { Promotion, PromotionListResponse, Voucher } from "@pos-apps/types";
import type { HttpClient } from "@/core/ports/http";
import type { PromotionRemote, VoucherRemote } from "../domain/ports";

export class ApiPromotionRemote implements PromotionRemote, VoucherRemote {
  constructor(private readonly http: HttpClient) {}

  async fetchAll(): Promise<Promotion[]> {
    const res = await this.http.request<PromotionListResponse>({ method: "GET", path: "/promotions" });
    return res.promotions ?? [];
  }

  lookup(code: string): Promise<Voucher> {
    return this.http.request<Voucher>({ method: "GET", path: `/vouchers/code/${encodeURIComponent(code.trim())}` });
  }
}
