import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  cashTenderTotal,
  closeShift,
  expectedCash,
  openShift,
  recordCashMovement,
} from "@pos-apps/domain";
import type {
  CloseShiftRequest,
  CloseShiftResponse,
  CurrentShiftResponse,
  OpenShiftRequest,
  OpenShiftResponse,
  RecordCashMovementRequest,
  RecordCashMovementResponse,
  Shift,
  ShiftCashMovement,
  ShiftDetailResponse,
  ShiftExpectedCash,
  ShiftListResponse,
} from "@pos-apps/types";
import { REGISTER_1_ID, STORE_1_ID } from "@pos-apps/types";
import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "../db/client";
import {
  saleReturns,
  sales,
  saleVoids,
  shiftCashMovements,
  shifts,
  users,
} from "../db/schema";

function mapShift(
  row: typeof shifts.$inferSelect,
  actorLogin?: string | null,
): Shift {
  return {
    shift_id: row.shiftId,
    store_id: row.storeId,
    register_id: row.registerId,
    opened_at: row.openedAt.toISOString(),
    opening_cash_minor: row.openingCashMinor,
    status: row.status,
    closed_at: row.closedAt ? row.closedAt.toISOString() : null,
    counted_cash_minor: row.countedCashMinor ?? null,
    expected_cash_minor: row.expectedCashMinor ?? null,
    difference_minor: row.differenceMinor ?? null,
    actor_id: row.actorId ?? null,
    actor_login: actorLogin ?? null,
  };
}

function mapMovement(
  row: typeof shiftCashMovements.$inferSelect,
): ShiftCashMovement {
  return {
    movement_id: row.movementId,
    shift_id: row.shiftId,
    kind: row.kind,
    amount_minor: row.amountMinor,
    reason: row.reason,
    occurred_at: row.occurredAt.toISOString(),
  };
}

function cashSaleAmount(row: typeof sales.$inferSelect): number {
  return cashTenderTotal({
    method: row.payment?.method,
    amount_minor: row.payment?.amount_minor ?? row.amountMinor,
    tenders: row.payment?.tenders,
  });
}

@Injectable()
export class ShiftsService {
  async current(): Promise<CurrentShiftResponse> {
    const rows = await getDb()
      .select()
      .from(shifts)
      .where(
        and(eq(shifts.registerId, REGISTER_1_ID), eq(shifts.status, "open")),
      )
      .limit(1);
    return { shift: rows[0] ? mapShift(rows[0]) : null };
  }

  async list(): Promise<ShiftListResponse> {
    const rows = await getDb()
      .select({
        shift: shifts,
        actorLogin: users.username,
      })
      .from(shifts)
      .leftJoin(users, eq(users.userId, shifts.actorId))
      .orderBy(desc(shifts.openedAt));
    return {
      shifts: rows.map((row) => mapShift(row.shift, row.actorLogin)),
    };
  }

  async get(shiftId: string): Promise<ShiftDetailResponse> {
    const db = getDb();
    const rows = await db
      .select({
        shift: shifts,
        actorLogin: users.username,
      })
      .from(shifts)
      .leftJoin(users, eq(users.userId, shifts.actorId))
      .where(eq(shifts.shiftId, shiftId))
      .limit(1);
    const row = rows[0];
    if (!row) {
      throw new NotFoundException({
        code: "SHIFT_NOT_FOUND",
        message: "Shift tidak ditemukan.",
      });
    }
    const [expected, movements] = await Promise.all([
      this.expectedFor(row.shift),
      db
        .select()
        .from(shiftCashMovements)
        .where(eq(shiftCashMovements.shiftId, shiftId))
        .orderBy(desc(shiftCashMovements.occurredAt)),
    ]);
    return {
      shift: mapShift(row.shift, row.actorLogin),
      expected,
      movements: movements.map(mapMovement),
    };
  }

  async open(
    input: OpenShiftRequest,
    actorId?: string,
  ): Promise<OpenShiftResponse> {
    if (!Number.isFinite(Date.parse(input.opened_at))) {
      throw new BadRequestException({
        code: "SHIFT_INVALID_OPENING",
        message: "Waktu buka shift tidak valid.",
      });
    }

    const db = getDb();
    const existing = await db
      .select()
      .from(shifts)
      .where(eq(shifts.shiftId, input.shift_id))
      .limit(1);
    if (existing[0]) {
      return { shift: mapShift(existing[0]), already_accepted: true };
    }

    const openRows = await db
      .select({ shiftId: shifts.shiftId })
      .from(shifts)
      .where(
        and(eq(shifts.registerId, REGISTER_1_ID), eq(shifts.status, "open")),
      )
      .limit(1);

    const parsed = openShift({
      opening_cash_minor: input.opening_cash_minor,
      already_open: openRows.length > 0,
    });
    if (!parsed.ok) {
      throw new BadRequestException({
        code: parsed.code,
        message: parsed.message,
      });
    }

    try {
      const [row] = await db
        .insert(shifts)
        .values({
          shiftId: input.shift_id,
          storeId: STORE_1_ID,
          registerId: REGISTER_1_ID,
          openedAt: new Date(input.opened_at),
          openingCashMinor: parsed.opening_cash_minor,
          status: "open",
          actorId: actorId ?? null,
        })
        .returning();
      if (!row) {
        throw new BadRequestException({
          code: "SHIFT_INVALID_OPENING",
          message: "Tidak dapat membuka shift.",
        });
      }
      return { shift: mapShift(row), already_accepted: false };
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      const raced = await db
        .select()
        .from(shifts)
        .where(eq(shifts.shiftId, input.shift_id))
        .limit(1);
      if (raced[0]) {
        return { shift: mapShift(raced[0]), already_accepted: true };
      }
      const stillOpen = await db
        .select({ shiftId: shifts.shiftId })
        .from(shifts)
        .where(
          and(eq(shifts.registerId, REGISTER_1_ID), eq(shifts.status, "open")),
        )
        .limit(1);
      if (stillOpen.length) {
        throw new BadRequestException({
          code: "SHIFT_ALREADY_OPEN",
          message: "Shift masih terbuka. Tutup dulu sebelum buka yang baru.",
        });
      }
      throw new BadRequestException({
        code: "SHIFT_INVALID_OPENING",
        message: "Tidak dapat membuka shift.",
      });
    }
  }

  async recordCash(
    shiftId: string,
    input: RecordCashMovementRequest,
    actorId?: string,
  ): Promise<RecordCashMovementResponse> {
    if (!Number.isFinite(Date.parse(input.occurred_at))) {
      throw new BadRequestException({
        code: "SHIFT_INVALID_CASH",
        message: "Waktu kas masuk/keluar tidak valid.",
      });
    }

    const db = getDb();
    const existing = await db
      .select()
      .from(shiftCashMovements)
      .where(eq(shiftCashMovements.movementId, input.movement_id))
      .limit(1);
    if (existing[0]) {
      return { movement: mapMovement(existing[0]), already_accepted: true };
    }

    const shiftRows = await db
      .select()
      .from(shifts)
      .where(eq(shifts.shiftId, shiftId))
      .limit(1);
    const shift = shiftRows[0];
    if (!shift) {
      throw new NotFoundException({
        code: "SHIFT_NOT_FOUND",
        message: "Shift tidak ditemukan.",
      });
    }

    const occurredAt = new Date(input.occurred_at);
    const replayAfterClose =
      shift.status === "closed" &&
      shift.closedAt !== null &&
      occurredAt.getTime() <= shift.closedAt.getTime();
    const parsed = recordCashMovement({
      kind: input.kind,
      amount_minor: input.amount_minor,
      reason: input.reason,
      shift_open: shift.status === "open" || replayAfterClose,
    });
    if (!parsed.ok) {
      throw new BadRequestException({
        code: parsed.code,
        message: parsed.message,
      });
    }

    try {
      const [row] = await db
        .insert(shiftCashMovements)
        .values({
          movementId: input.movement_id,
          shiftId,
          kind: parsed.kind,
          amountMinor: parsed.amount_minor,
          reason: parsed.reason,
          occurredAt: new Date(input.occurred_at),
          actorId: actorId ?? null,
        })
        .returning();
      if (!row) {
        throw new BadRequestException({
          code: "SHIFT_INVALID_CASH",
          message: "Tidak dapat mencatat kas.",
        });
      }
      return { movement: mapMovement(row), already_accepted: false };
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      const raced = await db
        .select()
        .from(shiftCashMovements)
        .where(eq(shiftCashMovements.movementId, input.movement_id))
        .limit(1);
      if (raced[0]) {
        return { movement: mapMovement(raced[0]), already_accepted: true };
      }
      throw new BadRequestException({
        code: "SHIFT_INVALID_CASH",
        message: "Tidak dapat mencatat kas.",
      });
    }
  }

  async close(
    shiftId: string,
    input: CloseShiftRequest,
    _actorId?: string,
  ): Promise<CloseShiftResponse> {
    if (!Number.isFinite(Date.parse(input.closed_at))) {
      throw new BadRequestException({
        code: "SHIFT_INVALID_CASH",
        message: "Waktu tutup shift tidak valid.",
      });
    }

    const db = getDb();
    const existing = await db
      .select()
      .from(shifts)
      .where(eq(shifts.shiftId, shiftId))
      .limit(1);
    const shift = existing[0];
    if (!shift) {
      throw new NotFoundException({
        code: "SHIFT_NOT_FOUND",
        message: "Shift tidak ditemukan.",
      });
    }
    if (shift.status === "closed") {
      return { shift: mapShift(shift), already_accepted: true, warned: false };
    }

    const parsed = closeShift({
      status: shift.status,
      counted_cash_minor: input.counted_cash_minor,
      expected_cash_minor: input.expected_cash_minor,
    });
    if (!parsed.ok) {
      throw new BadRequestException({
        code: parsed.code,
        message: parsed.message,
      });
    }

    const [row] = await db
      .update(shifts)
      .set({
        status: "closed",
        closedAt: new Date(input.closed_at),
        countedCashMinor: parsed.counted_cash_minor,
        expectedCashMinor: parsed.expected_cash_minor,
        differenceMinor: parsed.difference_minor,
        actorId: shift.actorId,
      })
      .where(eq(shifts.shiftId, shiftId))
      .returning();
    if (!row) {
      throw new BadRequestException({
        code: "SHIFT_INVALID_CASH",
        message: "Tidak dapat menutup shift.",
      });
    }
    return {
      shift: mapShift(row),
      already_accepted: false,
      warned: parsed.warned,
    };
  }

  private async expectedFor(
    shift: typeof shifts.$inferSelect,
  ): Promise<ShiftExpectedCash> {
    const db = getDb();
    const saleRows = await db
      .select()
      .from(sales)
      .where(eq(sales.shiftId, shift.shiftId));
    const saleIds = saleRows.map((row) => row.saleId);
    const voidRows =
      saleIds.length === 0
        ? []
        : await db
            .select({ saleId: saleVoids.saleId })
            .from(saleVoids)
            .where(inArray(saleVoids.saleId, saleIds));
    const voided = new Set(voidRows.map((row) => row.saleId));

    let cash_sales_minor = 0;
    let cash_voids_minor = 0;
    for (const row of saleRows) {
      const amount = cashSaleAmount(row);
      cash_sales_minor += amount;
      if (voided.has(row.saleId)) cash_voids_minor += amount;
    }

    const refundRows = await db
      .select({ refundAmountMinor: saleReturns.refundAmountMinor })
      .from(saleReturns)
      .where(
        and(
          eq(saleReturns.shiftId, shift.shiftId),
          eq(saleReturns.status, "refunded"),
        ),
      );
    const cash_refunds_minor = refundRows.reduce(
      (sum, row) => sum + (row.refundAmountMinor ?? 0),
      0,
    );

    const movementRows = await db
      .select({
        kind: shiftCashMovements.kind,
        amountMinor: shiftCashMovements.amountMinor,
      })
      .from(shiftCashMovements)
      .where(eq(shiftCashMovements.shiftId, shift.shiftId));
    let cash_in_minor = 0;
    let cash_out_minor = 0;
    for (const row of movementRows) {
      if (row.kind === "in") cash_in_minor += row.amountMinor;
      else cash_out_minor += row.amountMinor;
    }

    const parsed = expectedCash({
      opening_cash_minor: shift.openingCashMinor,
      cash_sales_minor,
      cash_in_minor,
      cash_out_minor,
      cash_refunds_minor,
      cash_voids_minor,
    });
    if (!parsed.ok) {
      throw new BadRequestException({
        code: parsed.code,
        message: parsed.message,
      });
    }
    return {
      opening_cash_minor: shift.openingCashMinor,
      cash_sales_minor,
      cash_in_minor,
      cash_out_minor,
      cash_refunds_minor,
      cash_voids_minor,
      expected_cash_minor: parsed.expected_cash_minor,
    };
  }
}
