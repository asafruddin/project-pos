import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { postVoid } from "./index";

const lines = [{ product_id: "coffee", qty: 2 }];

describe("postVoid", () => {
  it("accepts a complete same-day sale and combines duplicate lines", () => {
    const result = postVoid({
      sale_status: "complete",
      already_voided: false,
      already_returned: false,
      same_calendar_day: true,
      lines: [
        { product_id: "coffee", qty: 2 },
        { product_id: "coffee", qty: 1 },
      ],
    });
    assert.deepEqual(result, {
      ok: true,
      lines: [{ product_id: "coffee", qty: 3 }],
    });
  });

  it("rejects incomplete, already reversed, other day, and invalid lines", () => {
    assert.equal(
      postVoid({
        sale_status: "incomplete",
        already_voided: false,
        already_returned: false,
        same_calendar_day: true,
        lines,
      }).ok,
      false,
    );
    assert.equal(
      postVoid({
        sale_status: "complete",
        already_voided: true,
        already_returned: false,
        same_calendar_day: true,
        lines,
      }).ok,
      false,
    );
    assert.equal(
      postVoid({
        sale_status: "complete",
        already_voided: false,
        already_returned: true,
        same_calendar_day: true,
        lines,
      }).ok,
      false,
    );
    assert.equal(
      postVoid({
        sale_status: "complete",
        already_voided: false,
        already_returned: false,
        same_calendar_day: false,
        lines,
      }).ok,
      false,
    );
    assert.equal(
      postVoid({
        sale_status: "complete",
        already_voided: false,
        already_returned: false,
        same_calendar_day: true,
        lines: [{ product_id: "coffee", qty: 0 }],
      }).ok,
      false,
    );
    const incomplete = postVoid({
      sale_status: "incomplete",
      already_voided: false,
      already_returned: false,
      same_calendar_day: true,
      lines,
    });
    assert.equal(incomplete.ok, false);
    if (!incomplete.ok) assert.equal(incomplete.code, "VOID_NOT_ALLOWED");
  });
});
