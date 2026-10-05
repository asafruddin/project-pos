import { closeShift, openShift, recordCashMovement } from "@pos-apps/domain";
import type { ShiftExpectedCash } from "@pos-apps/types";
import { AppError } from "@/core/errors/app-error";
import type { Clock } from "@/core/ports/clock";
import type { IdGenerator } from "@/core/ports/id";
import type { Session } from "@/features/auth/domain/session";
import { computeExpectedCash } from "./expected-cash";
import type { CashSalesReader, ShiftRemote, ShiftRepository } from "./ports";
import type { CashMovement, Shift } from "./shift";

export class OpenShiftUseCase {
  constructor(
    private readonly shifts: ShiftRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    private readonly session: () => Session | null,
    private readonly onQueued: () => void,
  ) {}

  execute(openingCashMinor: number): Shift {
    const existing = this.shifts.getOpen();
    const parsed = openShift({ opening_cash_minor: openingCashMinor, already_open: Boolean(existing) });
    if (!parsed.ok) {
      if (parsed.code === "SHIFT_ALREADY_OPEN" && existing) return existing;
      throw new AppError("VALIDATION", parsed.code);
    }
    const session = this.session();
    const shift: Shift = {
      shiftId: this.ids.uuid(),
      storeId: session?.storeId ?? null,
      registerId: session?.registerId ?? null,
      openedAt: this.clock.nowIso(),
      openingCashMinor: parsed.opening_cash_minor,
      status: "open",
      closedAt: null,
      countedCashMinor: null,
      expectedCashMinor: null,
      differenceMinor: null,
    };
    this.shifts.open(shift);
    this.onQueued();
    return shift;
  }
}

export class RecordCashMovementUseCase {
  constructor(
    private readonly shifts: ShiftRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    private readonly onQueued: () => void,
  ) {}

  execute(input: { kind: "in" | "out"; amountMinor: number; reason: string }): CashMovement {
    const shift = this.shifts.getOpen();
    const parsed = recordCashMovement({
      kind: input.kind,
      amount_minor: input.amountMinor,
      reason: input.reason,
      shift_open: Boolean(shift),
    });
    if (!parsed.ok) throw new AppError("VALIDATION", parsed.code);
    if (!shift) throw new AppError("NO_OPEN_SHIFT");
    const movement: CashMovement = {
      movementId: this.ids.uuid(),
      shiftId: shift.shiftId,
      kind: parsed.kind,
      amountMinor: parsed.amount_minor,
      reason: parsed.reason,
      occurredAt: this.clock.nowIso(),
    };
    this.shifts.addCashMovement(movement);
    this.onQueued();
    return movement;
  }
}

/** Expected cash for the open shift. `cashRefundsMinor` comes from the server when online. */
export class ShiftSummaryUseCase {
  constructor(
    private readonly shifts: ShiftRepository,
    private readonly sales: CashSalesReader,
    private readonly remote: ShiftRemote,
    private readonly online: () => boolean,
  ) {}

  /** Local-only summary (instant). Pass the refunds fetched by `refunds()` once known. */
  local(cashRefundsMinor = 0): { shift: Shift; expected: ShiftExpectedCash; cashRefundsMinor: number } | null {
    const shift = this.shifts.getOpen();
    if (!shift) return null;
    return { shift, expected: this.compute(shift, cashRefundsMinor), cashRefundsMinor };
  }

  /** Cash refunds recorded on the server for this shift; 0 when offline or on any failure. */
  async refunds(): Promise<number> {
    const shift = this.shifts.getOpen();
    if (!shift || !this.online()) return 0;
    try {
      return await this.remote.cashRefundsMinor(shift.shiftId);
    } catch {
      return 0;
    }
  }

  async execute(): Promise<{ shift: Shift; expected: ShiftExpectedCash; cashRefundsMinor: number } | null> {
    return this.local(await this.refunds());
  }

  compute(shift: Shift, cashRefundsMinor: number): ShiftExpectedCash {
    return computeExpectedCash({
      shift,
      sales: this.sales.listCashViews(),
      movements: this.shifts.listMovements(),
      cashRefundsMinor,
    });
  }
}

export class CloseShiftUseCase {
  constructor(
    private readonly shifts: ShiftRepository,
    private readonly summary: ShiftSummaryUseCase,
    private readonly clock: Clock,
    private readonly onQueued: () => void,
  ) {}

  execute(countedCashMinor: number, cashRefundsMinor = 0): Shift {
    const shift = this.shifts.getOpen();
    if (!shift) throw new AppError("NO_OPEN_SHIFT");
    const expected = this.summary.compute(shift, cashRefundsMinor);
    const parsed = closeShift({
      status: shift.status,
      counted_cash_minor: countedCashMinor,
      expected_cash_minor: expected.expected_cash_minor,
    });
    if (!parsed.ok) throw new AppError("VALIDATION", parsed.code);
    const closed: Shift = {
      ...shift,
      status: "closed",
      closedAt: this.clock.nowIso(),
      countedCashMinor: parsed.counted_cash_minor,
      expectedCashMinor: parsed.expected_cash_minor,
      differenceMinor: parsed.difference_minor,
    };
    this.shifts.close(closed);
    this.onQueued();
    return closed;
  }
}
