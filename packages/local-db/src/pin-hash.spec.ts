import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createSalt,
  hashPin,
  isSixDigitPin,
  timingSafeEqual,
} from "./pin-hash.js";

describe("pin-hash", () => {
  it("accepts only 6-digit PINs", () => {
    assert.equal(isSixDigitPin("123456"), true);
    assert.equal(isSixDigitPin("12345"), false);
    assert.equal(isSixDigitPin("1234567"), false);
    assert.equal(isSixDigitPin("12a456"), false);
  });

  it("hashes deterministically for same salt and rejects wrong PIN", async () => {
    const salt = createSalt();
    const a = await hashPin("123456", salt);
    const b = await hashPin("123456", salt);
    const c = await hashPin("654321", salt);
    assert.equal(a, b);
    assert.equal(timingSafeEqual(a, c), false);
    assert.equal(timingSafeEqual(a, b), true);
  });

  it("rejects non-six-digit input to hashPin", async () => {
    const salt = createSalt();
    await assert.rejects(() => hashPin("12345", salt), /PIN_INVALID_FORMAT/);
  });
});
