import type { ShiftDetailResponse } from "@pos-apps/types";
import type { HttpClient } from "@/core/ports/http";
import type { ShiftRemote } from "../domain/ports";

export class ApiShiftRemote implements ShiftRemote {
  constructor(private readonly http: HttpClient) {}

  async cashRefundsMinor(shiftId: string): Promise<number> {
    const detail = await this.http.request<ShiftDetailResponse>({ method: "GET", path: `/shifts/${shiftId}` });
    return detail.expected.cash_refunds_minor;
  }
}
