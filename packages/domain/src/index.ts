import type { StockBucket } from "@pos-apps/types";

/**
 * Set absolute server Stock qty (AD-4 AdjustStock — not Sale Sync).
 * Pure function: no DB / HTTP / Nest.
 */
export type AdjustStockInput = {
  currentQty: number;
  targetQty: number;
  reason: string;
};
export type AdjustStockOk = {
  ok: true;
  stock_qty: number;
  qty_delta: number;
  reason: string;
};
export type AdjustStockErr = {
  ok: false;
  code: "CATALOG_INVALID_STOCK" | "CATALOG_STOCK_REASON_REQUIRED";
  message: string;
};
export type AdjustStockResult = AdjustStockOk | AdjustStockErr;

export function adjustStock(input: AdjustStockInput): AdjustStockResult {
  const reason = input.reason.trim();
  if (!reason) {
    return {
      ok: false,
      code: "CATALOG_STOCK_REASON_REQUIRED",
      message: "Alasan stok wajib diisi.",
    };
  }
  if (!Number.isInteger(input.currentQty) || !Number.isInteger(input.targetQty)) {
    return {
      ok: false,
      code: "CATALOG_INVALID_STOCK",
      message: "Stok harus bilangan bulat ≥ 0.",
    };
  }
  if (input.targetQty < 0) {
    return {
      ok: false,
      code: "CATALOG_INVALID_STOCK",
      message: "Stok harus bilangan bulat ≥ 0.",
    };
  }
  return {
    ok: true,
    stock_qty: input.targetQty,
    qty_delta: input.targetQty - input.currentQty,
    reason,
  };
}

const BUCKETS: ReadonlySet<string> = new Set(["sellable", "damaged", "in_transit"]);

export type PostStockMovementInput = {
  qty_delta: number;
  bucket: string;
  reason: string;
};
export type PostStockMovementOk = {
  ok: true;
  qty_delta: number;
  bucket: StockBucket;
  reason: string;
};
export type PostStockMovementErr = {
  ok: false;
  code: "STOCK_INVALID_MOVEMENT";
  message: string;
};
export type PostStockMovementResult = PostStockMovementOk | PostStockMovementErr;

/** Validates a ledger movement before persistence (AD-5 / AD-13). */
export function postStockMovement(
  input: PostStockMovementInput,
): PostStockMovementResult {
  const reason = input.reason.trim();
  if (!reason) {
    return {
      ok: false,
      code: "STOCK_INVALID_MOVEMENT",
      message: "Alasan stok wajib diisi.",
    };
  }
  if (!Number.isInteger(input.qty_delta)) {
    return {
      ok: false,
      code: "STOCK_INVALID_MOVEMENT",
      message: "Perubahan stok harus bilangan bulat.",
    };
  }
  if (!BUCKETS.has(input.bucket)) {
    return {
      ok: false,
      code: "STOCK_INVALID_MOVEMENT",
      message: "Bucket stok tidak valid.",
    };
  }
  return {
    ok: true,
    qty_delta: input.qty_delta,
    bucket: input.bucket as StockBucket,
    reason,
  };
}

export type StockTransferStatus =
  | "draft"
  | "requested"
  | "approved"
  | "preparing"
  | "shipped"
  | "received"
  | "completed"
  | "cancelled";

const TRANSFER_TRANSITIONS: Record<
  StockTransferStatus,
  StockTransferStatus[]
> = {
  draft: ["requested", "cancelled"],
  requested: ["approved", "cancelled"],
  approved: ["preparing", "cancelled"],
  preparing: ["shipped"],
  shipped: ["received"],
  received: ["completed"],
  completed: [],
  cancelled: [],
};

const TRANSFER_STATUSES = new Set<string>(Object.keys(TRANSFER_TRANSITIONS));

export type TransferLine = { product_id: string; qty: number };
export type TransferMovement = {
  store_id: string;
  product_id: string;
  qty_delta: number;
  bucket: StockBucket;
  reason: string;
};

/** Closed Stock Transfer status machine (FR-107). */
export function transitionStockTransfer(input: {
  from: string;
  to: string;
}):
  | { ok: true; status: StockTransferStatus }
  | { ok: false; code: "TRANSFER_INVALID_STATUS"; message: string } {
  if (!TRANSFER_STATUSES.has(input.from) || !TRANSFER_STATUSES.has(input.to)) {
    return {
      ok: false,
      code: "TRANSFER_INVALID_STATUS",
      message: "Status transfer stok tidak valid.",
    };
  }
  const from = input.from as StockTransferStatus;
  const to = input.to as StockTransferStatus;
  if (!TRANSFER_TRANSITIONS[from].includes(to)) {
    return {
      ok: false,
      code: "TRANSFER_INVALID_STATUS",
      message: "Status transfer stok tidak valid.",
    };
  }
  return { ok: true, status: to };
}

export function validateTransferLines(
  lines: TransferLine[],
):
  | { ok: true; lines: TransferLine[] }
  | { ok: false; code: "TRANSFER_INVALID_LINE"; message: string } {
  if (!lines.length) {
    return {
      ok: false,
      code: "TRANSFER_INVALID_LINE",
      message: "Transfer harus punya minimal satu item.",
    };
  }
  const seen = new Set<string>();
  const cleaned: TransferLine[] = [];
  for (const line of lines) {
    if (!line.product_id?.trim()) {
      return {
        ok: false,
        code: "TRANSFER_INVALID_LINE",
        message: "Produk transfer tidak valid.",
      };
    }
    if (seen.has(line.product_id)) {
      return {
        ok: false,
        code: "TRANSFER_INVALID_LINE",
        message: "Produk transfer duplikat.",
      };
    }
    seen.add(line.product_id);
    if (!Number.isInteger(line.qty) || line.qty < 1) {
      return {
        ok: false,
        code: "TRANSFER_INVALID_LINE",
        message: "Jumlah transfer harus bilangan bulat ≥ 1.",
      };
    }
    cleaned.push({ product_id: line.product_id, qty: line.qty });
  }
  return { ok: true, lines: cleaned };
}

function transferStoresOk(fromStore: string, toStore: string): boolean {
  return Boolean(fromStore.trim() && toStore.trim() && fromStore !== toStore);
}

/** OUT sellable at A + IN in-transit at B (FR-108). */
export function shipTransfer(input: {
  from_store_id: string;
  to_store_id: string;
  lines: TransferLine[];
}):
  | { ok: true; movements: TransferMovement[] }
  | {
      ok: false;
      code: "TRANSFER_INVALID_LINE" | "TRANSFER_INVALID_STORE";
      message: string;
    } {
  if (!transferStoresOk(input.from_store_id, input.to_store_id)) {
    return {
      ok: false,
      code: "TRANSFER_INVALID_STORE",
      message: "Toko asal dan tujuan harus berbeda.",
    };
  }
  const lines = validateTransferLines(input.lines);
  if (!lines.ok) return lines;
  const movements: TransferMovement[] = [];
  for (const line of lines.lines) {
    movements.push({
      store_id: input.from_store_id,
      product_id: line.product_id,
      qty_delta: -line.qty,
      bucket: "sellable",
      reason: "transfer_ship",
    });
    movements.push({
      store_id: input.to_store_id,
      product_id: line.product_id,
      qty_delta: line.qty,
      bucket: "in_transit",
      reason: "transfer_ship",
    });
  }
  return { ok: true, movements };
}

/** OUT in-transit at B + IN sellable at B (FR-108). */
export function receiveTransfer(input: {
  from_store_id: string;
  to_store_id: string;
  lines: TransferLine[];
}):
  | { ok: true; movements: TransferMovement[] }
  | {
      ok: false;
      code: "TRANSFER_INVALID_LINE" | "TRANSFER_INVALID_STORE";
      message: string;
    } {
  if (!transferStoresOk(input.from_store_id, input.to_store_id)) {
    return {
      ok: false,
      code: "TRANSFER_INVALID_STORE",
      message: "Toko asal dan tujuan harus berbeda.",
    };
  }
  const lines = validateTransferLines(input.lines);
  if (!lines.ok) return lines;
  const movements: TransferMovement[] = [];
  for (const line of lines.lines) {
    movements.push({
      store_id: input.to_store_id,
      product_id: line.product_id,
      qty_delta: -line.qty,
      bucket: "in_transit",
      reason: "transfer_receive",
    });
    movements.push({
      store_id: input.to_store_id,
      product_id: line.product_id,
      qty_delta: line.qty,
      bucket: "sellable",
      reason: "transfer_receive",
    });
  }
  return { ok: true, movements };
}

/** STOCK OUT sellable + STOCK IN damaged (FR-47). Qty must be an integer ≥ 1. */
export function markDamaged(input: {
  qty: number;
  reason: string;
}):
  | { ok: true; qty: number; reason: string }
  | { ok: false; code: "STOCK_INVALID_MOVEMENT"; message: string } {
  const reason = input.reason.trim();
  if (!reason) {
    return {
      ok: false,
      code: "STOCK_INVALID_MOVEMENT",
      message: "Alasan stok wajib diisi.",
    };
  }
  if (!Number.isInteger(input.qty) || input.qty < 1) {
    return {
      ok: false,
      code: "STOCK_INVALID_MOVEMENT",
      message: "Jumlah rusak harus bilangan bulat ≥ 1.",
    };
  }
  return { ok: true, qty: input.qty, reason };
}

/** Approve opname: counted becomes sellable (AD-4 ApplyOpname). */
export function applyOpname(input: {
  lines: Array<{
    product_id: string;
    counted_qty: number;
    current_qty: number;
  }>;
}):
  | {
      ok: true;
      adjustments: Array<{
        product_id: string;
        counted_qty: number;
        current_qty: number;
        qty_delta: number;
      }>;
    }
  | { ok: false; code: "OPNAME_INVALID"; message: string } {
  if (!input.lines.length) {
    return {
      ok: false,
      code: "OPNAME_INVALID",
      message: "Pilih minimal satu produk.",
    };
  }
  const seen = new Set<string>();
  const adjustments: Array<{
    product_id: string;
    counted_qty: number;
    current_qty: number;
    qty_delta: number;
  }> = [];
  for (const line of input.lines) {
    if (!line.product_id?.trim()) {
      return {
        ok: false,
        code: "OPNAME_INVALID",
        message: "Produk opname tidak valid.",
      };
    }
    if (seen.has(line.product_id)) {
      return {
        ok: false,
        code: "OPNAME_INVALID",
        message: "Produk opname duplikat.",
      };
    }
    seen.add(line.product_id);
    if (!Number.isInteger(line.counted_qty) || line.counted_qty < 0) {
      return {
        ok: false,
        code: "OPNAME_INVALID",
        message: "Jumlah hitung harus bilangan bulat ≥ 0.",
      };
    }
    if (!Number.isInteger(line.current_qty)) {
      return {
        ok: false,
        code: "OPNAME_INVALID",
        message: "Jumlah sistem harus bilangan bulat.",
      };
    }
    adjustments.push({
      product_id: line.product_id,
      counted_qty: line.counted_qty,
      current_qty: line.current_qty,
      qty_delta: line.counted_qty - line.current_qty,
    });
  }
  return { ok: true, adjustments };
}

export function isPlaceholderId(id: string): boolean {
  return typeof id === "string" && id.length > 0;
}

export type StockForSale = { product_id: string; stock_qty: number };
export type SaleStockLine = { product_id: string; qty: number };
export type AcceptCompleteSaleResult =
  | { ok: true; products: StockForSale[]; warned?: true }
  | {
      ok: false;
      code: "SALE_INVALID_LINE" | "SALE_PRODUCT_NOT_FOUND";
      message: string;
    };

/**
 * Validates a sale and returns the resulting stock snapshot without side effects.
 * Callers must persist the returned values atomically with their sale record.
 * Insufficient qty is a warning — Instant Checkout / Sync never fail-closes on stock (AD-4).
 */
export function acceptCompleteSale(
  products: StockForSale[],
  lines: SaleStockLine[],
): AcceptCompleteSaleResult {
  if (lines.length === 0) {
    return { ok: false, code: "SALE_INVALID_LINE", message: "Penjualan harus memiliki item." };
  }

  const requested = new Map<string, number>();
  for (const line of lines) {
    if (
      typeof line.product_id !== "string" ||
      !line.product_id ||
      !Number.isInteger(line.qty) ||
      line.qty <= 0
    ) {
      return { ok: false, code: "SALE_INVALID_LINE", message: "Item penjualan tidak valid." };
    }
    requested.set(line.product_id, (requested.get(line.product_id) ?? 0) + line.qty);
  }

  const byId = new Map(products.map((product) => [product.product_id, product]));
  let warned = false;
  for (const [productId, qty] of requested) {
    const product = byId.get(productId);
    if (!product) {
      return { ok: false, code: "SALE_PRODUCT_NOT_FOUND", message: "Produk tidak ditemukan." };
    }
    if (!Number.isInteger(product.stock_qty)) {
      return { ok: false, code: "SALE_INVALID_LINE", message: "Item penjualan tidak valid." };
    }
    if (product.stock_qty < qty) {
      warned = true;
    }
  }

  const result: Extract<AcceptCompleteSaleResult, { ok: true }> = {
    ok: true,
    products: products.map((product) => {
      const qty = requested.get(product.product_id) ?? 0;
      return { ...product, stock_qty: product.stock_qty - qty };
    }),
  };
  if (warned) {
    result.warned = true;
  }
  return result;
}

export type PurchaseOrderStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "partially_received"
  | "completed"
  | "cancelled";

const PO_TRANSITIONS: Record<PurchaseOrderStatus, PurchaseOrderStatus[]> = {
  draft: ["submitted", "cancelled"],
  submitted: ["approved", "cancelled"],
  approved: ["partially_received", "completed"],
  partially_received: ["completed"],
  completed: [],
  cancelled: [],
};

const PO_STATUSES = new Set<string>(Object.keys(PO_TRANSITIONS));

/** Closed PO status machine (FR-56). Receive transitions are 5.2. */
export function transitionPurchaseOrder(input: {
  from: string;
  to: string;
}):
  | { ok: true; status: PurchaseOrderStatus }
  | { ok: false; code: "PO_INVALID_TRANSITION"; message: string } {
  if (!PO_STATUSES.has(input.from) || !PO_STATUSES.has(input.to)) {
    return {
      ok: false,
      code: "PO_INVALID_TRANSITION",
      message: "Status pesanan pembelian tidak valid.",
    };
  }
  const from = input.from as PurchaseOrderStatus;
  const to = input.to as PurchaseOrderStatus;
  if (!PO_TRANSITIONS[from].includes(to)) {
    return {
      ok: false,
      code: "PO_INVALID_TRANSITION",
      message: "Status pesanan pembelian tidak valid.",
    };
  }
  return { ok: true, status: to };
}

export function validatePurchaseOrderLines(
  lines: Array<{ product_id: string; qty: number; cost_minor: number }>,
):
  | {
      ok: true;
      lines: Array<{ product_id: string; qty: number; cost_minor: number }>;
    }
  | { ok: false; code: "PO_INVALID_LINE"; message: string } {
  if (!lines.length) {
    return {
      ok: false,
      code: "PO_INVALID_LINE",
      message: "Pesanan harus punya minimal satu item.",
    };
  }
  const seen = new Set<string>();
  const cleaned: Array<{ product_id: string; qty: number; cost_minor: number }> =
    [];
  for (const line of lines) {
    if (!line.product_id?.trim()) {
      return {
        ok: false,
        code: "PO_INVALID_LINE",
        message: "Produk pesanan tidak valid.",
      };
    }
    if (seen.has(line.product_id)) {
      return {
        ok: false,
        code: "PO_INVALID_LINE",
        message: "Produk pesanan duplikat.",
      };
    }
    seen.add(line.product_id);
    if (!Number.isInteger(line.qty) || line.qty < 1) {
      return {
        ok: false,
        code: "PO_INVALID_LINE",
        message: "Jumlah pesanan harus bilangan bulat ≥ 1.",
      };
    }
    if (!Number.isInteger(line.cost_minor) || line.cost_minor < 0) {
      return {
        ok: false,
        code: "PO_INVALID_LINE",
        message: "Harga pokok harus bilangan bulat ≥ 0.",
      };
    }
    cleaned.push({
      product_id: line.product_id,
      qty: line.qty,
      cost_minor: line.cost_minor,
    });
  }
  return { ok: true, lines: cleaned };
}

/** Receive against an approved PO (AD-4 ReceiveGoods). */
export function receiveGoods(input: {
  po_status: string;
  po_lines: Array<{
    product_id: string;
    ordered_qty: number;
    received_qty: number;
  }>;
  receive: Array<{ product_id: string; qty: number }>;
}):
  | {
      ok: true;
      receipts: Array<{
        product_id: string;
        qty: number;
        received_qty: number;
      }>;
      status: PurchaseOrderStatus;
    }
  | {
      ok: false;
      code: "GR_INVALID" | "PO_NOT_RECEIVABLE";
      message: string;
    } {
  if (input.po_status !== "approved" && input.po_status !== "partially_received") {
    return {
      ok: false,
      code: "PO_NOT_RECEIVABLE",
      message: "Pesanan ini tidak bisa diterima.",
    };
  }
  if (!input.receive.length) {
    return {
      ok: false,
      code: "GR_INVALID",
      message: "Isi minimal satu jumlah terima.",
    };
  }
  const byProduct = new Map(
    input.po_lines.map((line) => [line.product_id, { ...line }]),
  );
  const seen = new Set<string>();
  const receipts: Array<{
    product_id: string;
    qty: number;
    received_qty: number;
  }> = [];
  for (const item of input.receive) {
    if (!item.product_id?.trim()) {
      return {
        ok: false,
        code: "GR_INVALID",
        message: "Produk penerimaan tidak valid.",
      };
    }
    if (seen.has(item.product_id)) {
      return {
        ok: false,
        code: "GR_INVALID",
        message: "Produk penerimaan duplikat.",
      };
    }
    seen.add(item.product_id);
    if (!Number.isInteger(item.qty) || item.qty < 1) {
      return {
        ok: false,
        code: "GR_INVALID",
        message: "Jumlah terima harus bilangan bulat ≥ 1.",
      };
    }
    const line = byProduct.get(item.product_id);
    if (!line) {
      return {
        ok: false,
        code: "GR_INVALID",
        message: "Produk tidak ada pada pesanan ini.",
      };
    }
    const remaining = line.ordered_qty - line.received_qty;
    if (item.qty > remaining) {
      return {
        ok: false,
        code: "GR_INVALID",
        message: "Jumlah terima melebihi sisa pesanan.",
      };
    }
    line.received_qty += item.qty;
    receipts.push({
      product_id: item.product_id,
      qty: item.qty,
      received_qty: line.received_qty,
    });
  }
  const complete =
    input.po_lines.length > 0 &&
    [...byProduct.values()].every(
      (line) => line.received_qty >= line.ordered_qty,
    );
  return {
    ok: true,
    receipts,
    status: complete ? "completed" : "partially_received",
  };
}

export type PostVoidLine = { product_id: string; qty: number };

export type PostVoidInput = {
  sale_status: string;
  already_voided: boolean;
  already_returned: boolean;
  same_calendar_day: boolean;
  lines: PostVoidLine[];
};

export type PostVoidOk = { ok: true; lines: PostVoidLine[] };
export type PostVoidErr = {
  ok: false;
  code: "VOID_NOT_ALLOWED" | "VOID_INVALID";
  message: string;
};
export type PostVoidResult = PostVoidOk | PostVoidErr;

/**
 * Same-day reverse of a complete Sale (AD-2 / AD-4 PostVoid).
 * Incomplete cancel is not Void. Cash Expected Cash waits until Shift (Epic 6).
 */
export function postVoid(input: PostVoidInput): PostVoidResult {
  if (input.sale_status !== "complete") {
    return {
      ok: false,
      code: "VOID_NOT_ALLOWED",
      message: "Batal checkout bukan void. Hanya penjualan selesai yang dapat di-void.",
    };
  }
  if (input.already_voided) {
    return {
      ok: false,
      code: "VOID_NOT_ALLOWED",
      message: "Penjualan ini sudah di-void.",
    };
  }
  if (input.already_returned) {
    return {
      ok: false,
      code: "VOID_NOT_ALLOWED",
      message: "Penjualan ini sudah di-return.",
    };
  }
  if (!input.same_calendar_day) {
    return {
      ok: false,
      code: "VOID_NOT_ALLOWED",
      message: "Void hanya untuk penjualan hari ini.",
    };
  }
  if (!input.lines.length) {
    return {
      ok: false,
      code: "VOID_INVALID",
      message: "Penjualan harus memiliki item.",
    };
  }
  const lines: PostVoidLine[] = [];
  const seen = new Set<string>();
  for (const line of input.lines) {
    if (
      typeof line.product_id !== "string" ||
      !line.product_id ||
      !Number.isInteger(line.qty) ||
      line.qty < 1
    ) {
      return {
        ok: false,
        code: "VOID_INVALID",
        message: "Item void tidak valid.",
      };
    }
    if (seen.has(line.product_id)) {
      const existing = lines.find((row) => row.product_id === line.product_id);
      if (existing) existing.qty += line.qty;
    } else {
      seen.add(line.product_id);
      lines.push({ product_id: line.product_id, qty: line.qty });
    }
  }
  return { ok: true, lines };
}

export type ReturnDecision = "resellable" | "damaged" | "warranty";

const RETURN_DECISIONS: ReadonlySet<string> = new Set([
  "resellable",
  "damaged",
  "warranty",
]);

export type PostReturnLineInput = {
  product_id: string;
  sold_qty: number;
  already_returned_qty: number;
  return_qty: number;
  decision: string;
};

export type PostReturnMovement = {
  product_id: string;
  qty: number;
  bucket: "sellable" | "damaged";
};

export type PostReturnOk = {
  ok: true;
  movements: PostReturnMovement[];
  lines: Array<{
    product_id: string;
    qty: number;
    decision: ReturnDecision;
  }>;
};
export type PostReturnErr = {
  ok: false;
  code: "RETURN_NOT_ALLOWED" | "RETURN_INVALID";
  message: string;
};
export type PostReturnResult = PostReturnOk | PostReturnErr;

/**
 * Return of a complete Sale (AD-2 / AD-4 PostReturn).
 * Warranty flags the line and does not restock.
 */
export function postReturn(input: {
  sale_complete: boolean;
  already_voided: boolean;
  reason: string;
  lines: PostReturnLineInput[];
}): PostReturnResult {
  if (!input.sale_complete) {
    return {
      ok: false,
      code: "RETURN_NOT_ALLOWED",
      message: "Hanya penjualan selesai yang dapat di-return.",
    };
  }
  if (input.already_voided) {
    return {
      ok: false,
      code: "RETURN_NOT_ALLOWED",
      message: "Penjualan yang sudah di-void tidak dapat di-return.",
    };
  }
  const reason = input.reason.trim();
  if (!reason) {
    return {
      ok: false,
      code: "RETURN_INVALID",
      message: "Alasan retur wajib diisi.",
    };
  }
  if (!input.lines.length) {
    return {
      ok: false,
      code: "RETURN_INVALID",
      message: "Pilih minimal satu item untuk di-return.",
    };
  }
  const seen = new Set<string>();
  const lines: Array<{
    product_id: string;
    qty: number;
    decision: ReturnDecision;
  }> = [];
  const movements: PostReturnMovement[] = [];
  for (const line of input.lines) {
    if (!line.product_id || seen.has(line.product_id)) {
      return {
        ok: false,
        code: "RETURN_INVALID",
        message: "Item retur tidak valid.",
      };
    }
    seen.add(line.product_id);
    if (!RETURN_DECISIONS.has(line.decision)) {
      return {
        ok: false,
        code: "RETURN_INVALID",
        message: "Keputusan stok tidak valid.",
      };
    }
    if (
      !Number.isInteger(line.sold_qty) ||
      line.sold_qty < 1 ||
      !Number.isInteger(line.already_returned_qty) ||
      line.already_returned_qty < 0 ||
      !Number.isInteger(line.return_qty) ||
      line.return_qty < 1
    ) {
      return {
        ok: false,
        code: "RETURN_INVALID",
        message: "Jumlah retur tidak valid.",
      };
    }
    const remaining = line.sold_qty - line.already_returned_qty;
    if (line.return_qty > remaining) {
      return {
        ok: false,
        code: "RETURN_INVALID",
        message: "Jumlah retur melebihi sisa yang dapat dikembalikan.",
      };
    }
    const decision = line.decision as ReturnDecision;
    lines.push({
      product_id: line.product_id,
      qty: line.return_qty,
      decision,
    });
    if (decision === "resellable") {
      movements.push({
        product_id: line.product_id,
        qty: line.return_qty,
        bucket: "sellable",
      });
    } else if (decision === "damaged") {
      movements.push({
        product_id: line.product_id,
        qty: line.return_qty,
        bucket: "damaged",
      });
    }
  }
  return { ok: true, movements, lines };
}

export type ApproveRefundOk = { ok: true; amount_minor: number };
export type ApproveRefundErr = {
  ok: false;
  code: "REFUND_NOT_ALLOWED" | "REFUND_INVALID";
  message: string;
};
export type ApproveRefundResult = ApproveRefundOk | ApproveRefundErr;

/** Cash Refund of an open Return (FR-67). Amount must match returned lines. */
export function approveRefund(input: {
  return_status: string;
  amount_minor: number;
  expected_minor: number;
}): ApproveRefundResult {
  if (input.return_status !== "open") {
    return {
      ok: false,
      code: "REFUND_NOT_ALLOWED",
      message: "Retur ini tidak menunggu refund.",
    };
  }
  if (
    !Number.isInteger(input.amount_minor) ||
    input.amount_minor < 0 ||
    input.amount_minor !== input.expected_minor
  ) {
    return {
      ok: false,
      code: "REFUND_INVALID",
      message: "Jumlah refund harus sama dengan nilai item retur.",
    };
  }
  return { ok: true, amount_minor: input.amount_minor };
}

export type CustomerProfileInput = {
  name: string;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  group_name?: string | null;
};
export type CustomerProfileOk = {
  ok: true;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  group_name: string | null;
};
export type CustomerProfileErr = {
  ok: false;
  code:
    | "CUSTOMER_NAME_REQUIRED"
    | "CUSTOMER_CONTACT_REQUIRED"
    | "CUSTOMER_INVALID_EMAIL";
  message: string;
};
export type CustomerProfileResult = CustomerProfileOk | CustomerProfileErr;

function blankToNull(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

/**
 * Name + one of phone/email required (FR-70). Missing group never fails (FR-73).
 */
export function evaluateCustomerProfile(
  input: CustomerProfileInput,
): CustomerProfileResult {
  const name = input.name.trim();
  if (!name) {
    return {
      ok: false,
      code: "CUSTOMER_NAME_REQUIRED",
      message: "Nama pelanggan wajib diisi.",
    };
  }
  const phone = blankToNull(input.phone);
  let email = blankToNull(input.email);
  if (email && !email.includes("@")) {
    if (phone) {
      email = null;
    } else {
      return {
        ok: false,
        code: "CUSTOMER_INVALID_EMAIL",
        message: "Email tidak valid.",
      };
    }
  }
  if (!phone && !email) {
    return {
      ok: false,
      code: "CUSTOMER_CONTACT_REQUIRED",
      message: "Isi nomor telepon atau email.",
    };
  }
  return {
    ok: true,
    name,
    phone,
    email,
    notes: blankToNull(input.notes),
    group_name: blankToNull(input.group_name),
  };
}

export type OpenShiftInput = {
  opening_cash_minor: number;
  already_open: boolean;
};
export type OpenShiftOk = { ok: true; opening_cash_minor: number };
export type OpenShiftErr = {
  ok: false;
  code: "SHIFT_ALREADY_OPEN" | "SHIFT_INVALID_OPENING";
  message: string;
};
export type OpenShiftResult = OpenShiftOk | OpenShiftErr;

/** One open Shift per Register (FR-75 / AD-16). Opening cash is integer Rp ≥ 0. */
export function openShift(input: OpenShiftInput): OpenShiftResult {
  if (input.already_open) {
    return {
      ok: false,
      code: "SHIFT_ALREADY_OPEN",
      message: "Shift masih terbuka. Tutup dulu sebelum buka yang baru.",
    };
  }
  if (
    !Number.isInteger(input.opening_cash_minor) ||
    input.opening_cash_minor < 0
  ) {
    return {
      ok: false,
      code: "SHIFT_INVALID_OPENING",
      message: "Kas awal harus bilangan bulat ≥ 0.",
    };
  }
  return { ok: true, opening_cash_minor: input.opening_cash_minor };
}

export type RequireSaleShiftOk = { ok: true; shift_id: string };
export type RequireSaleShiftErr = {
  ok: false;
  code: "SALE_SHIFT_REQUIRED";
  message: string;
};
export type RequireSaleShiftResult = RequireSaleShiftOk | RequireSaleShiftErr;

/** After 2C, AcceptCompleteSale requires shift_id (AD-16). */
export function requireSaleShift(shiftId: unknown): RequireSaleShiftResult {
  if (typeof shiftId !== "string" || !shiftId.trim()) {
    return {
      ok: false,
      code: "SALE_SHIFT_REQUIRED",
      message: "Penjualan harus terikat pada shift terbuka.",
    };
  }
  return { ok: true, shift_id: shiftId.trim() };
}

export type CashMovementKind = "in" | "out";
export type RecordCashMovementInput = {
  kind: string;
  amount_minor: number;
  reason: string;
  shift_open: boolean;
};
export type RecordCashMovementOk = {
  ok: true;
  kind: CashMovementKind;
  amount_minor: number;
  reason: string;
};
export type RecordCashMovementErr = {
  ok: false;
  code: "SHIFT_NOT_OPEN" | "SHIFT_CASH_REASON_REQUIRED" | "SHIFT_INVALID_CASH";
  message: string;
};
export type RecordCashMovementResult =
  | RecordCashMovementOk
  | RecordCashMovementErr;

/** Cash In / Out during an open Shift (FR-77). Does not change Stock. */
export function recordCashMovement(
  input: RecordCashMovementInput,
): RecordCashMovementResult {
  if (!input.shift_open) {
    return {
      ok: false,
      code: "SHIFT_NOT_OPEN",
      message: "Shift harus terbuka untuk kas masuk/keluar.",
    };
  }
  const reason = input.reason.trim();
  if (!reason) {
    return {
      ok: false,
      code: "SHIFT_CASH_REASON_REQUIRED",
      message: "Alasan kas masuk/keluar wajib diisi.",
    };
  }
  if (input.kind !== "in" && input.kind !== "out") {
    return {
      ok: false,
      code: "SHIFT_INVALID_CASH",
      message: "Jenis kas harus masuk atau keluar.",
    };
  }
  if (!Number.isInteger(input.amount_minor) || input.amount_minor < 1) {
    return {
      ok: false,
      code: "SHIFT_INVALID_CASH",
      message: "Jumlah kas harus bilangan bulat ≥ 1.",
    };
  }
  return {
    ok: true,
    kind: input.kind,
    amount_minor: input.amount_minor,
    reason,
  };
}

export type ExpectedCashInput = {
  opening_cash_minor: number;
  cash_sales_minor: number;
  cash_in_minor: number;
  cash_out_minor: number;
  cash_refunds_minor: number;
  cash_voids_minor: number;
};
export type ExpectedCashOk = { ok: true; expected_cash_minor: number };
export type ExpectedCashErr = {
  ok: false;
  code: "SHIFT_INVALID_CASH";
  message: string;
};
export type ExpectedCashResult = ExpectedCashOk | ExpectedCashErr;

/**
 * FR-78: opening + cash Sales + Cash In − Cash Out − cash Refunds − cash Voids.
 * cash_sales includes later-voided cash Sales; cash_voids subtracts them (net 0).
 */
export function expectedCash(input: ExpectedCashInput): ExpectedCashResult {
  const values = [
    input.opening_cash_minor,
    input.cash_sales_minor,
    input.cash_in_minor,
    input.cash_out_minor,
    input.cash_refunds_minor,
    input.cash_voids_minor,
  ];
  if (values.some((n) => !Number.isInteger(n) || n < 0)) {
    return {
      ok: false,
      code: "SHIFT_INVALID_CASH",
      message: "Komponen kas harus bilangan bulat ≥ 0.",
    };
  }
  return {
    ok: true,
    expected_cash_minor:
      input.opening_cash_minor +
      input.cash_sales_minor +
      input.cash_in_minor -
      input.cash_out_minor -
      input.cash_refunds_minor -
      input.cash_voids_minor,
  };
}

export type CloseShiftInput = {
  status: string;
  counted_cash_minor: number;
  expected_cash_minor: number;
};
export type CloseShiftOk = {
  ok: true;
  counted_cash_minor: number;
  expected_cash_minor: number;
  difference_minor: number;
  warned: boolean;
};
export type CloseShiftErr = {
  ok: false;
  code: "SHIFT_NOT_OPEN" | "SHIFT_INVALID_CASH";
  message: string;
};
export type CloseShiftResult = CloseShiftOk | CloseShiftErr;

/** Close records counted vs expected. Non-zero difference warns, does not block (FR-79). */
export function closeShift(input: CloseShiftInput): CloseShiftResult {
  if (input.status !== "open") {
    return {
      ok: false,
      code: "SHIFT_NOT_OPEN",
      message: "Hanya shift terbuka yang dapat ditutup.",
    };
  }
  if (
    !Number.isInteger(input.counted_cash_minor) ||
    input.counted_cash_minor < 0 ||
    !Number.isInteger(input.expected_cash_minor)
  ) {
    return {
      ok: false,
      code: "SHIFT_INVALID_CASH",
      message: "Hitungan laci harus bilangan bulat ≥ 0.",
    };
  }
  const difference_minor =
    input.counted_cash_minor - input.expected_cash_minor;
  return {
    ok: true,
    counted_cash_minor: input.counted_cash_minor,
    expected_cash_minor: input.expected_cash_minor,
    difference_minor,
    warned: difference_minor !== 0,
  };
}

export type EvaluateDayCloseInput = {
  shift_open: boolean;
  closed_shift_count: number;
  complete_sale_count: number;
  pending_sync_count: number;
  acknowledged_unsynced: boolean;
};
export type EvaluateDayCloseOk = { ok: true };
export type EvaluateDayCloseErr = {
  ok: false;
  code:
    | "DAY_CLOSE_SHIFT_OPEN"
    | "DAY_CLOSE_SHIFT_REQUIRED"
    | "DAY_CLOSE_SYNC_PENDING";
  message: string;
};
export type EvaluateDayCloseResult = EvaluateDayCloseOk | EvaluateDayCloseErr;

/**
 * FR-111 + FR-24: close Shift first; cash is Shift snapshots; Sync still gates finish.
 * Does not recompute Expected Cash.
 */
export function evaluateDayClose(
  input: EvaluateDayCloseInput,
): EvaluateDayCloseResult {
  if (input.shift_open) {
    return {
      ok: false,
      code: "DAY_CLOSE_SHIFT_OPEN",
      message: "Tutup shift dulu sebelum tutup hari.",
    };
  }
  if (input.complete_sale_count > 0 && input.closed_shift_count < 1) {
    return {
      ok: false,
      code: "DAY_CLOSE_SHIFT_REQUIRED",
      message: "Ada penjualan hari ini. Tutup shift dulu sebelum tutup hari.",
    };
  }
  if (
    !Number.isInteger(input.pending_sync_count) ||
    input.pending_sync_count < 0
  ) {
    return {
      ok: false,
      code: "DAY_CLOSE_SYNC_PENDING",
      message: "Status unggah tidak valid.",
    };
  }
  if (input.pending_sync_count > 0 && !input.acknowledged_unsynced) {
    return {
      ok: false,
      code: "DAY_CLOSE_SYNC_PENDING",
      message: "Unggah penjualan atau centang pengakuan sebelum tutup hari.",
    };
  }
  return { ok: true };
}

export type DayCloseShiftSnapshot = {
  expected_cash_minor: number;
  counted_cash_minor: number;
  difference_minor: number;
};

/**
 * Display-only aggregate of closed Shift snapshots (FR-23 / AD-8).
 * Not FR-78 — do not recompute opening + sales + in − out − refunds − voids.
 */
export function dayCloseCashFromShifts(
  shifts: DayCloseShiftSnapshot[],
): DayCloseShiftSnapshot {
  return shifts.reduce(
    (acc, row) => ({
      expected_cash_minor: acc.expected_cash_minor + row.expected_cash_minor,
      counted_cash_minor: acc.counted_cash_minor + row.counted_cash_minor,
      difference_minor: acc.difference_minor + row.difference_minor,
    }),
    { expected_cash_minor: 0, counted_cash_minor: 0, difference_minor: 0 },
  );
}

const TENDER_METHODS: ReadonlySet<string> = new Set(["cash", "store_credit"]);

export type TenderMethod = "cash" | "store_credit";
export type PaymentMethod = "cash" | "store_credit" | "split";

export type TenderLine = {
  method: TenderMethod;
  amount_minor: number;
};

export type PaymentSnapshot = {
  method?: string | null;
  amount_minor?: number;
  tenders?: Array<{ method: string; amount_minor: number }> | null;
};

function isNonNegativeInt(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0;
}

/**
 * Customer → group → store → catalog. Invalid/missing decorations fail open (AD-18 / FR-112).
 */
export function resolveSellingPrice(input: {
  catalog_price_minor: number;
  store_price_minor?: number | null;
  customer_price_minor?: number | null;
  group_price_minor?: number | null;
}): number {
  const chain = [
    input.customer_price_minor,
    input.group_price_minor,
    input.store_price_minor,
    input.catalog_price_minor,
  ];
  for (const price of chain) {
    if (isNonNegativeInt(price)) return price;
  }
  return 0;
}

export function tendersFromPayment(
  payment: PaymentSnapshot | null | undefined,
): TenderLine[] {
  if (!payment) {
    return [{ method: "cash", amount_minor: 0 }];
  }
  if (payment.tenders && payment.tenders.length > 0) {
    return payment.tenders.map((row) => ({
      method: row.method,
      amount_minor: row.amount_minor,
    })) as TenderLine[];
  }
  const amount_minor = isNonNegativeInt(payment.amount_minor)
    ? payment.amount_minor
    : 0;
  if (payment.method === "store_credit") {
    return [{ method: "store_credit", amount_minor }];
  }
  if (
    payment.method == null ||
    payment.method === "cash" ||
    payment.method === ""
  ) {
    return [{ method: "cash", amount_minor }];
  }
  return [];
}

export function cashTenderTotal(
  payment: PaymentSnapshot | null | undefined,
): number {
  return tendersFromPayment(payment)
    .filter((row) => row.method === "cash" && isNonNegativeInt(row.amount_minor))
    .reduce((sum, row) => sum + row.amount_minor, 0);
}

export function storeCreditTenderTotal(
  payment: PaymentSnapshot | null | undefined,
): number {
  return tendersFromPayment(payment)
    .filter(
      (row) =>
        row.method === "store_credit" && isNonNegativeInt(row.amount_minor),
    )
    .reduce((sum, row) => sum + row.amount_minor, 0);
}

export type EvaluateSplitTenderInput = {
  payable_minor: number;
  customer_id?: string | null;
  /** When a number, Store Credit cannot exceed it. Omit to skip the balance check. */
  store_credit_balance_minor?: number;
  tenders: Array<{ method: string; amount_minor: number }>;
};

export type EvaluateSplitTenderOk = {
  ok: true;
  method: PaymentMethod;
  amount_minor: number;
  tenders: TenderLine[];
  cash_minor: number;
  store_credit_minor: number;
};

export type EvaluateSplitTenderErr = {
  ok: false;
  code:
    | "TENDER_SUM_MISMATCH"
    | "TENDER_METHOD_UNSUPPORTED"
    | "TENDER_STORE_CREDIT_REQUIRES_CUSTOMER"
    | "TENDER_STORE_CREDIT_EXCEEDS_BALANCE";
  message: string;
};

export type EvaluateSplitTenderResult =
  | EvaluateSplitTenderOk
  | EvaluateSplitTenderErr;

/** Cash + Store Credit only; sums must equal payable (FR-110). */
export function evaluateSplitTender(
  input: EvaluateSplitTenderInput,
): EvaluateSplitTenderResult {
  if (!isNonNegativeInt(input.payable_minor)) {
    return {
      ok: false,
      code: "TENDER_SUM_MISMATCH",
      message: "Jumlah tender harus sama dengan total.",
    };
  }
  if (!input.tenders?.length) {
    return {
      ok: false,
      code: "TENDER_SUM_MISMATCH",
      message: "Jumlah tender harus sama dengan total.",
    };
  }

  const merged = new Map<TenderMethod, number>();
  for (const row of input.tenders) {
    if (!TENDER_METHODS.has(row.method)) {
      return {
        ok: false,
        code: "TENDER_METHOD_UNSUPPORTED",
        message: "Hanya tunai dan kredit toko.",
      };
    }
    if (!isNonNegativeInt(row.amount_minor)) {
      return {
        ok: false,
        code: "TENDER_SUM_MISMATCH",
        message: "Jumlah tender tidak valid.",
      };
    }
    const method = row.method as TenderMethod;
    merged.set(method, (merged.get(method) ?? 0) + row.amount_minor);
  }

  const cash_minor = merged.get("cash") ?? 0;
  const store_credit_minor = merged.get("store_credit") ?? 0;
  const amount_minor = cash_minor + store_credit_minor;
  if (amount_minor !== input.payable_minor) {
    return {
      ok: false,
      code: "TENDER_SUM_MISMATCH",
      message: "Jumlah tender harus sama dengan total.",
    };
  }

  if (store_credit_minor > 0) {
    const customerId =
      typeof input.customer_id === "string" ? input.customer_id.trim() : "";
    if (!customerId) {
      return {
        ok: false,
        code: "TENDER_STORE_CREDIT_REQUIRES_CUSTOMER",
        message: "Kredit toko membutuhkan pelanggan.",
      };
    }
    if (
      typeof input.store_credit_balance_minor === "number" &&
      (!isNonNegativeInt(input.store_credit_balance_minor) ||
        store_credit_minor > input.store_credit_balance_minor)
    ) {
      return {
        ok: false,
        code: "TENDER_STORE_CREDIT_EXCEEDS_BALANCE",
        message: "Kredit toko melebihi saldo.",
      };
    }
  }

  const tenders: TenderLine[] = [];
  if (merged.has("cash")) {
    tenders.push({ method: "cash", amount_minor: cash_minor });
  }
  if (store_credit_minor > 0) {
    tenders.push({ method: "store_credit", amount_minor: store_credit_minor });
  }
  if (!tenders.length) {
    tenders.push({ method: "cash", amount_minor: 0 });
  }

  const method: PaymentMethod =
    store_credit_minor > 0 && cash_minor > 0
      ? "split"
      : store_credit_minor > 0
        ? "store_credit"
        : "cash";

  return {
    ok: true,
    method,
    amount_minor,
    tenders,
    cash_minor,
    store_credit_minor,
  };
}

export type LoyaltyTierRule = {
  name: string;
  min_lifetime_points: number;
  earn_multiplier_bps: number;
};

export type LoyaltyProgramSnapshot = {
  enabled: boolean;
  earn_per_minor: number;
  point_value_minor: number;
  expire_days: number | null;
  tiers: LoyaltyTierRule[];
};

export const DEFAULT_LOYALTY_TIERS: LoyaltyTierRule[] = [
  { name: "Reguler", min_lifetime_points: 0, earn_multiplier_bps: 10000 },
  { name: "Silver", min_lifetime_points: 100, earn_multiplier_bps: 12000 },
  { name: "Gold", min_lifetime_points: 500, earn_multiplier_bps: 15000 },
];

export function normalizeLoyaltyProgram(
  input: Partial<LoyaltyProgramSnapshot> | null | undefined,
): LoyaltyProgramSnapshot | null {
  if (!input) return null;
  const earn_per_minor = input.earn_per_minor;
  const point_value_minor = input.point_value_minor;
  if (
    typeof earn_per_minor !== "number" ||
    !Number.isInteger(earn_per_minor) ||
    earn_per_minor < 1 ||
    typeof point_value_minor !== "number" ||
    !Number.isInteger(point_value_minor) ||
    point_value_minor < 1
  ) {
    return null;
  }
  const expire_days =
    input.expire_days === null || input.expire_days === undefined
      ? null
      : Number.isInteger(input.expire_days) && input.expire_days >= 1
        ? input.expire_days
        : null;
  const tiers = Array.isArray(input.tiers)
    ? input.tiers.filter(
        (tier) =>
          typeof tier?.name === "string" &&
          tier.name.trim().length > 0 &&
          Number.isInteger(tier.min_lifetime_points) &&
          tier.min_lifetime_points >= 0 &&
          Number.isInteger(tier.earn_multiplier_bps) &&
          tier.earn_multiplier_bps >= 0,
      )
    : [];
  return {
    enabled: input.enabled !== false,
    earn_per_minor,
    point_value_minor,
    expire_days,
    tiers: tiers.length ? tiers : DEFAULT_LOYALTY_TIERS,
  };
}

export function resolveLoyaltyTier(
  lifetime_points: number,
  tiers: LoyaltyTierRule[] = DEFAULT_LOYALTY_TIERS,
): string | null {
  if (!Number.isInteger(lifetime_points) || lifetime_points < 0) return null;
  const sorted = [...tiers].sort(
    (a, b) => a.min_lifetime_points - b.min_lifetime_points,
  );
  let name: string | null = null;
  for (const tier of sorted) {
    if (lifetime_points >= tier.min_lifetime_points) name = tier.name.trim();
  }
  return name;
}

function earnMultiplierBps(
  lifetime_points: number,
  tiers: LoyaltyTierRule[],
): number {
  const sorted = [...tiers].sort(
    (a, b) => a.min_lifetime_points - b.min_lifetime_points,
  );
  let bps = 10000;
  for (const tier of sorted) {
    if (lifetime_points >= tier.min_lifetime_points) {
      bps = tier.earn_multiplier_bps;
    }
  }
  return bps;
}

export type EvaluateLoyaltyEarnResult = {
  ok: true;
  points: number;
  skipped: boolean;
};

/** Fail-open: missing/disabled program yields 0 points (FR-86). */
export function evaluateLoyaltyEarn(input: {
  program: LoyaltyProgramSnapshot | null;
  amount_minor: number;
  lifetime_points: number;
}): EvaluateLoyaltyEarnResult {
  const program = normalizeLoyaltyProgram(input.program);
  if (!program || !program.enabled) {
    return { ok: true, points: 0, skipped: true };
  }
  if (!isNonNegativeInt(input.amount_minor)) {
    return { ok: true, points: 0, skipped: true };
  }
  const lifetime = isNonNegativeInt(input.lifetime_points)
    ? input.lifetime_points
    : 0;
  const bps = earnMultiplierBps(lifetime, program.tiers);
  const base = Math.floor(input.amount_minor / program.earn_per_minor);
  const points = Math.floor((base * bps) / 10000);
  return { ok: true, points, skipped: false };
}

export type EvaluateLoyaltyRedeemOk = {
  ok: true;
  redeem_points: number;
  discount_minor: number;
  skipped: boolean;
};

export type EvaluateLoyaltyRedeemErr = {
  ok: false;
  code: "LOYALTY_INSUFFICIENT" | "LOYALTY_INVALID";
  message: string;
};

export type EvaluateLoyaltyRedeemResult =
  | EvaluateLoyaltyRedeemOk
  | EvaluateLoyaltyRedeemErr;

/**
 * Redeem is refused when the cashier asked for points they do not have.
 * Missing program with redeem_points > 0 fails open (skip) so Instant Checkout still completes.
 */
export function evaluateLoyaltyRedeem(input: {
  program: LoyaltyProgramSnapshot | null;
  points_balance: number;
  redeem_points: number;
  payable_minor: number;
}): EvaluateLoyaltyRedeemResult {
  if (!Number.isInteger(input.redeem_points) || input.redeem_points < 0) {
    return {
      ok: false,
      code: "LOYALTY_INVALID",
      message: "Jumlah poin tidak valid.",
    };
  }
  if (input.redeem_points === 0) {
    return { ok: true, redeem_points: 0, discount_minor: 0, skipped: true };
  }
  const program = normalizeLoyaltyProgram(input.program);
  if (!program || !program.enabled) {
    return { ok: true, redeem_points: 0, discount_minor: 0, skipped: true };
  }
  if (!isNonNegativeInt(input.payable_minor)) {
    return { ok: true, redeem_points: 0, discount_minor: 0, skipped: true };
  }
  const balance = isNonNegativeInt(input.points_balance)
    ? input.points_balance
    : 0;
  if (input.redeem_points > balance) {
    return {
      ok: false,
      code: "LOYALTY_INSUFFICIENT",
      message: "Poin tidak cukup.",
    };
  }
  const raw = input.redeem_points * program.point_value_minor;
  const discount_minor = Math.min(raw, input.payable_minor);
  const redeem_points =
    program.point_value_minor > 0
      ? Math.ceil(discount_minor / program.point_value_minor)
      : 0;
  return {
    ok: true,
    redeem_points,
    discount_minor,
    skipped: false,
  };
}

export type PromotionKind = "percent" | "fixed";

export type PromotionSnapshot = {
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
};

export type PromotionCartLine = {
  product_id: string;
  qty: number;
  price_minor: number;
};

export type AppliedPromotion = {
  promotion_id: string;
  name: string;
  discount_minor: number;
};

function isHour(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 23;
}

export function normalizePromotion(
  input: Partial<PromotionSnapshot> | null | undefined,
): PromotionSnapshot | null {
  if (!input) return null;
  const promotion_id =
    typeof input.promotion_id === "string" ? input.promotion_id.trim() : "";
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!promotion_id || !name) return null;
  const kind = input.kind;
  if (kind !== "percent" && kind !== "fixed") return null;
  const percent_bps =
    kind === "percent" &&
    Number.isInteger(input.percent_bps) &&
    (input.percent_bps as number) >= 1 &&
    (input.percent_bps as number) <= 10000
      ? (input.percent_bps as number)
      : null;
  const fixed_minor =
    kind === "fixed" &&
    Number.isInteger(input.fixed_minor) &&
    (input.fixed_minor as number) >= 1
      ? (input.fixed_minor as number)
      : null;
  if (kind === "percent" && percent_bps == null) return null;
  if (kind === "fixed" && fixed_minor == null) return null;
  const coupon =
    typeof input.coupon_code === "string" && input.coupon_code.trim().length > 0
      ? input.coupon_code.trim().toUpperCase()
      : null;
  const min_subtotal_minor =
    Number.isInteger(input.min_subtotal_minor) &&
    (input.min_subtotal_minor as number) >= 0
      ? (input.min_subtotal_minor as number)
      : null;
  const customer_group =
    typeof input.customer_group === "string" && input.customer_group.trim()
      ? input.customer_group.trim()
      : null;
  const product_ids = Array.isArray(input.product_ids)
    ? input.product_ids.filter((id) => typeof id === "string" && id.length > 0)
    : [];
  const starts_at =
    typeof input.starts_at === "string" && Number.isFinite(Date.parse(input.starts_at))
      ? input.starts_at
      : null;
  const ends_at =
    typeof input.ends_at === "string" && Number.isFinite(Date.parse(input.ends_at))
      ? input.ends_at
      : null;
  const hour_start = isHour(input.hour_start) ? input.hour_start : null;
  const hour_end = isHour(input.hour_end) ? input.hour_end : null;
  return {
    promotion_id,
    name,
    enabled: input.enabled !== false,
    kind,
    percent_bps,
    fixed_minor,
    coupon_code: coupon,
    exclusive: input.exclusive === true,
    min_subtotal_minor,
    customer_group,
    product_ids,
    starts_at,
    ends_at,
    hour_start,
    hour_end,
  };
}

function lineTotalMinor(lines: PromotionCartLine[]): number {
  return lines.reduce((sum, line) => {
    if (!Number.isInteger(line.qty) || line.qty <= 0) return sum;
    if (!Number.isInteger(line.price_minor) || line.price_minor < 0) return sum;
    return sum + line.qty * line.price_minor;
  }, 0);
}

function eligibleSubtotal(
  promo: PromotionSnapshot,
  lines: PromotionCartLine[],
): number {
  const wanted = new Set(promo.product_ids);
  return lines.reduce((sum, line) => {
    if (wanted.size && !wanted.has(line.product_id)) return sum;
    if (!Number.isInteger(line.qty) || line.qty <= 0) return sum;
    if (!Number.isInteger(line.price_minor) || line.price_minor < 0) return sum;
    return sum + line.qty * line.price_minor;
  }, 0);
}

function inDateWindow(promo: PromotionSnapshot, nowMs: number): boolean {
  if (promo.starts_at && Date.parse(promo.starts_at) > nowMs) return false;
  if (promo.ends_at && Date.parse(promo.ends_at) < nowMs) return false;
  return true;
}

function inHappyHour(promo: PromotionSnapshot, localHour: number): boolean {
  if (promo.hour_start == null || promo.hour_end == null) return true;
  if (!isHour(localHour)) return false;
  if (promo.hour_start <= promo.hour_end) {
    return localHour >= promo.hour_start && localHour <= promo.hour_end;
  }
  return localHour >= promo.hour_start || localHour <= promo.hour_end;
}

function promotionDiscount(
  promo: PromotionSnapshot,
  lines: PromotionCartLine[],
): number {
  const subtotal = eligibleSubtotal(promo, lines);
  if (subtotal <= 0) return 0;
  if (promo.kind === "percent" && promo.percent_bps != null) {
    return Math.min(subtotal, Math.floor((subtotal * promo.percent_bps) / 10000));
  }
  if (promo.kind === "fixed" && promo.fixed_minor != null) {
    return Math.min(subtotal, promo.fixed_minor);
  }
  return 0;
}

function isEligiblePromotion(
  promo: PromotionSnapshot,
  input: {
    lines: PromotionCartLine[];
    customer_group: string | null;
    now_ms: number;
    local_hour: number;
  },
): boolean {
  if (!promo.enabled) return false;
  if (!inDateWindow(promo, input.now_ms)) return false;
  if (!inHappyHour(promo, input.local_hour)) return false;
  const total = lineTotalMinor(input.lines);
  if (promo.min_subtotal_minor != null && total < promo.min_subtotal_minor) {
    return false;
  }
  if (promo.customer_group && promo.customer_group !== (input.customer_group ?? "")) {
    return false;
  }
  return promotionDiscount(promo, input.lines) > 0;
}

export type EvaluatePromotionsResult = {
  ok: true;
  discount_minor: number;
  applied: AppliedPromotion[];
  skipped: boolean;
  coupon_error: { code: "COUPON_INVALID"; message: string } | null;
};

/** Fail-open: missing/invalid rules yield 0 discount (FR-92). Invalid coupon is reported, Sale may proceed. */
export function evaluatePromotions(input: {
  promotions: Array<Partial<PromotionSnapshot>> | null | undefined;
  lines: PromotionCartLine[];
  coupon_code?: string | null;
  customer_group?: string | null;
  now_ms?: number;
  local_hour?: number;
}): EvaluatePromotionsResult {
  const empty: EvaluatePromotionsResult = {
    ok: true,
    discount_minor: 0,
    applied: [],
    skipped: true,
    coupon_error: null,
  };
  if (!Array.isArray(input.promotions) || input.promotions.length === 0) {
    return empty;
  }
  const now_ms =
    typeof input.now_ms === "number" && Number.isFinite(input.now_ms)
      ? input.now_ms
      : Date.now();
  const local_hour =
    typeof input.local_hour === "number" ? input.local_hour : new Date(now_ms).getHours();
  const customer_group =
    typeof input.customer_group === "string" && input.customer_group.trim()
      ? input.customer_group.trim()
      : null;
  const parsed = input.promotions
    .map((row) => normalizePromotion(row))
    .filter((row): row is PromotionSnapshot => row != null);
  if (!parsed.length) return empty;

  const ctx = { lines: input.lines, customer_group, now_ms, local_hour };
  const autos = parsed.filter(
    (row) => !row.coupon_code && isEligiblePromotion(row, ctx),
  );
  const scored = autos.map((row) => ({
    row,
    discount_minor: promotionDiscount(row, input.lines),
  }));
  const exclusives = scored.filter((entry) => entry.row.exclusive);
  let chosen = exclusives.length
    ? [
        exclusives.reduce((best, entry) =>
          entry.discount_minor > best.discount_minor ? entry : best,
        ),
      ]
    : scored;

  let coupon_error: EvaluatePromotionsResult["coupon_error"] = null;
  const wanted =
    typeof input.coupon_code === "string" ? input.coupon_code.trim().toUpperCase() : "";
  if (wanted) {
    const coupon = parsed.find((row) => row.coupon_code === wanted);
    if (!coupon || !isEligiblePromotion(coupon, ctx)) {
      coupon_error = {
        code: "COUPON_INVALID",
        message: "Kupon tidak valid.",
      };
    } else {
      const discount_minor = promotionDiscount(coupon, input.lines);
      if (coupon.exclusive) {
        chosen = [{ row: coupon, discount_minor }];
      } else {
        chosen = [...chosen, { row: coupon, discount_minor }];
      }
    }
  }

  const applied: AppliedPromotion[] = [];
  let discount_minor = 0;
  const cap = lineTotalMinor(input.lines);
  for (const entry of chosen) {
    if (entry.discount_minor <= 0) continue;
    const next = Math.min(entry.discount_minor, Math.max(0, cap - discount_minor));
    if (next <= 0) break;
    applied.push({
      promotion_id: entry.row.promotion_id,
      name: entry.row.name,
      discount_minor: next,
    });
    discount_minor += next;
  }
  return {
    ok: true,
    discount_minor,
    applied,
    skipped: applied.length === 0 && !coupon_error,
    coupon_error,
  };
}

export type EvaluateVoucherResult = {
  ok: true;
  applied_minor: number;
  remaining_minor: number;
  skipped: boolean;
};

/** Fail-open skip when remaining is missing/invalid. Caps at payable. No cash-out. */
export function evaluateVoucher(input: {
  remaining_minor: number | null | undefined;
  payable_minor: number;
}): EvaluateVoucherResult {
  if (
    !Number.isInteger(input.remaining_minor) ||
    (input.remaining_minor as number) < 1 ||
    !isNonNegativeInt(input.payable_minor)
  ) {
    return { ok: true, applied_minor: 0, remaining_minor: 0, skipped: true };
  }
  const applied_minor = Math.min(input.remaining_minor as number, input.payable_minor);
  return {
    ok: true,
    applied_minor,
    remaining_minor: (input.remaining_minor as number) - applied_minor,
    skipped: applied_minor === 0,
  };
}

export type EvaluateManagerDiscountResult = {
  ok: true;
  discount_minor: number;
  skipped: boolean;
};

/** Extra discount is a snapshot amount. Invalid values fail open to 0 (never block Pay). */
export function evaluateManagerDiscount(input: {
  discount_minor: number | null | undefined;
  payable_minor: number;
}): EvaluateManagerDiscountResult {
  if (
    !Number.isInteger(input.discount_minor) ||
    (input.discount_minor as number) < 1 ||
    !isNonNegativeInt(input.payable_minor)
  ) {
    return { ok: true, discount_minor: 0, skipped: true };
  }
  return {
    ok: true,
    discount_minor: Math.min(input.discount_minor as number, input.payable_minor),
    skipped: false,
  };
}

/** Sale-level stack: promo → manager → voucher → loyalty. Never below 0. */
export function stackSaleDiscounts(input: {
  line_total_minor: number;
  promo_discount_minor?: number;
  manager_discount_minor?: number;
  voucher_minor?: number;
  loyalty_discount_minor?: number;
}): number {
  if (!isNonNegativeInt(input.line_total_minor)) return 0;
  let left = input.line_total_minor;
  for (const raw of [
    input.promo_discount_minor,
    input.manager_discount_minor,
    input.voucher_minor,
    input.loyalty_discount_minor,
  ]) {
    const take = Number.isInteger(raw) && (raw as number) > 0 ? (raw as number) : 0;
    left = Math.max(0, left - take);
  }
  return left;
}

function positiveInt(n: unknown): number {
  return Number.isInteger(n) && (n as number) > 0 ? (n as number) : 0;
}

function nonNegInt(n: unknown): number {
  return Number.isInteger(n) && (n as number) >= 0 ? (n as number) : 0;
}

/** Sale-level discount total (promo + manager + voucher + loyalty). Not a line re-price. */
export function saleDiscountMinor(input: {
  promotions?: {
    discount_minor?: number;
    manager_discount_minor?: number;
    voucher_minor?: number;
  } | null;
  loyalty?: { discount_minor?: number } | null;
}): number {
  return (
    positiveInt(input.promotions?.discount_minor) +
    positiveInt(input.promotions?.manager_discount_minor) +
    positiveInt(input.promotions?.voucher_minor) +
    positiveInt(input.loyalty?.discount_minor)
  );
}

/** COGS for a line: qty × product cost field. Null/invalid cost is 0 — not FIFO. */
export function lineCogsMinor(
  qty: number,
  cost_minor: number | null | undefined,
): number {
  const q = positiveInt(qty);
  const cost = nonNegInt(cost_minor);
  return q * cost;
}

export type ReportSaleLineInput = {
  product_id: string;
  qty: number;
  price_minor: number;
  cost_minor: number | null;
};

export type ReportSaleInput = {
  amount_minor: number;
  voided: boolean;
  lines: ReportSaleLineInput[];
  discount_minor: number;
};

export type ReportPeriodTotals = {
  revenue_minor: number;
  txn_count: number;
  units: number;
  aov_minor: number;
  discount_minor: number;
  refund_minor: number;
  net_minor: number;
  cogs_minor: number;
  gross_profit_minor: number;
  tax_minor: number;
  fees_minor: number;
};

/**
 * Period totals from complete Sales minus Refunds (FR-93 / FR-97).
 * Voided Sales are excluded. Tax/fees stay 0 until recorded.
 */
export function summarizeSalesAnalytics(input: {
  sales: ReportSaleInput[];
  refunds: Array<{ refund_amount_minor: number }>;
}): ReportPeriodTotals {
  let revenue_minor = 0;
  let txn_count = 0;
  let units = 0;
  let discount_minor = 0;
  let cogs_minor = 0;
  for (const sale of input.sales) {
    if (sale.voided) continue;
    if (!Number.isInteger(sale.amount_minor) || sale.amount_minor < 0) continue;
    revenue_minor += sale.amount_minor;
    txn_count += 1;
    discount_minor += nonNegInt(sale.discount_minor);
    for (const line of sale.lines) {
      const qty = positiveInt(line.qty);
      units += qty;
      cogs_minor += lineCogsMinor(qty, line.cost_minor);
    }
  }
  let refund_minor = 0;
  for (const refund of input.refunds) {
    refund_minor += positiveInt(refund.refund_amount_minor);
  }
  const net_minor = Math.max(0, revenue_minor - refund_minor);
  return {
    revenue_minor,
    txn_count,
    units,
    aov_minor: txn_count === 0 ? 0 : Math.floor(revenue_minor / txn_count),
    discount_minor,
    refund_minor,
    net_minor,
    cogs_minor,
    gross_profit_minor: revenue_minor - cogs_minor,
    tax_minor: 0,
    fees_minor: 0,
  };
}

export type ReportProductAgg = {
  product_id: string;
  units: number;
  revenue_minor: number;
  cogs_minor: number;
  margin_minor: number;
};

/** Historical product units even if the SKU is now inactive. Margin = selling − cost field. */
export function summarizeProductAnalytics(input: {
  sales: ReportSaleInput[];
}): ReportProductAgg[] {
  const by = new Map<
    string,
    { units: number; revenue_minor: number; cogs_minor: number }
  >();
  for (const sale of input.sales) {
    if (sale.voided) continue;
    for (const line of sale.lines) {
      if (typeof line.product_id !== "string" || !line.product_id) continue;
      const qty = positiveInt(line.qty);
      if (!qty) continue;
      const revenue = qty * nonNegInt(line.price_minor);
      const cogs = lineCogsMinor(qty, line.cost_minor);
      const cur = by.get(line.product_id) ?? {
        units: 0,
        revenue_minor: 0,
        cogs_minor: 0,
      };
      cur.units += qty;
      cur.revenue_minor += revenue;
      cur.cogs_minor += cogs;
      by.set(line.product_id, cur);
    }
  }
  return [...by.entries()].map(([product_id, v]) => ({
    product_id,
    units: v.units,
    revenue_minor: v.revenue_minor,
    cogs_minor: v.cogs_minor,
    margin_minor: v.revenue_minor - v.cogs_minor,
  }));
}

export function rankProductAnalytics(
  rows: ReportProductAgg[],
  limit = 10,
): { top: ReportProductAgg[]; slow: ReportProductAgg[] } {
  const cap = Number.isInteger(limit) && limit > 0 ? limit : 10;
  const sorted = [...rows].sort((a, b) => {
    if (b.units !== a.units) return b.units - a.units;
    return b.revenue_minor - a.revenue_minor;
  });
  return {
    top: sorted.slice(0, cap),
    slow: [...sorted].reverse().slice(0, cap),
  };
}

/** Approved opname only. Variance = counted − system, matching opname ids. */
export function summarizeOpnameVariance(input: {
  opname_id: string;
  status: string;
  lines: Array<{ system_qty: number; counted_qty: number | null }>;
}): { opname_id: string; variance: number } | null {
  if (input.status !== "approved") return null;
  let variance = 0;
  for (const line of input.lines) {
    if (!Number.isInteger(line.system_qty)) continue;
    if (!Number.isInteger(line.counted_qty)) continue;
    variance += (line.counted_qty as number) - line.system_qty;
  }
  return { opname_id: input.opname_id, variance };
}

export function isDeadStock(input: {
  sellable_qty: number;
  units_sold: number;
}): boolean {
  return (
    Number.isInteger(input.sellable_qty) &&
    input.sellable_qty > 0 &&
    (!Number.isInteger(input.units_sold) || input.units_sold <= 0)
  );
}

/** Sellable qty × product cost field. */
export function inventoryStockValueMinor(
  rows: Array<{ sellable_qty: number; cost_minor: number | null }>,
): number {
  let sum = 0;
  for (const row of rows) {
    const qty = Number.isInteger(row.sellable_qty) ? row.sellable_qty : 0;
    if (qty <= 0) continue;
    sum += qty * nonNegInt(row.cost_minor);
  }
  return sum;
}

/** Seeded Account roles (FR-99 / FR-103). `catalog_admin` is Admin. */
export const ACCOUNT_ROLES = [
  "owner",
  "catalog_admin",
  "store_manager",
  "supervisor",
  "cashier",
  "inventory_staff",
  "purchasing_staff",
] as const;

export type AccountRole = (typeof ACCOUNT_ROLES)[number];

export function isAccountRole(value: unknown): value is AccountRole {
  return (
    typeof value === "string" &&
    (ACCOUNT_ROLES as readonly string[]).includes(value)
  );
}

export function permissionKey(resource: string, action: string): string {
  return `${resource}:${action}`;
}

export function hasPermission(
  grants: string[] | undefined,
  resource: string,
  action: string,
): boolean {
  if (!Array.isArray(grants) || grants.length === 0) return false;
  if (grants.includes("*:*") || grants.includes(`${resource}:*`)) return true;
  return grants.includes(permissionKey(resource, action));
}

const SELL: Array<[string, string]> = [
  ["sales", "view"],
  ["sales", "create"],
  ["sales", "void"],
  ["shifts", "view"],
  ["shifts", "create"],
  ["shifts", "update"],
  ["products", "view"],
  ["customers", "view"],
  ["customers", "create"],
  ["promotions", "view"],
  ["loyalty", "view"],
  ["reports", "view"],
  ["returns", "view"],
  ["returns", "create"],
];

const SUPERVISOR: Array<[string, string]> = [
  ...SELL,
  ["sales", "void_unattended"],
];

const MANAGER: Array<[string, string]> = [
  ...SUPERVISOR,
  ["returns", "approve"],
  ["returns", "update"],
  ["inventory", "view"],
  ["inventory", "create"],
  ["inventory", "update"],
  ["inventory", "approve"],
  ["products", "create"],
  ["products", "update"],
  ["products", "delete"],
  ["products", "view_cost"],
  ["purchases", "view"],
  ["purchases", "create"],
  ["purchases", "update"],
  ["purchases", "approve"],
  ["reports", "view_financial"],
  ["reports", "export"],
  ["promotions", "create"],
  ["promotions", "update"],
  ["promotions", "delete"],
  ["loyalty", "update"],
  ["customers", "update"],
  ["customers", "delete"],
  ["stores", "view"],
  ["transfers", "view"],
  ["transfers", "create"],
  ["transfers", "update"],
  ["transfers", "approve"],
];

const ADMIN: Array<[string, string]> = [
  ...MANAGER,
  ["users", "view"],
  ["users", "create"],
  ["users", "update"],
  ["users", "delete"],
  ["rbac", "update"],
  ["stores", "update"],
];

const INVENTORY: Array<[string, string]> = [
  ["products", "view"],
  ["products", "view_cost"],
  ["inventory", "view"],
  ["inventory", "create"],
  ["inventory", "update"],
  ["reports", "view"],
  ["stores", "view"],
  ["transfers", "view"],
  ["transfers", "create"],
  ["transfers", "update"],
];

const PURCHASING: Array<[string, string]> = [
  ["products", "view"],
  ["products", "view_cost"],
  ["purchases", "view"],
  ["purchases", "create"],
  ["purchases", "update"],
  ["reports", "view"],
];

const DEFAULTS: Record<AccountRole, Array<[string, string]>> = {
  owner: ADMIN,
  catalog_admin: ADMIN,
  store_manager: MANAGER,
  supervisor: SUPERVISOR,
  cashier: SELL,
  inventory_staff: INVENTORY,
  purchasing_staff: PURCHASING,
};

export function defaultPermissionsForRole(role: AccountRole): string[] {
  return DEFAULTS[role].map(([resource, action]) =>
    permissionKey(resource, action),
  );
}

/** Use request grants when present so matrix edits apply without re-login. */
export function grantsFor(input: {
  role: string;
  permissions?: string[];
}): string[] {
  if (Array.isArray(input.permissions)) return input.permissions;
  if (isAccountRole(input.role)) return defaultPermissionsForRole(input.role);
  return [];
}

export function canOpenEmployees(role: string): boolean {
  return role === "owner" || role === "catalog_admin";
}

export function canEditPermissionMatrix(role: string): boolean {
  return canOpenEmployees(role);
}

/**
 * Store Manager cannot create admins. Only Owner can assign Owner.
 * Admin can assign Admin and below.
 */
export function canAssignRole(input: {
  actor_role: string;
  target_role: string;
}): boolean {
  if (!isAccountRole(input.actor_role) || !isAccountRole(input.target_role)) {
    return false;
  }
  if (!canOpenEmployees(input.actor_role)) return false;
  if (input.target_role === "owner") return input.actor_role === "owner";
  if (
    input.target_role === "catalog_admin" ||
    input.target_role === "store_manager"
  ) {
    return input.actor_role === "owner" || input.actor_role === "catalog_admin";
  }
  return true;
}

export function evaluateUserAccount(input: {
  username: string;
  password?: string;
  role: string;
  store_id: string;
  require_password: boolean;
}):
  | { ok: true; username: string; role: AccountRole; store_id: string }
  | {
      ok: false;
      code: "USER_INVALID";
      message: string;
    } {
  const username = input.username.trim();
  if (!username || username.length < 3) {
    return {
      ok: false,
      code: "USER_INVALID",
      message: "Username minimal 3 karakter.",
    };
  }
  if (!isAccountRole(input.role)) {
    return {
      ok: false,
      code: "USER_INVALID",
      message: "Peran tidak dikenal.",
    };
  }
  if (input.require_password) {
    const password = input.password ?? "";
    if (password.length < 8) {
      return {
        ok: false,
        code: "USER_INVALID",
        message: "Password minimal 8 karakter.",
      };
    }
  } else if (input.password != null && input.password.length > 0 && input.password.length < 8) {
    return {
      ok: false,
      code: "USER_INVALID",
      message: "Password minimal 8 karakter.",
    };
  }
  if (!input.store_id.trim()) {
    return {
      ok: false,
      code: "USER_INVALID",
      message: "Store wajib diisi.",
    };
  }
  return {
    ok: true,
    username,
    role: input.role,
    store_id: input.store_id,
  };
}


