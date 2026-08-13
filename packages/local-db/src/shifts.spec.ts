import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  getOpenShiftFrom,
  openShiftIn,
  toSyncShiftRequest,
  type LocalShiftRecord,
  type ShiftOutboxRecord,
  type ShiftOutboxStore,
  type ShiftStore,
} from "./shifts";

function memoryShifts(seed: LocalShiftRecord[] = []): ShiftStore & {
  rows: Map<string, LocalShiftRecord>;
} {
  const rows = new Map(seed.map((row) => [row.shiftId, row]));
  return {
    rows,
    async list() {
      return [...rows.values()];
    },
    async put(row) {
      rows.set(row.shiftId, row);
    },
    async get(shiftId) {
      return rows.get(shiftId);
    },
  };
}

function memoryOutbox(
  seed: ShiftOutboxRecord[] = [],
): ShiftOutboxStore & { rows: Map<string, ShiftOutboxRecord> } {
  const rows = new Map(seed.map((row) => [row.shiftId, row]));
  return {
    rows,
    async put(row) {
      rows.set(row.shiftId, row);
    },
    async list() {
      return [...rows.values()];
    },
    async delete(shiftId) {
      rows.delete(shiftId);
    },
  };
}

describe("openShiftIn", () => {
  it("records opening cash and queues shift outbox, not a Sale", async () => {
    const store = memoryShifts();
    const outbox = memoryOutbox();
    const row = await openShiftIn(store, outbox, 150000, {
      shiftId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      openedAt: "2026-08-13T07:00:00.000Z",
    });
    assert.equal(row.openingCashMinor, 150000);
    assert.equal(row.status, "open");
    assert.equal(outbox.rows.size, 1);
    assert.deepEqual(toSyncShiftRequest(row), {
      shift_id: row.shiftId,
      opened_at: "2026-08-13T07:00:00.000Z",
      opening_cash_minor: 150000,
    });
    assert.equal(getOpenShiftFrom([...store.rows.values()])?.shiftId, row.shiftId);
  });

  it("rejects a second open while one is active", async () => {
    const open: LocalShiftRecord = {
      shiftId: "already",
      storeId: "s",
      registerId: "r",
      openedAt: "2026-08-13T07:00:00.000Z",
      openingCashMinor: 0,
      status: "open",
    };
    await assert.rejects(
      () => openShiftIn(memoryShifts([open]), memoryOutbox(), 1),
      /SHIFT_ALREADY_OPEN/,
    );
  });
});

describe("shift isolation (AD-14)", () => {
  it("never mentions sales outbox, ledger, or Cloudinary", () => {
    const src = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "shifts.ts"),
      "utf8",
    );
    assert.equal(
      /syncOutbox|completeSale|insertStockMovement|cloudinary/.test(src),
      false,
    );
  });
});
