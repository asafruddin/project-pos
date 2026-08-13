import { openShift } from "@pos-apps/domain";
import type { OpenShiftRequest } from "@pos-apps/types";
import { REGISTER_1_ID, STORE_1_ID } from "@pos-apps/types";
import {
  openLocalDb,
  type LocalShiftRecord,
  type ShiftOutboxRecord,
} from "./db.js";

export type { LocalShiftRecord, ShiftOutboxRecord };

export type ShiftStore = {
  list(): Promise<LocalShiftRecord[]>;
  put(row: LocalShiftRecord): Promise<void>;
  get(shiftId: string): Promise<LocalShiftRecord | undefined>;
};

export type ShiftOutboxStore = {
  put(row: ShiftOutboxRecord): Promise<void>;
  list(): Promise<ShiftOutboxRecord[]>;
  delete(shiftId: string): Promise<void>;
};

export function getOpenShiftFrom(
  rows: LocalShiftRecord[],
): LocalShiftRecord | null {
  return rows.find((row) => row.status === "open") ?? null;
}

export async function openShiftIn(
  store: ShiftStore,
  outbox: ShiftOutboxStore,
  openingCashMinor: number,
  opts?: { shiftId?: string; openedAt?: string },
): Promise<LocalShiftRecord> {
  const existing = getOpenShiftFrom(await store.list());
  const parsed = openShift({
    opening_cash_minor: openingCashMinor,
    already_open: Boolean(existing),
  });
  if (!parsed.ok) throw new Error(parsed.code);
  const openedAt = opts?.openedAt ?? new Date().toISOString();
  const record: LocalShiftRecord = {
    shiftId: opts?.shiftId ?? crypto.randomUUID(),
    storeId: STORE_1_ID,
    registerId: REGISTER_1_ID,
    openedAt,
    openingCashMinor: parsed.opening_cash_minor,
    status: "open",
  };
  await store.put(record);
  await outbox.put({ shiftId: record.shiftId, enqueuedAt: openedAt });
  return record;
}

export function toSyncShiftRequest(row: LocalShiftRecord): OpenShiftRequest {
  return {
    shift_id: row.shiftId,
    opened_at: row.openedAt,
    opening_cash_minor: row.openingCashMinor,
  };
}

async function deviceShiftStore(): Promise<ShiftStore> {
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

async function deviceShiftOutbox(): Promise<ShiftOutboxStore> {
  const db = await openLocalDb();
  return {
    async put(row) {
      await db.put("shiftOutbox", row);
    },
    async list() {
      return db.getAll("shiftOutbox");
    },
    async delete(shiftId) {
      await db.delete("shiftOutbox", shiftId);
    },
  };
}

export async function getOpenShift(): Promise<LocalShiftRecord | null> {
  return getOpenShiftFrom(await (await deviceShiftStore()).list());
}

export async function openLocalShift(
  openingCashMinor: number,
): Promise<LocalShiftRecord> {
  return openShiftIn(
    await deviceShiftStore(),
    await deviceShiftOutbox(),
    openingCashMinor,
  );
}

export async function listPendingShiftOpens(): Promise<LocalShiftRecord[]> {
  const outbox = await (await deviceShiftOutbox()).list();
  const store = await deviceShiftStore();
  const rows: LocalShiftRecord[] = [];
  for (const item of outbox) {
    const shift = await store.get(item.shiftId);
    if (shift) rows.push(shift);
  }
  return rows;
}

export async function markShiftSynced(shiftId: string): Promise<void> {
  await (await deviceShiftOutbox()).delete(shiftId);
}
