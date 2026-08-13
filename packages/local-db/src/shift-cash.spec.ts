import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  closeShiftIn,
  expectedCashFromLocal,
  recordCashMovementIn,
  toCloseShiftRequest,
  toSyncCashMovementRequest,
  type CashMovementOutboxStore,
  type CashMovementStore,
  type ShiftCloseOutboxStore,
} from "./shift-cash";
import type { LocalSaleRecord, LocalShiftRecord } from "./db";
import type { ShiftStore } from "./shifts";

const openShift: LocalShiftRecord = {
  shiftId: "shift-1",
  storeId: "s",
  registerId: "r",
  openedAt: "2026-08-13T07:00:00.000Z",
  openingCashMinor: 100000,
  status: "open",
};

function memoryShifts(seed: LocalShiftRecord[] = []): ShiftStore {
  const rows = new Map(seed.map((row) => [row.shiftId, row]));
  return {
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

function memoryMovements(): CashMovementStore & {
  rows: Map<string, import("./db").LocalCashMovementRecord>;
} {
  const rows = new Map();
  return {
    rows,
    async list() {
      return [...rows.values()];
    },
    async put(row) {
      rows.set(row.movementId, row);
    },
    async get(id) {
      return rows.get(id);
    },
  };
}

function memoryMovementOutbox(): CashMovementOutboxStore & {
  rows: Map<string, { movementId: string; enqueuedAt: string }>;
} {
  const rows = new Map();
  return {
    rows,
    async put(row) {
      rows.set(row.movementId, row);
    },
    async list() {
      return [...rows.values()];
    },
    async delete(id) {
      rows.delete(id);
    },
  };
}

function memoryCloseOutbox(): ShiftCloseOutboxStore & {
  rows: Map<string, { shiftId: string; enqueuedAt: string }>;
} {
  const rows = new Map();
  return {
    rows,
    async put(row) {
      rows.set(row.shiftId, row);
    },
    async list() {
      return [...rows.values()];
    },
    async delete(id) {
      rows.delete(id);
    },
  };
}

describe("recordCashMovementIn", () => {
  it("records cash in with a reason and does not touch stock", async () => {
    const movements = memoryMovements();
    const outbox = memoryMovementOutbox();
    const row = await recordCashMovementIn(
      memoryShifts([openShift]),
      movements,
      outbox,
      {
        kind: "in",
        amountMinor: 20000,
        reason: "isi laci",
        movementId: "mov-1",
        occurredAt: "2026-08-13T08:00:00.000Z",
      },
    );
    assert.equal(row.kind, "in");
    assert.equal(outbox.rows.size, 1);
    assert.deepEqual(toSyncCashMovementRequest(row), {
      movement_id: "mov-1",
      kind: "in",
      amount_minor: 20000,
      reason: "isi laci",
      occurred_at: "2026-08-13T08:00:00.000Z",
    });
  });

  it("rejects cash out without an open shift", async () => {
    await assert.rejects(
      () =>
        recordCashMovementIn(
          memoryShifts([]),
          memoryMovements(),
          memoryMovementOutbox(),
          { kind: "out", amountMinor: 1, reason: "tip" },
        ),
      /SHIFT_NOT_OPEN/,
    );
  });
});

describe("expectedCashFromLocal", () => {
  it("includes cash sales and subtracts cash voids, not non-cash", () => {
    const sales: LocalSaleRecord[] = [
      {
        saleId: "s1",
        deviceId: "d",
        createdAt: "2026-08-13T08:00:00.000Z",
        completedAt: "2026-08-13T08:00:00.000Z",
        status: "complete",
        payment: { method: "cash", amountMinor: 50000 },
        lines: [],
        shiftId: "shift-1",
      },
      {
        saleId: "s2",
        deviceId: "d",
        createdAt: "2026-08-13T08:10:00.000Z",
        completedAt: "2026-08-13T08:10:00.000Z",
        status: "complete",
        payment: { method: "cash", amountMinor: 25000 },
        lines: [],
        shiftId: "shift-1",
        voidedAt: "2026-08-13T08:20:00.000Z",
      },
    ];
    const result = expectedCashFromLocal({
      shift: openShift,
      sales,
      movements: [
        {
          movementId: "m1",
          shiftId: "shift-1",
          kind: "in",
          amountMinor: 10000,
          reason: "isi",
          occurredAt: "2026-08-13T08:05:00.000Z",
        },
        {
          movementId: "m2",
          shiftId: "shift-1",
          kind: "out",
          amountMinor: 5000,
          reason: "tip",
          occurredAt: "2026-08-13T08:06:00.000Z",
        },
      ],
      cashRefundsMinor: 2000,
    });
    assert.equal(result.expected_cash_minor, 153000);
    assert.equal(result.cash_sales_minor, 75000);
    assert.equal(result.cash_voids_minor, 25000);
  });

  it("counts only the cash tender of a split payment", () => {
    const result = expectedCashFromLocal({
      shift: openShift,
      sales: [
        {
          saleId: "s3",
          deviceId: "d",
          createdAt: "2026-08-13T08:00:00.000Z",
          completedAt: "2026-08-13T08:00:00.000Z",
          status: "complete",
          payment: {
            method: "split",
            amountMinor: 50000,
            tenders: [
              { method: "cash", amountMinor: 30000 },
              { method: "store_credit", amountMinor: 20000 },
            ],
          },
          lines: [],
          shiftId: "shift-1",
        },
      ],
      movements: [],
    });
    assert.equal(result.cash_sales_minor, 30000);
    assert.equal(result.expected_cash_minor, 130000);
  });
});

describe("closeShiftIn", () => {
  it("snapshots counted vs expected and does not drain sale sync", async () => {
    const shifts = memoryShifts([openShift]);
    const closeOutbox = memoryCloseOutbox();
    const closed = await closeShiftIn(
      shifts,
      closeOutbox,
      { async list() { return []; } },
      memoryMovements(),
      90000,
      { closedAt: "2026-08-13T16:00:00.000Z" },
    );
    assert.equal(closed.status, "closed");
    assert.equal(closed.differenceMinor, -10000);
    assert.equal(closeOutbox.rows.size, 1);
    assert.deepEqual(toCloseShiftRequest(closed), {
      closed_at: "2026-08-13T16:00:00.000Z",
      counted_cash_minor: 90000,
      expected_cash_minor: 100000,
    });
    assert.equal((await shifts.list()).find((row) => row.status === "open"), undefined);
  });
});

describe("shift-cash isolation (AD-4 / AD-8 / AD-14)", () => {
  it("never drains sale sync, writes ledger, or imports Cloudinary", () => {
    const src = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "shift-cash.ts"),
      "utf8",
    );
    assert.equal(/syncOutbox|insertStockMovement|cloudinary/.test(src), false);
  });
});
