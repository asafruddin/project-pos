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
