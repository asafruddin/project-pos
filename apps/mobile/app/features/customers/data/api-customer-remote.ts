import type {
  CreateCustomerRequest,
  CreateCustomerResponse,
  Customer as ApiCustomer,
  CustomerHistoryResponse,
  CustomerListResponse,
} from "@pos-apps/types";
import type { HttpClient } from "@/core/ports/http";
import type { Customer } from "../domain/customer";
import type { CustomerRemote } from "../domain/ports";

export function toCustomer(row: ApiCustomer): Customer {
  return {
    customerId: row.customer_id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    notes: row.notes,
    groupName: row.group_name,
    storeCreditMinor: row.store_credit_minor ?? 0,
    loyaltyPoints: row.loyalty_points ?? 0,
    loyaltyTier: row.loyalty_tier ?? null,
  };
}

export class ApiCustomerRemote implements CustomerRemote {
  constructor(private readonly http: HttpClient) {}

  async fetchAll(): Promise<Customer[]> {
    const res = await this.http.request<CustomerListResponse>({ method: "GET", path: "/customers" });
    return (res.customers ?? []).map(toCustomer);
  }

  history(customerId: string): Promise<CustomerHistoryResponse> {
    return this.http.request<CustomerHistoryResponse>({ method: "GET", path: `/customers/${customerId}/history` });
  }

  async create(request: CreateCustomerRequest): Promise<{ duplicatePhone: boolean }> {
    const res = await this.http.request<CreateCustomerResponse>({ method: "POST", path: "/customers", body: request });
    return { duplicatePhone: res.warnings?.includes("DUPLICATE_PHONE") ?? false };
  }
}
