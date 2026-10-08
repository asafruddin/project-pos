import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { LocalSaleRecord } from "./db";
import { toSyncSaleRequest } from "./sales";

function completeSale(overrides: Partial<LocalSaleRecord> = {}): LocalSaleRecord {
  return {
    saleId: "11111111-1111-4111-8111-111111111111",
    deviceId: "device-1",
    createdAt: "2026-09-20T00:00:00.000Z",
    completedAt: "2026-09-20T00:01:00.000Z",
    status: "complete",
    payment: { method: "cash", amountMinor: 18000 },
    lines: [{ productId: "p1", name: "Omelette", priceMinor: 18000, qty: 1 }],
    ...overrides,
  };
}

describe("toSyncSaleRequest", () => {
  it("sends guest_name and omits customer_id for a receipt name", () => {
    const payload = toSyncSaleRequest(
      completeSale({ guestName: "  Sari  ", customerId: null }),
    );
    assert.equal(payload.guest_name, "Sari");
    assert.equal("customer_id" in payload, false);
  });

  it("omits blank guest_name", () => {
    const payload = toSyncSaleRequest(completeSale({ guestName: "   " }));
    assert.equal("guest_name" in payload, false);
  });

  it("sends queue_number only when the sale has one", () => {
    assert.equal(toSyncSaleRequest(completeSale({ queueNumber: 7 })).queue_number, 7);
    assert.equal("queue_number" in toSyncSaleRequest(completeSale()), false);
  });
});
