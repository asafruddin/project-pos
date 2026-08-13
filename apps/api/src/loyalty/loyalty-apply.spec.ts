import { applySaleLoyalty } from "./loyalty-apply";

describe("applySaleLoyalty", () => {
  it("skips when no customer is attached", async () => {
    await expect(
      applySaleLoyalty({} as never, {
        customerId: null,
        saleId: "sale-1",
        amountMinor: 50000,
        redeemPoints: 20,
        payableMinor: 50000,
      }),
    ).resolves.toEqual({
      redeem_points: 0,
      discount_minor: 0,
      earned_points: 0,
    });
  });
});
