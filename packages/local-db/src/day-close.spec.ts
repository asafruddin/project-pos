import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { endOfLocalDay, startOfLocalDay } from "./sales.js";

describe("day-close day bounds", () => {
  it("startOfLocalDay is midnight local and end is next midnight", () => {
    const d = new Date(2026, 7, 7, 15, 30, 0);
    const start = startOfLocalDay(d);
    const end = endOfLocalDay(d);
    assert.equal(start.getHours(), 0);
    assert.equal(start.getMinutes(), 0);
    assert.equal(start.getDate(), 7);
    assert.equal(end.getTime() - start.getTime(), 24 * 60 * 60 * 1000);
  });
});
