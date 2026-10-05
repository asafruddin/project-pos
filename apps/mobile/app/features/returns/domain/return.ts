import type { CreateReturnRequest, ReturnDecision, SaleLookupResponse } from "@pos-apps/types";

export type ReturnDraftLine = { productId: string; qty: string; decision: ReturnDecision };

/** One draft line per sale line: 1 piece preselected, 0 when everything was already returned. */
export function initialReturnDraft(sale: SaleLookupResponse): ReturnDraftLine[] {
  return sale.lines.map((line) => ({
    productId: line.product_id,
    qty: line.returned_qty >= line.qty ? "0" : "1",
    decision: "resellable",
  }));
}

/** Only lines with a positive whole quantity are sent (same rule as the PWA form). */
export function buildReturnRequest(draft: ReturnDraftLine[], reason: string, exchangeSaleId: string): CreateReturnRequest {
  return {
    reason,
    lines: draft
      .map((l) => ({ product_id: l.productId, qty: Number.parseInt(l.qty, 10), decision: l.decision }))
      .filter((l) => Number.isInteger(l.qty) && l.qty > 0),
    exchange_sale_id: exchangeSaleId.trim() || null,
  };
}

export function remainingQty(line: { qty: number; returned_qty: number }): number {
  return line.qty - line.returned_qty;
}
