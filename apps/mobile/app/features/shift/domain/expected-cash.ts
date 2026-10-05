import { cashTenderTotal, expectedCash } from "@pos-apps/domain";
import type { ShiftExpectedCash } from "@pos-apps/types";
import { AppError } from "@/core/errors/app-error";
import type { CashMovement, CashSaleView, Shift } from "./shift";

function cashSaleAmount(sale: CashSaleView): number {
  return cashTenderTotal({
    method: sale.paymentMethod,
    amount_minor: sale.amountMinor,
    tenders: sale.tenders.map((t) => ({ method: t.method, amount_minor: t.amountMinor })),
  });
}

/** Port of `expectedCashFromLocal` (packages/local-db/src/shift-cash.ts). */
export function computeExpectedCash(input: {
  shift: Shift;
  sales: CashSaleView[];
  movements: CashMovement[];
  cashRefundsMinor?: number;
}): ShiftExpectedCash {
  let cash_sales_minor = 0;
  let cash_voids_minor = 0;
  for (const sale of input.sales) {
    if (sale.shiftId !== input.shift.shiftId) continue;
    const amount = cashSaleAmount(sale);
    cash_sales_minor += amount;
    if (sale.voidedAt) cash_voids_minor += amount;
  }
  let cash_in_minor = 0;
  let cash_out_minor = 0;
  for (const row of input.movements) {
    if (row.shiftId !== input.shift.shiftId) continue;
    if (row.kind === "in") cash_in_minor += row.amountMinor;
    else cash_out_minor += row.amountMinor;
  }
  const refunds = input.cashRefundsMinor ?? 0;
  const parsed = expectedCash({
    opening_cash_minor: input.shift.openingCashMinor,
    cash_sales_minor,
    cash_in_minor,
    cash_out_minor,
    cash_refunds_minor: refunds,
    cash_voids_minor,
  });
  if (!parsed.ok) throw new AppError("VALIDATION", parsed.code);
  return {
    opening_cash_minor: input.shift.openingCashMinor,
    cash_sales_minor,
    cash_in_minor,
    cash_out_minor,
    cash_refunds_minor: refunds,
    cash_voids_minor,
    expected_cash_minor: parsed.expected_cash_minor,
  };
}
