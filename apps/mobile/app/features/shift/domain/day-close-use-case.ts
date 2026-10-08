import type { SalesRepository } from "@/features/checkout/domain/ports";
import type { ShiftRepository } from "./ports";
import { buildDayCloseSummary, currentShiftScope, type DayCloseSummary } from "./day-close";

export class DayCloseSummaryUseCase {
  constructor(
    private readonly sales: SalesRepository,
    private readonly shifts: ShiftRepository,
  ) {}

  /** Recap of the current shift only (open, or the one just closed), not of earlier shifts. */
  execute(): DayCloseSummary {
    const scope = currentShiftScope(this.shifts.list());
    const sales = scope ? this.sales.listForShift(scope.shiftId).reverse() : []; // newest first
    return buildDayCloseSummary({
      sales,
      unsyncedSaleIds: this.sales.unsyncedSaleIds(),
      openShift: this.shifts.getOpen(),
      closedShifts: scope && scope.status === "closed" ? [scope] : [],
    });
  }
}
