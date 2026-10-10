import type { CurrentShiftResponse } from "@pos-apps/types";
import { AppError } from "@/core/errors/app-error";
import type { OutboxHandler } from "@/infrastructure/sync/sync-engine";
import type { ShiftRepository } from "../domain/ports";

/** POST /shifts. If the server already has an open shift, adopt it instead of failing. */
export function createShiftOpenHandler(shifts: ShiftRepository, onAdopted?: () => void): OutboxHandler {
  return async (row, { http }) => {
    try {
      await http.request({ method: "POST", path: "/shifts", body: row.payload });
    } catch (error) {
      if (!(error instanceof AppError) || error.apiCode !== "SHIFT_ALREADY_OPEN") throw error;
      const current = await http.request<CurrentShiftResponse>({ method: "GET", path: "/shifts/current" });
      if (!current.shift) throw error;
      // The "open" shift on the server is one we already closed locally: its close has not reached the
      // server yet (queued, or dead and awaiting a retry). Adopting it would delete the shift just opened
      // and leave the till with no open shift, so the open-shift dialog would keep coming back.
      if (shifts.list().some((s) => s.shiftId === current.shift?.shift_id)) throw error;
      shifts.adoptServerShift(row.entityId, {
        shiftId: current.shift.shift_id,
        storeId: current.shift.store_id,
        registerId: current.shift.register_id,
        openedAt: current.shift.opened_at,
        openingCashMinor: current.shift.opening_cash_minor,
        status: "open",
        closedAt: null,
        countedCashMinor: null,
        expectedCashMinor: null,
        differenceMinor: null,
      });
      onAdopted?.();
    }
  };
}

type ShiftScopedPayload = { shiftId: string; request: unknown };

/** POST /shifts/:id/cash */
export const cashMovementHandler: OutboxHandler = async (row, { http }) => {
  const { shiftId, request } = row.payload as ShiftScopedPayload;
  await http.request({ method: "POST", path: `/shifts/${shiftId}/cash`, body: request });
};

/** POST /shifts/:id/close */
export const shiftCloseHandler: OutboxHandler = async (row, { http }) => {
  const { shiftId, request } = row.payload as ShiftScopedPayload;
  await http.request({ method: "POST", path: `/shifts/${shiftId}/close`, body: request });
};
