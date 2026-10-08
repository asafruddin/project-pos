import { buildShiftReport, type ShiftReport } from "@pos-apps/domain";
import type { SalesRepository } from "@/features/checkout/domain/ports";
import type { ShiftRepository } from "./ports";
import type { Shift } from "./shift";

/** Collects one shift's movements and sales and builds the numbers-only recap used by the PDF. */
export class ShiftReportUseCase {
  constructor(
    private readonly shifts: Pick<ShiftRepository, "listMovements">,
    private readonly sales: Pick<SalesRepository, "listForShift">,
    private readonly storeName: () => string,
  ) {}

  build(shift: Shift, refunds: { minor: number; known: boolean }): ShiftReport {
    return buildShiftReport({
      storeName: this.storeName(),
      shift: {
        openedAt: shift.openedAt,
        closedAt: shift.closedAt,
        openingCashMinor: shift.openingCashMinor,
        expectedCashMinor: shift.expectedCashMinor,
      },
      movements: this.shifts.listMovements().filter((m) => m.shiftId === shift.shiftId),
      sales: this.sales.listForShift(shift.shiftId).map((sale) => ({
        saleId: sale.saleId,
        completedAt: sale.completedAt,
        queueNumber: sale.queueNumber,
        guestName: sale.guestName,
        voided: Boolean(sale.voidedAt),
        amountMinor: sale.payment.amountMinor,
        payment: {
          method: sale.payment.method,
          amount_minor: sale.payment.amountMinor,
          tenders: sale.payment.tenders.map((t) => ({ method: t.method, amount_minor: t.amountMinor })),
        },
      })),
      cashRefundsMinor: refunds.minor,
      refundsKnown: refunds.known,
    });
  }
}
