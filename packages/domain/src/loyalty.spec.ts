import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_LOYALTY_TIERS,
  evaluateLoyaltyEarn,
  evaluateLoyaltyRedeem,
  resolveLoyaltyTier,
} from "./index";

const program = {
  enabled: true,
  earn_per_minor: 10000,
  point_value_minor: 100,
  expire_days: null,
  tiers: DEFAULT_LOYALTY_TIERS,
};

describe("evaluateLoyaltyEarn", () => {
  it("earns 1 point per Rp 10.000 and applies Gold multiplier", () => {
    const base = evaluateLoyaltyEarn({
      program,
      amount_minor: 50000,
      lifetime_points: 0,
    });
    assert.deepEqual(base, { ok: true, points: 5, skipped: false });

    const gold = evaluateLoyaltyEarn({
      program,
      amount_minor: 50000,
      lifetime_points: 500,
    });
    assert.equal(gold.points, 7);
  });

  it("skips when the program is missing or disabled (fail-open)", () => {
    assert.deepEqual(
      evaluateLoyaltyEarn({
        program: null,
        amount_minor: 50000,
        lifetime_points: 0,
      }),
      { ok: true, points: 0, skipped: true },
    );
    assert.equal(
      evaluateLoyaltyEarn({
        program: { ...program, enabled: false },
        amount_minor: 50000,
        lifetime_points: 0,
      }).skipped,
      true,
    );
  });
});

describe("evaluateLoyaltyRedeem", () => {
  it("converts points to a discount capped at payable", () => {
    const result = evaluateLoyaltyRedeem({
      program,
      points_balance: 50,
      redeem_points: 20,
      payable_minor: 50000,
    });
    assert.deepEqual(result, {
      ok: true,
      redeem_points: 20,
      discount_minor: 2000,
      skipped: false,
    });
  });

  it("refuses insufficient points and skips when rules are down", () => {
    const short = evaluateLoyaltyRedeem({
      program,
      points_balance: 5,
      redeem_points: 20,
      payable_minor: 50000,
    });
    assert.equal(short.ok, false);
    if (!short.ok) assert.equal(short.code, "LOYALTY_INSUFFICIENT");

    const down = evaluateLoyaltyRedeem({
      program: null,
      points_balance: 50,
      redeem_points: 20,
      payable_minor: 50000,
    });
    assert.deepEqual(down, {
      ok: true,
      redeem_points: 0,
      discount_minor: 0,
      skipped: true,
    });
  });

  it("zero redeem is a no-op", () => {
    const result = evaluateLoyaltyRedeem({
      program,
      points_balance: 50,
      redeem_points: 0,
      payable_minor: 1000,
    });
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.skipped, true);
  });
});

describe("resolveLoyaltyTier", () => {
  it("picks the highest matching lifetime tier", () => {
    assert.equal(resolveLoyaltyTier(0), "Reguler");
    assert.equal(resolveLoyaltyTier(100), "Silver");
    assert.equal(resolveLoyaltyTier(500), "Gold");
  });
});
