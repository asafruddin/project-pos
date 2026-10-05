import { desc, eq } from "drizzle-orm";
import { cashMovements, sales, shifts } from "@/infrastructure/db/schema";
import type { AppDb } from "@/infrastructure/db/types";
import { insertOutbox, type OutboxRepository } from "@/infrastructure/sync/outbox";
import type { Clock } from "@/core/ports/clock";
import type { IdGenerator } from "@/core/ports/id";
import type { ShiftRepository } from "../domain/ports";
import type { CashMovement, Shift } from "../domain/shift";

function toDomain(r: typeof shifts.$inferSelect): Shift {
  return {
    shiftId: r.shiftId,
    storeId: r.storeId,
    registerId: r.registerId,
    openedAt: r.openedAt,
    openingCashMinor: r.openingCashMinor,
    status: r.status,
    closedAt: r.closedAt,
    countedCashMinor: r.countedCashMinor,
    expectedCashMinor: r.expectedCashMinor,
    differenceMinor: r.differenceMinor,
  };
}

export class DrizzleShiftRepository implements ShiftRepository {
  constructor(
    private readonly db: AppDb,
    private readonly outbox: OutboxRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  getOpen(): Shift | null {
    const row = this.db
      .select()
      .from(shifts)
      .where(eq(shifts.status, "open"))
      .orderBy(desc(shifts.openedAt))
      .limit(1)
      .get();
    return row ? toDomain(row) : null;
  }

  list(): Shift[] {
    return this.db.select().from(shifts).orderBy(desc(shifts.openedAt)).all().map(toDomain);
  }

  open(shift: Shift): void {
    this.db.transaction((tx) => {
      tx.insert(shifts).values(shift).run();
      insertOutbox(tx, {
        id: this.ids.uuid(),
        kind: "shift.open",
        entityId: shift.shiftId,
        // Same body as the cashier PWA's OpenShiftRequest.
        payload: { shift_id: shift.shiftId, opened_at: shift.openedAt, opening_cash_minor: shift.openingCashMinor },
        createdAt: this.clock.nowMs(),
      });
    });
  }

  addCashMovement(movement: CashMovement): void {
    this.db.transaction((tx) => {
      tx.insert(cashMovements).values(movement).run();
      insertOutbox(tx, {
        id: this.ids.uuid(),
        kind: "cash.movement",
        entityId: movement.movementId,
        payload: {
          shiftId: movement.shiftId,
          request: {
            movement_id: movement.movementId,
            kind: movement.kind,
            amount_minor: movement.amountMinor,
            reason: movement.reason,
            occurred_at: movement.occurredAt,
          },
        },
        createdAt: this.clock.nowMs(),
      });
    });
  }

  listMovements(): CashMovement[] {
    return this.db.select().from(cashMovements).all();
  }

  close(closed: Shift): void {
    this.db.transaction((tx) => {
      tx.update(shifts)
        .set({
          status: "closed",
          closedAt: closed.closedAt,
          countedCashMinor: closed.countedCashMinor,
          expectedCashMinor: closed.expectedCashMinor,
          differenceMinor: closed.differenceMinor,
        })
        .where(eq(shifts.shiftId, closed.shiftId))
        .run();
      insertOutbox(tx, {
        id: this.ids.uuid(),
        kind: "shift.close",
        entityId: closed.shiftId,
        payload: {
          shiftId: closed.shiftId,
          request: {
            closed_at: closed.closedAt,
            counted_cash_minor: closed.countedCashMinor ?? 0,
            expected_cash_minor: closed.expectedCashMinor ?? 0,
          },
        },
        createdAt: this.clock.nowMs(),
      });
    });
  }

  adoptServerShift(localShiftId: string, server: Shift): void {
    if (localShiftId === server.shiftId) return;
    this.db.transaction((tx) => {
      tx.delete(shifts).where(eq(shifts.shiftId, localShiftId)).run();
      tx.insert(shifts).values(server).onConflictDoNothing().run();
      tx.update(sales).set({ shiftId: server.shiftId }).where(eq(sales.shiftId, localShiftId)).run();
      tx.update(cashMovements).set({ shiftId: server.shiftId }).where(eq(cashMovements.shiftId, localShiftId)).run();
    });
    // Queued payloads carry the shift id too.
    this.outbox.rewritePayloads("sale.sync", (payload) => {
      const body = payload as { shift_id?: string };
      return body.shift_id === localShiftId ? { ...body, shift_id: server.shiftId } : body;
    });
    for (const kind of ["cash.movement", "shift.close"] as const) {
      this.outbox.rewritePayloads(kind, (payload) => {
        const body = payload as { shiftId?: string };
        return body.shiftId === localShiftId ? { ...body, shiftId: server.shiftId } : body;
      });
    }
  }
}
