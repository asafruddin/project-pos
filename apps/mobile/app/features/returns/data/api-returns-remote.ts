import type { CreateReturnRequest, ReturnDetail, SaleLookupResponse } from "@pos-apps/types";
import type { HttpClient } from "@/core/ports/http";

/** Returns need the server (stock + cash refund bookkeeping), so they are online-only like the PWA. */
export class ApiReturnsRemote {
  constructor(private readonly http: HttpClient) {}

  lookup(saleId: string): Promise<SaleLookupResponse> {
    return this.http.request<SaleLookupResponse>({ method: "GET", path: `/sales/${saleId}` });
  }

  create(saleId: string, body: CreateReturnRequest): Promise<ReturnDetail> {
    return this.http.request<ReturnDetail>({ method: "POST", path: `/sales/${saleId}/returns`, body });
  }
}
