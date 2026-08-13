import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  inventoryStockValueMinor,
  isDeadStock,
  lineCogsMinor,
  rankProductAnalytics,
  saleDiscountMinor,
  summarizeOpnameVariance,
  summarizeProductAnalytics,
  summarizeSalesAnalytics,
} from "./index";

const latte = {
  product_id: "p-latte",
  qty: 2,
  price_minor: 25000,
  cost_minor: 9000,
};

describe("saleDiscountMinor / lineCogsMinor", () => {
  it("sums sale-level discounts and uses product cost, not FIFO", () => {
    assert.equal(
      saleDiscountMinor({
        promotions: {
          discount_minor: 2000,
          manager_discount_minor: 1000,
          voucher_minor: 500,
        },
        loyalty: { discount_minor: 300 },
      }),
      3800,
    );
    assert.equal(lineCogsMinor(2, 9000), 18000);
    assert.equal(lineCogsMinor(2, null), 0);
    assert.equal(lineCogsMinor(0, 9000), 0);
  });
});

describe("summarizeSalesAnalytics", () => {
  it("nets refunds, excludes voids, and matches revenue − COGS", () => {
    const totals = summarizeSalesAnalytics({
      sales: [
        {
          amount_minor: 47000,
          voided: false,
          discount_minor: 3000,
          lines: [latte],
        },
        {
          amount_minor: 25000,
          voided: true,
          discount_minor: 0,
          lines: [{ ...latte, qty: 1 }],
        },
      ],
      refunds: [{ refund_amount_minor: 5000 }],
    });
    assert.equal(totals.revenue_minor, 47000);
    assert.equal(totals.txn_count, 1);
    assert.equal(totals.units, 2);
    assert.equal(totals.aov_minor, 47000);
    assert.equal(totals.discount_minor, 3000);
    assert.equal(totals.refund_minor, 5000);
    assert.equal(totals.net_minor, 42000);
    assert.equal(totals.cogs_minor, 18000);
    assert.equal(totals.gross_profit_minor, 29000);
    assert.equal(totals.tax_minor, 0);
    assert.equal(totals.fees_minor, 0);
  });

  it("floors AOV and never lets net go negative", () => {
    const totals = summarizeSalesAnalytics({
      sales: [
        {
          amount_minor: 100,
          voided: false,
          discount_minor: 0,
          lines: [],
        },
        {
          amount_minor: 50,
          voided: false,
          discount_minor: 0,
          lines: [],
        },
      ],
      refunds: [{ refund_amount_minor: 1000 }],
    });
    assert.equal(totals.aov_minor, 75);
    assert.equal(totals.net_minor, 0);
  });
});

describe("summarizeProductAnalytics", () => {
  it("keeps inactive SKUs historically and ranks top vs slow by units", () => {
    const rows = summarizeProductAnalytics({
      sales: [
        {
          amount_minor: 50000,
          voided: false,
          discount_minor: 0,
          lines: [
            latte,
            { product_id: "p-slow", qty: 1, price_minor: 10000, cost_minor: 2000 },
          ],
        },
        {
          amount_minor: 25000,
          voided: true,
          discount_minor: 0,
          lines: [
            { product_id: "p-voided", qty: 9, price_minor: 1000, cost_minor: 1 },
          ],
        },
      ],
    });
    const latteRow = rows.find((r) => r.product_id === "p-latte");
    assert.equal(latteRow?.units, 2);
    assert.equal(latteRow?.revenue_minor, 50000);
    assert.equal(latteRow?.cogs_minor, 18000);
    assert.equal(latteRow?.margin_minor, 32000);
    assert.equal(rows.some((r) => r.product_id === "p-voided"), false);

    const ranked = rankProductAnalytics(rows, 1);
    assert.equal(ranked.top[0]?.product_id, "p-latte");
    assert.equal(ranked.slow[0]?.product_id, "p-slow");
  });
});

describe("inventory analytics helpers", () => {
  it("values sellable at cost and flags dead stock", () => {
    assert.equal(
      inventoryStockValueMinor([
        { sellable_qty: 3, cost_minor: 9000 },
        { sellable_qty: 0, cost_minor: 1000 },
        { sellable_qty: 2, cost_minor: null },
      ]),
      27000,
    );
    assert.equal(isDeadStock({ sellable_qty: 4, units_sold: 0 }), true);
    assert.equal(isDeadStock({ sellable_qty: 4, units_sold: 1 }), false);
    assert.equal(isDeadStock({ sellable_qty: 0, units_sold: 0 }), false);
  });

  it("ties approved opname variance to the opname id", () => {
    assert.equal(
      summarizeOpnameVariance({
        opname_id: "op-1",
        status: "draft",
        lines: [{ system_qty: 5, counted_qty: 3 }],
      }),
      null,
    );
    assert.deepEqual(
      summarizeOpnameVariance({
        opname_id: "op-1",
        status: "approved",
        lines: [
          { system_qty: 5, counted_qty: 3 },
          { system_qty: 2, counted_qty: 2 },
        ],
      }),
      { opname_id: "op-1", variance: -2 },
    );
  });
});
