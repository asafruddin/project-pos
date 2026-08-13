import { cashTenderTotal, closeShift, expectedCash, recordCashMovement } from "@pos-apps/domain";
import type {
  CloseShiftRequest,
  RecordCashMovementRequest,
  ShiftExpectedCash,
} from "@pos-apps/types";
import {
  openLocalDb,
  type CashMovementOutboxRecord,
  type LocalCashMovementRecord,
  type LocalSaleRecord,
  type LocalShiftRecord,
  type ShiftCloseOutboxRecord,
} from "./db.js";
import type { ShiftStore } from "./shifts.js";

export type {
  CashMovementOutboxRecord,
  LocalCashMovementRecord,
  ShiftCloseOutboxRecord,
};

export type CashMovementStore = {
  list(): Promise<LocalCashMovementRecord[]>;
  put(row: LocalCashMovementRecord): Promise<void>;
  get(movementId: string): Promise<LocalCashMovementRecord | undefined>;
};

export type CashMovementOutboxStore = {
  put(row: CashMovementOutboxRecord): Promise<void>;
  list(): Promise<CashMovementOutboxRecord[]>;
  delete(movementId: string): Promise<void>;
};

export type ShiftCloseOutboxStore = {
  put(row: ShiftCloseOutboxRecord): Promise<void>;
  list(): Promise<ShiftCloseOutboxRecord[]>;
  delete(shiftId: string): Promise<void>;
};

export type SaleReader = {
  list(): Promise<LocalSaleRecord[]>;
};

function cashSaleAmount(sale: LocalSaleRecord): number {
  if (sale.status !== "complete") return 0;
  return cashTenderTotal({
    method: sale.payment?.method,
    amount_minor: sale.payment?.amountMinor,
    tenders: sale.payment?.tenders?.map((row) => ({
      method: row.method,
      amount_minor: row.amountMinor,
    })),
  });
}

export function expectedCashFromLocal(input: {
  shift: LocalShiftRecord;
  sales: LocalSaleRecord[];
  movements: LocalCashMovementRecord[];
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
  const parsed = expectedCash({
    opening_cash_minor: input.shift.openingCashMinor,
    cash_sales_minor,
    cash_in_minor,
    cash_out_minor,
    cash_refunds_minor: input.cashRefundsMinor ?? 0,
    cash_voids_minor,
  });
  if (!parsed.ok) throw new Error(parsed.code);
  return {
    opening_cash_minor: input.shift.openingCashMinor,
    cash_sales_minor,
    cash_in_minor,
    cash_out_minor,
    cash_refunds_minor: input.cashRefundsMinor ?? 0,
    cash_voids_minor,
    expected_cash_minor: parsed.expected_cash_minor,
  };
}

export async function recordCashMovementIn(
  shifts: ShiftStore,
  movements: CashMovementStore,
  outbox: CashMovementOutboxStore,
  input: {
    kind: "in" | "out";
    amountMinor: number;
    reason: string;
    movementId?: string;
    occurredAt?: string;
  },
): Promise<LocalCashMovementRecord> {
  const shift = (await shifts.list()).find((row) => row.status === "open");
  const parsed = recordCashMovement({
    kind: input.kind,
    amount_minor: input.amountMinor,
    reason: input.reason,
    shift_open: Boolean(shift),
  });
  if (!parsed.ok) throw new Error(parsed.code);
  if (!shift) throw new Error("SHIFT_NOT_OPEN");
  const occurredAt = input.occurredAt ?? new Date().toISOString();
  const record: LocalCashMovementRecord = {
    movementId: input.movementId ?? crypto.randomUUID(),
    shiftId: shift.shiftId,
    kind: parsed.kind,
    amountMinor: parsed.amount_minor,
    reason: parsed.reason,
    occurredAt,
  };
  await movements.put(record);
  await outbox.put({ movementId: record.movementId, enqueuedAt: occurredAt });
  return record;
}

export async function closeShiftIn(
  shifts: ShiftStore,
  closeOutbox: ShiftCloseOutboxStore,
  sales: SaleReader,
  movements: CashMovementStore,
  countedCashMinor: number,
  opts?: { closedAt?: string; cashRefundsMinor?: number },
): Promise<LocalShiftRecord> {
  const shift = (await shifts.list()).find((row) => row.status === "open");
  if (!shift) throw new Error("SHIFT_NOT_OPEN");
  const expected = expectedCashFromLocal({
    shift,
    sales: await sales.list(),
    movements: await movements.list(),
    cashRefundsMinor: opts?.cashRefundsMinor,
  });
  const parsed = closeShift({
    status: shift.status,
    counted_cash_minor: countedCashMinor,
    expected_cash_minor: expected.expected_cash_minor,
  });
  if (!parsed.ok) throw new Error(parsed.code);
  const closedAt = opts?.closedAt ?? new Date().toISOString();
  const closed: LocalShiftRecord = {
    ...shift,
    status: "closed",
    closedAt,
    countedCashMinor: parsed.counted_cash_minor,
    expectedCashMinor: parsed.expected_cash_minor,
    differenceMinor: parsed.difference_minor,
  };
  await shifts.put(closed);
  await closeOutbox.put({ shiftId: closed.shiftId, enqueuedAt: closedAt });
  return closed;
}

export function toSyncCashMovementRequest(
  row: LocalCashMovementRecord,
): RecordCashMovementRequest {
  return {
    movement_id: row.movementId,
    kind: row.kind,
    amount_minor: row.amountMinor,
    reason: row.reason,
    occurred_at: row.occurredAt,
  };
}

export function toCloseShiftRequest(row: LocalShiftRecord): CloseShiftRequest {
  return {
    closed_at: row.closedAt ?? new Date().toISOString(),
    counted_cash_minor: row.countedCashMinor ?? 0,
    expected_cash_minor: row.expectedCashMinor ?? 0,
  };
}

async function deviceMovements(): Promise<CashMovementStore> {
  const db = await openLocalDb();
  return {
    async list() {
      return db.getAll("cashMovements");
    },
    async put(row) {
      await db.put("cashMovements", row);
    },
    async get(movementId) {
      return db.get("cashMovements", movementId);
    },
  };
}

async function deviceMovementOutbox(): Promise<CashMovementOutboxStore> {
  const db = await openLocalDb();
  return {
    async put(row) {
      await db.put("cashMovementOutbox", row);
    },
    async list() {
      return db.getAll("cashMovementOutbox");
    },
    async delete(movementId) {
      await db.delete("cashMovementOutbox", movementId);
    },
  };
}

async function deviceCloseOutbox(): Promise<ShiftCloseOutboxStore> {
  const db = await openLocalDb();
  return {
    async put(row) {
      await db.put("shiftCloseOutbox", row);
    },
    async list() {
      return db.getAll("shiftCloseOutbox");
    },
    async delete(shiftId) {
      await db.delete("shiftCloseOutbox", shiftId);
    },
  };
}

async function deviceShifts(): Promise<ShiftStore> {
  const db = await openLocalDb();
  return {
    async list() {
      return db.getAll("shifts");
    },
    async put(row) {
      await db.put("shifts", row);
    },
    async get(shiftId) {
      return db.get("shifts", shiftId);
    },
  };
}

async function deviceSales(): Promise<SaleReader> {
  const db = await openLocalDb();
  return {
    async list() {
      return db.getAll("sales");
    },
  };
}

export async function recordLocalCashMovement(input: {
  kind: "in" | "out";
  amountMinor: number;
  reason: string;
}): Promise<LocalCashMovementRecord> {
  return recordCashMovementIn(
    await deviceShifts(),
    await deviceMovements(),
    await deviceMovementOutbox(),
    input,
  );
}

export async function closeLocalShift(
  countedCashMinor: number,
  opts?: { cashRefundsMinor?: number },
): Promise<LocalShiftRecord> {
  return closeShiftIn(
    await deviceShifts(),
    await deviceCloseOutbox(),
    await deviceSales(),
    await deviceMovements(),
    countedCashMinor,
    { cashRefundsMinor: opts?.cashRefundsMinor },
  );
}

export async function computeLocalExpectedCash(
  shift: LocalShiftRecord,
  cashRefundsMinor = 0,
): Promise<ShiftExpectedCash> {
  return expectedCashFromLocal({
    shift,
    sales: await (await deviceSales()).list(),
    movements: await (await deviceMovements()).list(),
    cashRefundsMinor,
  });
}

export async function listPendingCashMovements(): Promise<
  LocalCashMovementRecord[]
> {
  const outbox = await (await deviceMovementOutbox()).list();
  const store = await deviceMovements();
  const rows: LocalCashMovementRecord[] = [];
  for (const item of outbox) {
    const row = await store.get(item.movementId);
    if (row) rows.push(row);
  }
  return rows;
}

export async function markCashMovementSynced(movementId: string): Promise<void> {
  await (await deviceMovementOutbox()).delete(movementId);
}

export async function listPendingShiftCloses(): Promise<LocalShiftRecord[]> {
  const outbox = await (await deviceCloseOutbox()).list();
  const store = await deviceShifts();
  const rows: LocalShiftRecord[] = [];
  for (const item of outbox) {
    const shift = await store.get(item.shiftId);
    if (shift) rows.push(shift);
  }
  return rows;
}

export async function markShiftCloseSynced(shiftId: string): Promise<void> {
  await (await deviceCloseOutbox()).delete(shiftId);
}
