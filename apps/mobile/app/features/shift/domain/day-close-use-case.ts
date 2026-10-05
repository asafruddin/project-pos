import type { SalesRepository } from "@/features/checkout/domain/ports";
import type { ShiftRepository } from "./ports";
import { buildDayCloseSummary, closedShiftsForLocalDay, type DayCloseSummary } from "./day-close";

export class DayCloseSummaryUseCase {
  constructor(
    private readonly sales: SalesRepository,
    private readonly shifts: ShiftRepository,
  ) {}

  execute(day: Date = new Date()): DayCloseSummary {
    return buildDayCloseSummary({
      sales: this.sales.listForLocalDay(day),
      unsyncedSaleIds: this.sales.unsyncedSaleIds(),
      openShift: this.shifts.getOpen(),
      closedShifts: closedShiftsForLocalDay(this.shifts.list(), day),
    });
  }
}
