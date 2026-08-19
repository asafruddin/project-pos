/** Shared auth / catalog DTOs for API + Dashboard. */

export type PlaceholderId = string;

/** Account roles — AD-11 / FR-32 / FR-99. `catalog_admin` is Admin (FR-103). */
export type Role =
  | "owner"
  | "catalog_admin"
  | "store_manager"
  | "supervisor"
  | "cashier"
  | "inventory_staff"
  | "purchasing_staff";

export const ACCOUNT_ROLES: readonly Role[] = [
  "owner",
  "catalog_admin",
  "store_manager",
  "supervisor",
  "cashier",
  "inventory_staff",
  "purchasing_staff",
];

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  catalog_admin: "Admin",
  store_manager: "Store Manager",
  supervisor: "Supervisor",
  cashier: "Cashier",
  inventory_staff: "Inventory Staff",
  purchasing_staff: "Purchasing Staff",
};

export function hasPermission(
  grants: string[] | undefined,
  resource: string,
  action: string,
): boolean {
  if (!Array.isArray(grants) || grants.length === 0) return false;
  if (grants.includes("*:*") || grants.includes(`${resource}:*`)) return true;
  return grants.includes(`${resource}:${action}`);
}

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
  permissions: string[];
  store_id: string;
};

export type AuthMeResponse = {
  user_id: string;
  role: Role;
  permissions: string[];
  store_id: string;
  active: boolean;
};

export type UserAccount = {
  user_id: string;
  username: string;
  role: Role;
  store_id: string;
  active: boolean;
  created_at: string;
};

export type UserListResponse = {
  users: UserAccount[];
};

export type CreateUserRequest = {
  username: string;
  password: string;
  role: Role;
  store_id: string;
};

export type UpdateUserRequest = {
  role?: Role;
  store_id?: string;
  active?: boolean;
  password?: string;
};

export type RolePermissionsResponse = {
  roles: Array<{
    role: Role;
    label: string;
    permissions: string[];
  }>;
};

export type ReplaceRolePermissionsRequest = {
  permissions: Array<{ resource: string; action: string }>;
};

export type ApiErrorBody = {
  code: string;
  message: string;
};

export type ProductStatus = "active" | "inactive";

export type ProductImage = {
  image_id: string;
  product_id: string;
  public_id: string;
  secure_url: string;
  width?: number | null;
  height?: number | null;
  format?: string | null;
  bytes?: number | null;
  alt_text?: string | null;
  sort_order: number;
  is_primary: boolean;
};

/** Explicit Pack→pcs (or similar) link on the destination (pcs) product. */
export type ProductUnitConversion = {
  conversion_id: string;
  from_product_id: string;
  from_product_name: string;
  from_unit_name: string | null;
  from_stock_qty: number;
  from_qty: number;
  to_qty: number;
};

export type UpsertUnitConversionRequest = {
  from_product_id: string;
  /** Packs opened per conversion; default 1. */
  from_qty?: number;
  /** Pcs gained per from_qty. */
  to_qty: number;
};

export type UnpackUnitRequest = {
  /** How many pack units to open; default 1. */
  pack_qty?: number;
};

export type UnpackUnitResponse = {
  from_product_id: string;
  to_product_id: string;
  from_stock_qty: number;
  to_stock_qty: number;
  from_delta: number;
  to_delta: number;
};

/** Phase 1: integer rupiah (Rp) — no fractional subunit. */
export type Product = {
  product_id: string;
  name: string;
  price_minor: number;
  stock_qty: number;
  sku?: string | null;
  barcode?: string | null;
  description?: string | null;
  status: ProductStatus;
  cost_minor?: number | null;
  compare_at_minor?: number | null;
  min_qty?: number | null;
  max_qty?: number | null;
  track_stock: boolean;
  parent_id?: string | null;
  category_id?: string | null;
  category_name?: string | null;
  brand_id?: string | null;
  brand_name?: string | null;
  unit_id?: string | null;
  unit_name?: string | null;
  /** Present when this product is the pcs (destination) of a conversion pair. */
  unit_conversion?: ProductUnitConversion | null;
  tags: string[];
  images: ProductImage[];
  has_primary_image: boolean;
  created_at?: string;
  updated_at?: string;
};

export type CreateProductRequest = {
  name: string;
  price_minor: number;
  stock_qty: number;
  sku?: string | null;
  barcode?: string | null;
  description?: string | null;
  status?: ProductStatus;
  cost_minor?: number | null;
  compare_at_minor?: number | null;
  min_qty?: number | null;
  max_qty?: number | null;
  track_stock?: boolean;
  parent_id?: string | null;
  category_name?: string | null;
  brand_name?: string | null;
  unit_name?: string | null;
  tags?: string[];
};

export type UpdateProductRequest = {
  name?: string;
  price_minor?: number;
  sku?: string | null;
  barcode?: string | null;
  description?: string | null;
  status?: ProductStatus;
  cost_minor?: number | null;
  compare_at_minor?: number | null;
  min_qty?: number | null;
  max_qty?: number | null;
  track_stock?: boolean;
  parent_id?: string | null;
  category_name?: string | null;
  brand_name?: string | null;
  unit_name?: string | null;
  tags?: string[];
};

export type CategoryRecord = {
  category_id: string;
  store_id: string;
  name: string;
  created_at: string;
};

export type CategoryListResponse = {
  categories: CategoryRecord[];
};

export type CreateCategoryRequest = {
  name: string;
};

export type UpdateCategoryRequest = {
  name: string;
};

export type UnitRecord = {
  unit_id: string;
  store_id: string;
  name: string;
  created_at: string;
};

export type UnitListResponse = {
  units: UnitRecord[];
};

export type CreateUnitRequest = {
  name: string;
};

export type UpdateUnitRequest = {
  name: string;
};

/** Phase 1 tenancy stub (AD-19). */
export const STORE_1_ID = "00000000-0000-4000-8000-000000000001";
export const REGISTER_1_ID = "00000000-0000-4000-8000-000000000002";
export const LOYALTY_PROGRAM_1_ID = "00000000-0000-4000-8000-0000000000a1";

export type StockBucket = "sellable" | "damaged" | "in_transit";

export type StockMovement = {
  movement_id: string;
  product_id: string;
  store_id: string;
  qty_delta: number;
  bucket: StockBucket;
  reason: string;
  source_type: string;
  source_id: string | null;
  actor_id: string | null;
  at: string;
};

export type AdjustStockRequest = {
  stock_qty: number;
  reason: string;
};

export type MarkDamagedRequest = {
  qty: number;
  reason: string;
};

export type StockOverviewItem = {
  product_id: string;
  name: string;
  sku: string | null;
  min_qty: number | null;
  track_stock: boolean;
  sellable_qty: number;
  damaged_qty: number;
  in_transit_qty: number;
  is_low: boolean;
  is_out: boolean;
};

export type StockOverviewResponse = {
  store_id: string;
  products: StockOverviewItem[];
};

export type StoreRecord = {
  store_id: string;
  name: string;
  created_at: string;
};

export type RegisterRecord = {
  register_id: string;
  store_id: string;
  name: string;
  created_at: string;
};

export type StoreListResponse = {
  stores: StoreRecord[];
  registers: RegisterRecord[];
};

export type CreateStoreRequest = {
  name: string;
};

export type CreateRegisterRequest = {
  store_id: string;
  name: string;
};

export type StorePrice = {
  store_id: string;
  product_id: string;
  price_minor: number | null;
};

export type SetStorePriceRequest = {
  store_id: string;
  product_id: string;
  price_minor: number | null;
};

export type StockTransferStatus =
  | "draft"
  | "requested"
  | "approved"
  | "preparing"
  | "shipped"
  | "received"
  | "completed"
  | "cancelled";

export type StockTransferLine = {
  product_id: string;
  name?: string;
  qty: number;
};

export type StockTransfer = {
  transfer_id: string;
  from_store_id: string;
  to_store_id: string;
  status: StockTransferStatus;
  lines: StockTransferLine[];
  created_at: string;
  updated_at: string;
};

export type StockTransferListResponse = {
  transfers: StockTransfer[];
};

export type CreateStockTransferRequest = {
  from_store_id: string;
  to_store_id: string;
  lines: Array<{ product_id: string; qty: number }>;
};

export type TransitionStockTransferRequest = {
  status: StockTransferStatus;
};

export type OpnameStatus = "draft" | "approved" | "rejected" | "cancelled";

export type CreateOpnameRequest = {
  product_ids: string[];
};

export type SaveOpnameCountsRequest = {
  lines: Array<{ product_id: string; counted_qty: number }>;
};

export type OpnameLine = {
  product_id: string;
  name: string;
  sku: string | null;
  system_qty: number;
  counted_qty: number | null;
  variance: number | null;
};

export type OpnameDetail = {
  opname_id: string;
  store_id: string;
  status: OpnameStatus;
  created_at: string;
  decided_at: string | null;
  lines: OpnameLine[];
};

export type OpnameListItem = {
  opname_id: string;
  status: OpnameStatus;
  created_at: string;
  product_count: number;
};

export type OpnameListResponse = {
  opnames: OpnameListItem[];
};

export type PurchaseOrderStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "partially_received"
  | "completed"
  | "cancelled";

export type SupplierProduct = {
  product_id: string;
  name: string;
  cost_minor: number | null;
};

export type SupplierPoHistoryItem = {
  po_id: string;
  status: PurchaseOrderStatus;
  created_at: string;
};

export type Supplier = {
  supplier_id: string;
  name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  payment_terms: string | null;
  notes: string | null;
  products: SupplierProduct[];
  purchase_orders: SupplierPoHistoryItem[];
  created_at: string;
  updated_at: string;
};

export type SupplierListResponse = {
  suppliers: Array<Omit<Supplier, "products" | "purchase_orders">>;
};

export type CreateSupplierRequest = {
  name: string;
  contact_name?: string | null;
  phone?: string | null;
  email?: string | null;
  payment_terms?: string | null;
  notes?: string | null;
  products?: Array<{ product_id: string; cost_minor?: number | null }>;
};

export type UpdateSupplierRequest = Partial<CreateSupplierRequest>;

export type PurchaseOrderLine = {
  product_id: string;
  name: string;
  qty: number;
  cost_minor: number;
  received_qty: number;
};

export type PaymentStatus = "unpaid" | "partial" | "paid";

export type PurchaseOrderDetail = {
  po_id: string;
  store_id: string;
  supplier_id: string;
  supplier_name: string;
  status: PurchaseOrderStatus;
  created_by: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  approved_by: string | null;
  created_at: string;
  invoice_ref: string | null;
  payment_status: PaymentStatus;
  lines: PurchaseOrderLine[];
};

export type PurchaseOrderListItem = {
  po_id: string;
  supplier_id: string;
  supplier_name: string;
  status: PurchaseOrderStatus;
  created_at: string;
  line_count: number;
};

export type PurchaseOrderListResponse = {
  purchase_orders: PurchaseOrderListItem[];
};

export type CreatePurchaseOrderRequest = {
  supplier_id: string;
  lines?: Array<{ product_id: string; qty: number; cost_minor: number }>;
};

export type SavePurchaseOrderLinesRequest = {
  lines: Array<{ product_id: string; qty: number; cost_minor: number }>;
};

export type ReceiveGoodsRequest = {
  lines: Array<{ product_id: string; qty: number }>;
};

export type UpdatePoInvoiceRequest = {
  invoice_ref?: string | null;
  payment_status?: PaymentStatus;
};

export type ProductListMeta = {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
};

export type ProductListResponse = {
  products: Product[];
  meta: ProductListMeta;
};

/** Synced sales read model shell (populated later by AcceptCompleteSale). */
export type SalesListItem = {
  sale_id: string;
  completed_at: string;
  amount_minor: number;
  voided_at?: string | null;
};

export type SalesListResponse = {
  sales: SalesListItem[];
  daily_total_minor: number;
};

export type TenderMethod = "cash" | "store_credit";
export type PaymentMethod = "cash" | "store_credit" | "split";

export type SaleTender = {
  method: TenderMethod;
  amount_minor: number;
};

export type SalePayment = {
  method: PaymentMethod;
  amount_minor: number;
  tenders?: SaleTender[];
};

export type PriceOverride = {
  product_id: string;
  price_minor: number;
};

export type SetCustomerPriceRequest = {
  product_id: string;
  price_minor: number | null;
};

export type SetGroupPriceRequest = {
  group_name: string;
  product_id: string;
  price_minor: number | null;
};

/** Immutable local sale sent by Cashier after receipt confirmation. */
export type SyncSaleRequest = {
  sale_id: string;
  device_id: string;
  completed_at: string;
  payment: SalePayment;
  lines: Array<{
    product_id: string;
    qty: number;
    price_minor: number;
  }>;
  /** Optional attach (FR-71). Missing/unknown never blocks AcceptCompleteSale. */
  customer_id?: string | null;
  /** Required after 2C (AD-16 / FR-75). */
  shift_id?: string | null;
  /** Optional Loyalty redeem snapshot. Earn is computed on the server after Sync. */
  loyalty?: {
    redeem_points?: number;
    discount_minor?: number;
  } | null;
  /** Optional sale-level promo / voucher / manager discount (AD-10). */
  promotions?: {
    discount_minor?: number;
    coupon_code?: string | null;
    voucher_code?: string | null;
    voucher_minor?: number;
    manager_discount_minor?: number;
    applied?: Array<{
      promotion_id: string;
      name: string;
      discount_minor: number;
    }>;
  } | null;
};

export type SyncSaleResponse = {
  sale_id: string;
  accepted: true;
  already_accepted: boolean;
};

/** Local-first same-day Void (AD-14 / FR-63). */
export type SyncVoidRequest = {
  void_id: string;
  sale_id: string;
  voided_at: string;
};

export type SyncVoidResponse = {
  void_id: string;
  sale_id: string;
  accepted: true;
  already_accepted: boolean;
};

export type ReturnDecision = "resellable" | "damaged" | "warranty";
export type ReturnStatus = "open" | "refunded";

export type SaleLookupLine = {
  product_id: string;
  name: string | null;
  qty: number;
  price_minor: number;
  returned_qty: number;
};

export type SaleLookupResponse = {
  sale_id: string;
  completed_at: string;
  amount_minor: number;
  voided_at: string | null;
  lines: SaleLookupLine[];
};

export type CreateReturnRequest = {
  reason: string;
  lines: Array<{
    product_id: string;
    qty: number;
    decision: ReturnDecision;
  }>;
  exchange_sale_id?: string | null;
};

export type ReturnLine = {
  product_id: string;
  name: string | null;
  qty: number;
  decision: ReturnDecision;
  price_minor: number;
};

export type ReturnDetail = {
  return_id: string;
  sale_id: string;
  reason: string;
  status: ReturnStatus;
  amount_minor: number;
  refund_amount_minor: number | null;
  refunded_at: string | null;
  exchange_sale_id: string | null;
  lines: ReturnLine[];
  created_at: string;
};

export type ReturnListResponse = {
  returns: ReturnDetail[];
};

export type RefundReturnRequest = {
  amount_minor: number;
};

export type LinkExchangeSaleRequest = {
  exchange_sale_id: string;
};

export type Customer = {
  customer_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  group_name: string | null;
  store_credit_minor: number;
  price_overrides: PriceOverride[];
  group_price_overrides: PriceOverride[];
  loyalty_points: number;
  loyalty_tier: string | null;
  loyalty_lifetime_earned: number;
  created_at: string;
  updated_at: string;
};

export type CustomerListResponse = {
  customers: Customer[];
};

export type CustomerGroupListResponse = {
  groups: string[];
};

export type CreateCustomerRequest = {
  customer_id?: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  group_name?: string | null;
  store_credit_minor?: number;
};

export type UpdateCustomerRequest = {
  name?: string;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  group_name?: string | null;
  store_credit_minor?: number;
};

export type CreateCustomerResponse = {
  customer: Customer;
  warnings: Array<"DUPLICATE_PHONE">;
  already_accepted: boolean;
};

export type CustomerHistorySale = {
  sale_id: string;
  completed_at: string;
  amount_minor: number;
  voided_at: string | null;
};

export type CustomerHistoryReturn = {
  return_id: string;
  sale_id: string;
  status: ReturnStatus;
  amount_minor: number;
  created_at: string;
};

export type CustomerHistoryResponse = {
  customer: Customer;
  sales: CustomerHistorySale[];
  returns: CustomerHistoryReturn[];
  total_spend_minor: number;
};

export type ShiftStatus = "open" | "closed";

export type Shift = {
  shift_id: string;
  store_id: string;
  register_id: string;
  opened_at: string;
  opening_cash_minor: number;
  status: ShiftStatus;
  closed_at: string | null;
  counted_cash_minor: number | null;
  expected_cash_minor: number | null;
  difference_minor: number | null;
  actor_id?: string | null;
  actor_login?: string | null;
};

export type OpenShiftRequest = {
  shift_id: string;
  opened_at: string;
  opening_cash_minor: number;
};

export type OpenShiftResponse = {
  shift: Shift;
  already_accepted: boolean;
};

export type CurrentShiftResponse = {
  shift: Shift | null;
};

export type ShiftCashKind = "in" | "out";

export type ShiftCashMovement = {
  movement_id: string;
  shift_id: string;
  kind: ShiftCashKind;
  amount_minor: number;
  reason: string;
  occurred_at: string;
};

export type RecordCashMovementRequest = {
  movement_id: string;
  kind: ShiftCashKind;
  amount_minor: number;
  reason: string;
  occurred_at: string;
};

export type RecordCashMovementResponse = {
  movement: ShiftCashMovement;
  already_accepted: boolean;
};

export type CloseShiftRequest = {
  closed_at: string;
  counted_cash_minor: number;
  expected_cash_minor: number;
};

export type CloseShiftResponse = {
  shift: Shift;
  already_accepted: boolean;
  warned: boolean;
};

export type ShiftExpectedCash = {
  opening_cash_minor: number;
  cash_sales_minor: number;
  cash_in_minor: number;
  cash_out_minor: number;
  cash_refunds_minor: number;
  cash_voids_minor: number;
  expected_cash_minor: number;
};

export type ShiftListResponse = {
  shifts: Shift[];
};

export type ShiftDetailResponse = {
  shift: Shift;
  expected: ShiftExpectedCash;
  movements: ShiftCashMovement[];
};

export type LoyaltyTierRule = {
  name: string;
  min_lifetime_points: number;
  earn_multiplier_bps: number;
};

export type LoyaltyProgram = {
  program_id: string;
  enabled: boolean;
  earn_per_minor: number;
  point_value_minor: number;
  expire_days: number | null;
  tiers: LoyaltyTierRule[];
  updated_at: string;
};

export type UpdateLoyaltyProgramRequest = {
  enabled?: boolean;
  earn_per_minor?: number;
  point_value_minor?: number;
  expire_days?: number | null;
  tiers?: LoyaltyTierRule[];
};

export type LoyaltyLedgerEntry = {
  entry_id: string;
  customer_id: string;
  kind: "earn" | "redeem" | "expire" | "adjust" | "void_earn" | "void_redeem";
  points_delta: number;
  sale_id: string | null;
  note: string | null;
  occurred_at: string;
};

export type LoyaltyAccount = {
  customer_id: string;
  points_balance: number;
  lifetime_earned: number;
  tier: string | null;
  ledger: LoyaltyLedgerEntry[];
};

export type PromotionKind = "percent" | "fixed";

export type Promotion = {
  promotion_id: string;
  name: string;
  enabled: boolean;
  kind: PromotionKind;
  percent_bps: number | null;
  fixed_minor: number | null;
  coupon_code: string | null;
  exclusive: boolean;
  min_subtotal_minor: number | null;
  customer_group: string | null;
  product_ids: string[];
  starts_at: string | null;
  ends_at: string | null;
  hour_start: number | null;
  hour_end: number | null;
  updated_at: string;
};

export type PromotionListResponse = {
  promotions: Promotion[];
};

export type UpsertPromotionRequest = {
  name: string;
  enabled?: boolean;
  kind: PromotionKind;
  percent_bps?: number | null;
  fixed_minor?: number | null;
  coupon_code?: string | null;
  exclusive?: boolean;
  min_subtotal_minor?: number | null;
  customer_group?: string | null;
  product_ids?: string[];
  starts_at?: string | null;
  ends_at?: string | null;
  hour_start?: number | null;
  hour_end?: number | null;
};

export type Voucher = {
  voucher_id: string;
  code: string;
  remaining_minor: number;
  enabled: boolean;
  updated_at: string;
};

export type VoucherListResponse = {
  vouchers: Voucher[];
};

export type UpsertVoucherRequest = {
  code: string;
  remaining_minor: number;
  enabled?: boolean;
};

/** Online-first Dashboard reports (FR-93–FR-97). COGS fields omitted for cashier-only. */
export type ReportSummary = {
  store_id: string;
  from: string;
  to: string;
  revenue_minor: number;
  txn_count: number;
  units: number;
  aov_minor: number;
  discount_minor: number;
  refund_minor: number;
  net_minor: number;
  cogs_minor?: number;
  gross_profit_minor?: number;
  tax_minor?: number;
  fees_minor?: number;
};

export type ReportProductRow = {
  product_id: string;
  name: string;
  status: ProductStatus;
  units: number;
  revenue_minor: number;
  cogs_minor?: number;
  margin_minor?: number;
};

export type ReportProductsResponse = {
  store_id: string;
  from: string;
  to: string;
  top: ReportProductRow[];
  slow: ReportProductRow[];
};

export type ReportMovementRow = {
  reason: string;
  qty_delta: number;
};

export type ReportOpnameVariance = {
  opname_id: string;
  variance: number;
};

export type ReportDeadStockRow = {
  product_id: string;
  name: string;
  sellable_qty: number;
};

export type ReportInventoryResponse = {
  store_id: string;
  from: string;
  to: string;
  stock_value_minor: number;
  movements: ReportMovementRow[];
  opname_variances: ReportOpnameVariance[];
  dead_stock: ReportDeadStockRow[];
};

export type ReportCashierRow = {
  cashier_id: string | null;
  cashier_username: string | null;
  shift_id: string | null;
  revenue_minor: number;
  txn_count: number;
  refund_minor: number;
};

export type ReportCashiersResponse = {
  store_id: string;
  from: string;
  to: string;
  cashiers: ReportCashierRow[];
};

