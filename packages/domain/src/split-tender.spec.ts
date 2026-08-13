import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  cashTenderTotal,
  evaluateSplitTender,
  resolveSellingPrice,
  storeCreditTenderTotal,
  tendersFromPayment,
} from "./index";

describe("resolveSellingPrice", () => {
  it("uses customer, then group, then store, then catalog", () => {
    assert.equal(
      resolveSellingPrice({
        catalog_price_minor: 10000,
        store_price_minor: 9000,
        group_price_minor: 8000,
        customer_price_minor: 7000,
      }),
      7000,
    );
    assert.equal(
      resolveSellingPrice({
        catalog_price_minor: 10000,
        store_price_minor: 9000,
        group_price_minor: 8000,
        customer_price_minor: null,
      }),
      8000,
    );
    assert.equal(
      resolveSellingPrice({
        catalog_price_minor: 10000,
        store_price_minor: 9000,
      }),
      9000,
    );
  });

  it("fails open past invalid overrides to catalog", () => {
    assert.equal(
      resolveSellingPrice({
        catalog_price_minor: 12000,
        customer_price_minor: -1,
        group_price_minor: 1.5,
        store_price_minor: undefined,
      }),
      12000,
    );
  });
});

describe("evaluateSplitTender", () => {
  it("accepts all-cash with no customer (Instant Checkout)", () => {
    const result = evaluateSplitTender({
      payable_minor: 36000,
      tenders: [{ method: "cash", amount_minor: 36000 }],
    });
    assert.deepEqual(result, {
      ok: true,
      method: "cash",
      amount_minor: 36000,
      tenders: [{ method: "cash", amount_minor: 36000 }],
      cash_minor: 36000,
      store_credit_minor: 0,
    });
  });

  it("accepts cash + store credit that sums to payable", () => {
    const result = evaluateSplitTender({
      payable_minor: 50000,
      customer_id: "c1",
      store_credit_balance_minor: 20000,
      tenders: [
        { method: "cash", amount_minor: 30000 },
        { method: "store_credit", amount_minor: 20000 },
      ],
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.method, "split");
      assert.equal(result.cash_minor, 30000);
      assert.equal(result.store_credit_minor, 20000);
    }
  });

  it("rejects store credit without a customer", () => {
    const result = evaluateSplitTender({
      payable_minor: 1000,
      tenders: [{ method: "store_credit", amount_minor: 1000 }],
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "TENDER_STORE_CREDIT_REQUIRES_CUSTOMER");
    }
  });

  it("rejects store credit above balance, unknown methods, and sum mismatch", () => {
    const over = evaluateSplitTender({
      payable_minor: 1000,
      customer_id: "c1",
      store_credit_balance_minor: 500,
      tenders: [{ method: "store_credit", amount_minor: 1000 }],
    });
    assert.equal(over.ok, false);
    if (!over.ok) assert.equal(over.code, "TENDER_STORE_CREDIT_EXCEEDS_BALANCE");

    const card = evaluateSplitTender({
      payable_minor: 1000,
      tenders: [{ method: "card", amount_minor: 1000 }],
    });
    assert.equal(card.ok, false);
    if (!card.ok) assert.equal(card.code, "TENDER_METHOD_UNSUPPORTED");

    const mismatch = evaluateSplitTender({
      payable_minor: 1000,
      tenders: [{ method: "cash", amount_minor: 999 }],
    });
    assert.equal(mismatch.ok, false);
    if (!mismatch.ok) assert.equal(mismatch.code, "TENDER_SUM_MISMATCH");
  });

  it("skips the balance check when balance is omitted", () => {
    const result = evaluateSplitTender({
      payable_minor: 1000,
      customer_id: "c1",
      tenders: [{ method: "store_credit", amount_minor: 1000 }],
    });
    assert.equal(result.ok, true);
  });
});

describe("tendersFromPayment", () => {
  it("treats brownfield cash payment as a cash tender", () => {
    assert.deepEqual(tendersFromPayment({ method: "cash", amount_minor: 36000 }), [
      { method: "cash", amount_minor: 36000 },
    ]);
    assert.equal(
      cashTenderTotal({
        method: "split",
        amount_minor: 50000,
        tenders: [
          { method: "cash", amount_minor: 30000 },
          { method: "store_credit", amount_minor: 20000 },
        ],
      }),
      30000,
    );
    assert.equal(
      storeCreditTenderTotal({ method: "cash", amount_minor: 36000 }),
      0,
    );
    assert.equal(storeCreditTenderTotal(undefined), 0);
    assert.deepEqual(tendersFromPayment({ method: "card", amount_minor: 1000 }), []);
  });
});
