import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { unpackUnit } from "./index";

const base = {
  pack_qty: 1,
  from_qty: 1,
  to_qty: 12,
  from_stock_qty: 3,
  from_track_stock: true,
  to_track_stock: true,
  from_status: "active",
  to_status: "active",
  from_product_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  to_product_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
};

describe("unpackUnit", () => {
  it("accepts a valid unpack and returns deltas", () => {
    assert.deepEqual(unpackUnit(base), {
      ok: true,
      from_delta: -1,
      to_delta: 12,
      pack_qty: 1,
    });
  });

  it("scales by pack_qty", () => {
    assert.deepEqual(unpackUnit({ ...base, pack_qty: 2, from_stock_qty: 2 }), {
      ok: true,
      from_delta: -2,
      to_delta: 24,
      pack_qty: 2,
    });
  });

  it("rejects self-link and bad qty", () => {
    assert.equal(
      unpackUnit({ ...base, from_product_id: base.to_product_id }).ok,
      false,
    );
    assert.equal(unpackUnit({ ...base, pack_qty: 0 }).ok, false);
    assert.equal(unpackUnit({ ...base, to_qty: 0 }).ok, false);
    assert.equal(unpackUnit({ ...base, from_qty: -1 }).ok, false);
  });

  it("rejects insufficient pack stock fail-closed", () => {
    const err = unpackUnit({ ...base, from_stock_qty: 0 });
    assert.equal(err.ok, false);
    if (!err.ok) {
      assert.equal(err.code, "UNPACK_INSUFFICIENT_STOCK");
    }
  });

  it("rejects inactive or untracked products", () => {
    assert.equal(
      unpackUnit({ ...base, from_status: "inactive" }).ok,
      false,
    );
    assert.equal(
      unpackUnit({ ...base, from_track_stock: false }).ok,
      false,
    );
  });
});
