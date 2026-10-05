import type { CreateCustomerRequest, CustomerHistoryResponse } from "@pos-apps/types";
import type { Customer } from "./customer";

export interface CustomerRepository {
  list(): Customer[];
  get(customerId: string): Customer | null;
  /** Replace the cache with the server list, keeping customers whose create is still queued. */
  replaceAll(customers: Customer[], pulledAtIso: string): void;
  /** Add to the cache and queue `customer.create` atomically. */
  createLocal(request: CreateCustomerRequest & { customer_id: string }, customer: Customer, pulledAtIso: string): void;
}

export interface CustomerRemote {
  fetchAll(): Promise<Customer[]>;
  history(customerId: string): Promise<CustomerHistoryResponse>;
  /** Returns whether the server flagged the phone as a duplicate. */
  create(request: CreateCustomerRequest): Promise<{ duplicatePhone: boolean }>;
}
