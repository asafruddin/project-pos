import { applySaleVoucher } from "./promotions-apply";

describe("applySaleVoucher", () => {
  it("skips when no voucher code is attached", async () => {
    await expect(
      applySaleVoucher({} as never, { voucherCode: null, payableMinor: 50000 }),
    ).resolves.toEqual({ voucher_minor: 0, voucher_code: null });
  });
});
