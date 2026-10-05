import type { CashMovement, CashSaleView, Shift } from "./shift";

export interface ShiftRepository {
  getOpen(): Shift | null;
  list(): Shift[];
  /** Persist a new open shift and queue it for sync, atomically. */
  open(shift: Shift): void;
  addCashMovement(movement: CashMovement): void;
  listMovements(): CashMovement[];
  /** Mark the shift closed and queue the close for sync, atomically. */
  close(closed: Shift): void;
  /**
   * The server already had an open shift (opened on another device or before a reinstall).
   * Re-point local shift, sales, movements and queued payloads to the server's id.
   */
  adoptServerShift(localShiftId: string, server: Shift): void;
}

export interface CashSalesReader {
  listCashViews(): CashSaleView[];
}

/** Shift detail from the server (online only): refunds paid out of the drawer. */
export interface ShiftRemote {
  cashRefundsMinor(shiftId: string): Promise<number>;
}
