import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { nextQueueNumber, type QueueNumberInput } from "./index";

const base: QueueNumberInput = {
  mode: "daily",
  resetAt: null,
  dayStart: "2026-10-08T00:00:00.000Z",
  shiftOpenedAt: null,
  sales: [],
};

describe("nextQueueNumber", () => {
  it("starts at 1 and continues within the day", () => {
    assert.equal(nextQueueNumber(base), 1);
    const sales = [
      { completedAt: "2026-10-08T01:00:00.000Z", queueNumber: 1 },
      { completedAt: "2026-10-08T02:00:00.000Z", queueNumber: 2 },
    ];
    assert.equal(nextQueueNumber({ ...base, sales }), 3);
  });

  it("restarts at 1 on a new day (daily)", () => {
    const sales = [{ completedAt: "2026-10-07T23:59:00.000Z", queueNumber: 41 }];
    assert.equal(nextQueueNumber({ ...base, sales }), 1);
  });

  it("restarts when a new shift opens (shift)", () => {
    const sales = [
      { completedAt: "2026-10-08T01:00:00.000Z", queueNumber: 1 },
      { completedAt: "2026-10-08T05:00:00.000Z", queueNumber: 2 },
    ];
    const input = { ...base, mode: "shift" as const, sales };
    assert.equal(nextQueueNumber({ ...input, shiftOpenedAt: "2026-10-08T00:30:00.000Z" }), 3);
    assert.equal(nextQueueNumber({ ...input, shiftOpenedAt: "2026-10-08T06:00:00.000Z" }), 1);
  });

  it("always restarts when a new shift opens, in every mode", () => {
    const sales = [
      { completedAt: "2026-10-08T01:00:00.000Z", queueNumber: 1 },
      { completedAt: "2026-10-08T05:00:00.000Z", queueNumber: 2 },
    ];
    for (const mode of ["daily", "shift", "manual"] as const) {
      assert.equal(nextQueueNumber({ ...base, mode, sales, shiftOpenedAt: "2026-10-08T00:30:00.000Z" }), 3, mode);
      assert.equal(nextQueueNumber({ ...base, mode, sales, shiftOpenedAt: "2026-10-08T06:00:00.000Z" }), 1, mode);
    }
  });

  it("manual mode never resets by itself but honours resetAt in every mode", () => {
    const sales = [{ completedAt: "2026-09-01T01:00:00.000Z", queueNumber: 9 }];
    assert.equal(nextQueueNumber({ ...base, mode: "manual", sales }), 10);
    assert.equal(
      nextQueueNumber({ ...base, mode: "manual", sales, resetAt: "2026-09-02T00:00:00.000Z" }),
      1,
    );
    const today = [{ completedAt: "2026-10-08T01:00:00.000Z", queueNumber: 4 }];
    assert.equal(nextQueueNumber({ ...base, sales: today, resetAt: "2026-10-08T02:00:00.000Z" }), 1);
  });

  it("counts legacy sales without a number so numbers never repeat", () => {
    const sales = [
      { completedAt: "2026-10-08T01:00:00.000Z" },
      { completedAt: "2026-10-08T02:00:00.000Z", queueNumber: null },
    ];
    assert.equal(nextQueueNumber({ ...base, sales }), 3);
  });
});
