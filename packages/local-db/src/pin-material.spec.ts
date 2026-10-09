import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createSalt, hashPin } from "./pin-hash";
import { matchesManagerPin } from "./pin-material";

describe("matchesManagerPin", () => {
  it("accepts the default 000000 when the owner never set a PIN", async () => {
    assert.equal(await matchesManagerPin(null, "000000"), true);
    assert.equal(await matchesManagerPin(null, "111111"), false);
  });

  it("uses the synced material once the owner set a PIN, and the default stops working", async () => {
    const salt = createSalt();
    const material = { salt, pinHash: await hashPin("482913", salt) };
    assert.equal(await matchesManagerPin(material, "482913"), true);
    assert.equal(await matchesManagerPin(material, "000000"), false);
  });

  it("rejects anything that is not 6 digits", async () => {
    assert.equal(await matchesManagerPin(null, "00000"), false);
    assert.equal(await matchesManagerPin(null, "abcdef"), false);
  });
});
