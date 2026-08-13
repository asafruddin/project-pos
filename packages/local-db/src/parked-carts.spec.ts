import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  buildParkedCart,
  discardParkedCartIn,
  getParkedCartIn,
  listParkedCartsIn,
  parkCartIn,
  resumeParkedCartIn,
  type ParkedCartRecord,
  type ParkedCartStore,
} from "./parked-carts";

function memoryStore(seed: ParkedCartRecord[] = []): ParkedCartStore & {
  rows: Map<string, ParkedCartRecord>;
} {
  const rows = new Map(seed.map((row) => [row.parkId, row]));
  return {
    rows,
    async put(row) {
      rows.set(row.parkId, row);
    },
    async get(parkId) {
      return rows.get(parkId);
    },
    async delete(parkId) {
      rows.delete(parkId);
    },
    async list() {
      return [...rows.values()];
    },
  };
}

const latte = {
  productId: "p1",
  name: "Latte",
  priceMinor: 25000,
  qty: 2,
};
const tea = {
  productId: "p2",
  name: "Teh",
  priceMinor: 10000,
  qty: 1,
};

describe("buildParkedCart", () => {
  it("snapshots lines and totals without a sale identity", () => {
    const result = buildParkedCart([latte, tea], {
      parkId: "park-1",
      createdAt: "2026-08-13T07:00:00.000Z",
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.record.parkId, "park-1");
    assert.equal(result.record.totalMinor, 60000);
    assert.equal(result.record.lines.length, 2);
    assert.equal("saleId" in result.record, false);
    assert.equal("status" in result.record, false);
  });

  it("rejects empty and invalid lines", () => {
    assert.equal(buildParkedCart([]).ok, false);
    assert.equal(buildParkedCart([{ ...latte, qty: 0 }]).ok, false);
    assert.equal(buildParkedCart([{ ...latte, qty: 1.5 }]).ok, false);
    assert.equal(buildParkedCart([{ ...latte, priceMinor: -1 }]).ok, false);
    assert.equal(buildParkedCart([latte, { ...latte, name: "Dup" }]).ok, false);
    const empty = buildParkedCart([]);
    assert.equal(empty.ok, false);
    if (!empty.ok) assert.equal(empty.code, "PARK_EMPTY");
  });
});

describe("park / resume / discard", () => {
  it("get leaves the park in place until discard", async () => {
    const store = memoryStore();
    const parked = await parkCartIn(store, [latte]);
    const got = await getParkedCartIn(store, parked.parkId);
    assert.equal(got.totalMinor, parked.totalMinor);
    assert.equal((await listParkedCartsIn(store)).length, 1);
  });

  it("parks then resume restores the same lines and totals and removes the park", async () => {
    const store = memoryStore();
    const parked = await parkCartIn(store, [latte, tea]);
    assert.equal((await listParkedCartsIn(store)).length, 1);
    const resumed = await resumeParkedCartIn(store, parked.parkId);
    assert.deepEqual(resumed.lines, parked.lines);
    assert.equal(resumed.totalMinor, 60000);
    assert.equal((await listParkedCartsIn(store)).length, 0);
  });

  it("lists newest first and discard does not restore", async () => {
    const store = memoryStore();
    const older = await parkCartIn(store, [latte]);
    const newer = await parkCartIn(store, [tea]);
    store.rows.set(older.parkId, { ...older, createdAt: "2026-08-13T07:00:00.000Z" });
    store.rows.set(newer.parkId, { ...newer, createdAt: "2026-08-13T08:00:00.000Z" });
    const listed = await listParkedCartsIn(store);
    assert.deepEqual(
      listed.map((row) => row.parkId),
      [newer.parkId, older.parkId],
    );
    await discardParkedCartIn(store, newer.parkId);
    assert.equal((await listParkedCartsIn(store)).length, 1);
    await assert.rejects(() => resumeParkedCartIn(store, newer.parkId), /PARK_NOT_FOUND/);
  });
});

describe("parked cart isolation (AD-14)", () => {
  it("parked-carts module never mentions sales or the sync outbox", () => {
    const src = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "parked-carts.ts"),
      "utf8",
    );
    assert.equal(
      /sales|syncOutbox|createIncompleteSale|completeSale|catalogProducts/.test(src),
      false,
    );
  });
});
