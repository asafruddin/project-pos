/**
 * Set absolute server Stock qty (AD-4 AdjustStock — not Sale Sync).
 * Pure function: no DB / HTTP / Nest.
 */
export type AdjustStockOk = { ok: true; stock_qty: number };
export type AdjustStockErr = {
  ok: false;
  code: "CATALOG_INVALID_STOCK";
  message: string;
};
export type AdjustStockResult = AdjustStockOk | AdjustStockErr;

export function adjustStock(targetQty: number): AdjustStockResult {
  if (!Number.isInteger(targetQty) || targetQty < 0) {
    return {
      ok: false,
      code: "CATALOG_INVALID_STOCK",
      message: "Stok harus bilangan bulat ≥ 0.",
    };
  }
  return { ok: true, stock_qty: targetQty };
}

export function isPlaceholderId(id: string): boolean {
  return typeof id === "string" && id.length > 0;
}

export type StockForSale = { product_id: string; stock_qty: number };
export type SaleStockLine = { product_id: string; qty: number };
export type AcceptCompleteSaleResult =
  | { ok: true; products: StockForSale[] }
  | {
      ok: false;
      code: "SALE_INVALID_LINE" | "SALE_PRODUCT_NOT_FOUND" | "SALE_INSUFFICIENT_STOCK";
      message: string;
    };

/**
 * Validates a sale and returns the resulting stock snapshot without side effects.
 * Callers must persist the returned values atomically with their sale record.
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
  for (const [productId, qty] of requested) {
    const product = byId.get(productId);
    if (!product) {
      return { ok: false, code: "SALE_PRODUCT_NOT_FOUND", message: "Produk tidak ditemukan." };
    }
    if (!Number.isInteger(product.stock_qty) || product.stock_qty < qty) {
      return {
        ok: false,
        code: "SALE_INSUFFICIENT_STOCK",
        message: "Stok tidak mencukupi untuk menyelesaikan penjualan.",
      };
    }
  }

  return {
    ok: true,
    products: products.map((product) => {
      const qty = requested.get(product.product_id) ?? 0;
      return { ...product, stock_qty: product.stock_qty - qty };
    }),
  };
}
