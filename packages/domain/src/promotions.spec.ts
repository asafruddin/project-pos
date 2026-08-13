import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  evaluateManagerDiscount,
  evaluatePromotions,
  evaluateVoucher,
  stackSaleDiscounts,
  type PromotionSnapshot,
} from "./index";

const percent: PromotionSnapshot = {
  promotion_id: "p1",
  name: "Happy hour 10%",
  enabled: true,
  kind: "percent",
  percent_bps: 1000,
  fixed_minor: null,
  coupon_code: null,
  exclusive: false,
  min_subtotal_minor: null,
  customer_group: null,
  product_ids: [],
  starts_at: null,
  ends_at: null,
  hour_start: 17,
  hour_end: 21,
};

const lines = [{ product_id: "sku-1", qty: 2, price_minor: 25000 }];

describe("evaluatePromotions", () => {
  it("applies percent auto promo inside the happy-hour window", () => {
    const result = evaluatePromotions({
      promotions: [percent],
      lines,
      local_hour: 18,
      now_ms: Date.parse("2026-08-13T11:00:00.000Z"),
    });
    assert.equal(result.discount_minor, 5000);
    assert.equal(result.applied[0]?.name, "Happy hour 10%");
    assert.equal(result.skipped, false);
  });

  it("skips inactive, out-of-window, and missing rules (fail-open)", () => {
    assert.equal(
      evaluatePromotions({ promotions: null, lines }).skipped,
      true,
    );
    assert.equal(
      evaluatePromotions({
        promotions: [{ ...percent, enabled: false }],
        lines,
        local_hour: 18,
      }).discount_minor,
      0,
    );
    assert.equal(
      evaluatePromotions({
        promotions: [percent],
        lines,
        local_hour: 10,
      }).discount_minor,
      0,
    );
  });

  it("exclusive auto keeps the largest discount; invalid coupon is reported", () => {
    const fixed: PromotionSnapshot = {
      ...percent,
      promotion_id: "p2",
      name: "Potong 20rb",
      kind: "fixed",
      percent_bps: null,
      fixed_minor: 20000,
      exclusive: true,
      hour_start: null,
      hour_end: null,
    };
    const stacked = evaluatePromotions({
      promotions: [{ ...percent, hour_start: null, hour_end: null }, fixed],
      lines,
    });
    assert.equal(stacked.discount_minor, 20000);
    assert.equal(stacked.applied.length, 1);

    const couponed = evaluatePromotions({
      promotions: [{ ...percent, hour_start: null, hour_end: null }],
      lines,
      coupon_code: "NOPE",
    });
    assert.equal(couponed.coupon_error?.code, "COUPON_INVALID");
    assert.equal(couponed.discount_minor, 5000);
  });
});

describe("evaluateVoucher / manager / stack", () => {
  it("caps voucher at payable and leaves remaining", () => {
    const result = evaluateVoucher({ remaining_minor: 8000, payable_minor: 5000 });
    assert.deepEqual(result, {
      ok: true,
      applied_minor: 5000,
      remaining_minor: 3000,
      skipped: false,
    });
    assert.equal(
      evaluateVoucher({ remaining_minor: 0, payable_minor: 5000 }).skipped,
      true,
    );
  });

  it("caps manager discount and stacks sale-level decorations", () => {
    assert.equal(
      evaluateManagerDiscount({ discount_minor: 9000, payable_minor: 4000 })
        .discount_minor,
      4000,
    );
    assert.equal(
      stackSaleDiscounts({
        line_total_minor: 50000,
        promo_discount_minor: 5000,
        manager_discount_minor: 2000,
        voucher_minor: 3000,
        loyalty_discount_minor: 1000,
      }),
      39000,
    );
  });
});
