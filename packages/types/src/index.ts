/** Shared auth / catalog DTOs for API + Dashboard. */

export type PlaceholderId = string;

/** Account roles — AD-11 / FR-32 */
export type Role = "cashier" | "catalog_admin";

export type LoginRequest = {
  /** Username (case-sensitive exact match after trim). */
  login: string;
  password: string;
};

export type LoginResponse = {
  access_token: string;
  token_type: "Bearer";
  user_id: string;
  role: Role;
};

export type AuthMeResponse = {
  user_id: string;
  role: Role;
};

export type ApiErrorBody = {
  code: string;
  message: string;
};

/** Phase 1: integer rupiah (Rp) — no fractional subunit. */
export type Product = {
  product_id: string;
  name: string;
  price_minor: number;
  stock_qty: number;
  created_at?: string;
  updated_at?: string;
};

export type CreateProductRequest = {
  name: string;
  price_minor: number;
  stock_qty: number;
};

export type UpdateProductRequest = {
  name?: string;
  price_minor?: number;
};

export type AdjustStockRequest = {
  stock_qty: number;
};

export type ProductListResponse = {
  products: Product[];
};

/** Synced sales read model shell (populated later by AcceptCompleteSale). */
export type SalesListItem = {
  sale_id: string;
  completed_at: string;
  amount_minor: number;
};

export type SalesListResponse = {
  sales: SalesListItem[];
  daily_total_minor: number;
};

/** Immutable local sale sent by Cashier after receipt confirmation. */
export type SyncSaleRequest = {
  sale_id: string;
  device_id: string;
  completed_at: string;
  payment: {
    method: "cash";
    amount_minor: number;
  };
  lines: Array<{
    product_id: string;
    qty: number;
    price_minor: number;
  }>;
};

export type SyncSaleResponse = {
  sale_id: string;
  accepted: true;
  already_accepted: boolean;
};
