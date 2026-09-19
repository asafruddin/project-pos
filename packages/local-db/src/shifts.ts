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
  delete(shiftId: string): Promise<void>;
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
    async delete(shiftId) {
      await db.delete("shifts", shiftId);
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

export type ServerOpenShift = {
  shiftId: string;
  storeId: string;
  registerId: string;
  openedAt: string;
  openingCashMinor: number;
};

/**
 * Server already has an open shift on this register. Join it instead of
 * retrying a rejected local open forever (SHIFT_ALREADY_OPEN).
 */
export async function adoptOpenShiftIn(
  store: ShiftStore,
  outbox: ShiftOutboxStore,
  localShiftId: string,
  server: ServerOpenShift,
  rewire?: (fromShiftId: string, toShiftId: string) => Promise<void>,
): Promise<LocalShiftRecord> {
  const adopted: LocalShiftRecord = {
    shiftId: server.shiftId,
    storeId: server.storeId,
    registerId: server.registerId,
    openedAt: server.openedAt,
    openingCashMinor: server.openingCashMinor,
    status: "open",
  };
  const existing = await store.get(server.shiftId);
  await store.put(
    existing?.status === "open"
      ? { ...existing, status: "open" }
      : existing
        ? { ...existing, ...adopted, status: "open", closedAt: undefined }
        : adopted,
  );
  if (localShiftId !== server.shiftId) {
    await rewire?.(localShiftId, server.shiftId);
    const local = await store.get(localShiftId);
    if (local) await store.delete(localShiftId);
  }
  await outbox.delete(localShiftId);
  await outbox.delete(server.shiftId);
  return (await store.get(server.shiftId)) ?? adopted;
}

async function rewireShiftDependents(
  fromShiftId: string,
  toShiftId: string,
): Promise<void> {
  if (fromShiftId === toShiftId) return;
  const db = await openLocalDb();
  const tx = db.transaction(
    ["sales", "cashMovements", "shiftCloseOutbox"],
    "readwrite",
  );
  for (const sale of await tx.objectStore("sales").getAll()) {
    if (sale.shiftId === fromShiftId) {
      await tx.objectStore("sales").put({ ...sale, shiftId: toShiftId });
    }
  }
  for (const row of await tx.objectStore("cashMovements").getAll()) {
    if (row.shiftId === fromShiftId) {
      await tx.objectStore("cashMovements").put({ ...row, shiftId: toShiftId });
    }
  }
  const close = await tx.objectStore("shiftCloseOutbox").get(fromShiftId);
  if (close) await tx.objectStore("shiftCloseOutbox").delete(fromShiftId);
  await tx.done;
}

export async function adoptServerOpenShift(
  localShiftId: string,
  server: ServerOpenShift,
): Promise<LocalShiftRecord> {
  return adoptOpenShiftIn(
    await deviceShiftStore(),
    await deviceShiftOutbox(),
    localShiftId,
    server,
    rewireShiftDependents,
  );
}
