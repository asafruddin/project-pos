import { applySaleVoucher } from "./promotions-apply";

describe("applySaleVoucher", () => {
  it("skips when no voucher code is attached", async () => {
    await expect(
      applySaleVoucher({} as never, {
        voucherCode: null,
        payableMinor: 50000,
        storeId: "00000000-0000-4000-8000-000000000001",
      }),
    ).resolves.toEqual({ voucher_minor: 0, voucher_code: null });
  });
});
