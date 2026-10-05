import type { Promotion } from "@pos-apps/types";
import { AppError } from "@/core/errors/app-error";
import { addProduct, emptyCart } from "@/features/cart/domain/cart";
import { cashChange, priceCart } from "@/features/checkout/domain/pricing";
import { createHarness, drainOutbox, product } from "./helpers/harness";

const promo = (over: Partial<Promotion>): Promotion => ({
  promotion_id: "pr1",
  name: "10% off",
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
  hour_start: null,
  hour_end: null,
  updated_at: "2025-01-01T00:00:00.000Z",
  ...over,
});

const cartOf = (h: ReturnType<typeof createHarness>, qty = 2) => {
  let cart = emptyCart;
  for (let i = 0; i < qty; i += 1) cart = addProduct(cart, h.catalog.getById("p1")!);
  return cart;
};

const code = async (p: Promise<unknown>) => p.then(() => null, (e: AppError) => e.message);

describe("pricing", () => {
  it("stacks promo → manager → voucher and never goes below zero", () => {
    const lines = [{ productId: "p1", qty: 2, priceMinor: 15_000 }];
    const r = priceCart({ lines, promotions: [promo({})], managerDiscountMinor: 3_000, voucherRemainingMinor: 5_000, localHour: 12 });
    expect(r).toMatchObject({ lineTotalMinor: 30_000, promoDiscountMinor: 3_000, managerDiscountMinor: 3_000, voucherMinor: 5_000, payableMinor: 19_000 });
    expect(priceCart({ lines, promotions: [], managerDiscountMinor: 999_999, voucherRemainingMinor: 999_999 }).payableMinor).toBe(0);
  });

  it("only applies coupon promotions when the code matches", () => {
    const lines = [{ productId: "p1", qty: 1, priceMinor: 10_000 }];
    const promotions = [promo({ coupon_code: "HEMAT", percent_bps: 5000 })];
    expect(priceCart({ lines, promotions, couponCode: "" }).promoDiscountMinor).toBe(0);
    expect(priceCart({ lines, promotions, couponCode: "hemat" }).promoDiscountMinor).toBe(5_000);
    expect(priceCart({ lines, promotions, couponCode: "NOPE" }).couponInvalid).toBe(true);
  });

  it("computes cash change and shortfall", () => {
    expect(cashChange(30_000, 50_000)).toEqual({ short: false, changeMinor: 20_000, shortMinor: 0 });
    expect(cashChange(30_000, 20_000)).toEqual({ short: true, changeMinor: 0, shortMinor: 10_000 });
    expect(cashChange(30_000, null).short).toBe(true);
    expect(cashChange(0, null).short).toBe(false);
  });
});

describe("complete sale", () => {
  it("refuses an empty cart and a sale without an open shift", async () => {
    const h = createHarness();
    h.catalog.replaceAll([product()], "t");
    expect(await code(h.completeSale.execute({ cart: emptyCart, method: "cash" }))).toBe("CART_EMPTY");
    expect(await code(h.completeSale.execute({ cart: cartOf(h), method: "cash", cashReceivedMinor: 99_999 }))).toBe("NO_OPEN_SHIFT");
  });

  it("persists the sale, decrements tracked stock only, and queues it after the shift", async () => {
    const h = createHarness();
    h.catalog.replaceAll([product({ stockQty: 10 }), product({ productId: "p2", name: "Jasa", trackStock: false, stockQty: 0 })], "t");
    const shift = h.openShift.execute(0);
    let cart = cartOf(h, 2);
    cart = addProduct(cart, h.catalog.getById("p2")!);

    const sale = await h.completeSale.execute({ cart, method: "cash", cashReceivedMinor: 100_000, guestName: " Budi " });

    expect(sale).toMatchObject({ shiftId: shift.shiftId, guestName: "Budi", payment: { method: "cash", amountMinor: 45_000 } });
    expect(h.sales.getSale(sale.saleId)?.lines).toHaveLength(2);
    expect(h.catalog.getById("p1")?.stockQty).toBe(8);
    expect(h.catalog.getById("p2")?.stockQty).toBe(0);
    const rows = drainOutbox(h.outbox);
    expect(rows.map((r) => r.kind)).toEqual(["shift.open", "sale.sync"]);
    expect(rows[1].payload).toMatchObject({ sale_id: sale.saleId, shift_id: shift.shiftId, guest_name: "Budi", payment: { amount_minor: 45_000 } });
  });

  it("rejects short cash and accepts exact cash; QRIS needs no cash amount", async () => {
    const h = createHarness();
    h.catalog.replaceAll([product()], "t");
    h.openShift.execute(0);
    expect(await code(h.completeSale.execute({ cart: cartOf(h), method: "cash", cashReceivedMinor: 29_999 }))).toBe("CASH_SHORT");
    expect(await code(h.completeSale.execute({ cart: cartOf(h), method: "cash" }))).toBe("CASH_SHORT");
    await h.completeSale.execute({ cart: cartOf(h), method: "cash", cashReceivedMinor: 30_000 });
    const qris = await h.completeSale.execute({ cart: cartOf(h), method: "qris" });
    expect(qris.payment.method).toBe("qris");
  });

  it("applies cached promotions and sends the snapshot", async () => {
    const h = createHarness();
    h.catalog.replaceAll([product()], "t");
    h.promotions.replace([promo({})]);
    h.openShift.execute(0);
    const sale = await h.completeSale.execute({ cart: cartOf(h), method: "qris" });
    expect(sale.payment.amountMinor).toBe(27_000);
    expect(sale.promotions).toMatchObject({ discountMinor: 3_000, applied: [{ promotionId: "pr1", discountMinor: 3_000 }] });
    const queued = drainOutbox(h.outbox).find((r) => r.kind === "sale.sync");
    expect(queued?.payload).toMatchObject({ promotions: { discount_minor: 3_000, applied: [{ promotion_id: "pr1" }] } });
  });

  it("requires a valid manager PIN for a manager discount", async () => {
    const h = createHarness();
    h.catalog.replaceAll([product()], "t");
    h.openShift.execute(0);
    await h.pins.enrollManager("654321");
    const base = { cart: cartOf(h), method: "qris" as const, managerDiscountMinor: 5_000 };
    expect(await code(h.completeSale.execute(base))).toBe("MANAGER_PIN_REQUIRED");
    expect(await code(h.completeSale.execute({ ...base, managerPin: "111111" }))).toBe("MANAGER_PIN_REQUIRED");
    const sale = await h.completeSale.execute({ ...base, managerPin: "654321" });
    expect(sale.promotions?.managerDiscountMinor).toBe(5_000);
    expect(sale.payment.amountMinor).toBe(25_000);
  });

  it("applies an online voucher, skips it offline, and rejects unknown codes", async () => {
    const voucher = { voucher_id: "v1", code: "VCH", remaining_minor: 10_000, enabled: true, updated_at: "" };
    const h = createHarness({ vouchers: { VCH: voucher } });
    h.catalog.replaceAll([product()], "t");
    h.openShift.execute(0);
    const withVoucher = await h.completeSale.execute({ cart: cartOf(h), method: "qris", voucherCode: "vch" });
    expect(withVoucher).toMatchObject({ payment: { amountMinor: 20_000 }, promotions: { voucherMinor: 10_000, voucherCode: "VCH" } });
    expect(await code(h.completeSale.execute({ cart: cartOf(h), method: "qris", voucherCode: "NOPE" }))).toBe("VOUCHER_INVALID");

    h.state.online = false;
    const offline = await h.completeSale.execute({ cart: cartOf(h), method: "qris", voucherCode: "VCH" });
    expect(offline.payment.amountMinor).toBe(30_000);
    expect(offline.promotions).toBeNull();
  });

  it("replaying the same sale does not double-count stock or double-queue", async () => {
    const h = createHarness();
    h.catalog.replaceAll([product()], "t");
    h.openShift.execute(0);
    const sale = await h.completeSale.execute({ cart: cartOf(h, 1), method: "qris" });
    const pending = h.outbox.stats().pending;
    h.sales.recordCompletedSale(sale);
    expect(h.catalog.getById("p1")?.stockQty).toBe(9);
    expect(h.outbox.stats().pending).toBe(pending);
  });

  it("rolls the whole write back if any part fails", async () => {
    const h = createHarness();
    h.catalog.replaceAll([product()], "t");
    h.openShift.execute(0);
    const before = h.outbox.stats().pending;
    (h.db as unknown as { $client: { exec(sql: string): void } }).$client.exec(
      "CREATE TRIGGER fail_outbox BEFORE INSERT ON outbox WHEN NEW.kind = 'sale.sync' BEGIN SELECT RAISE(ABORT, 'boom'); END;",
    );
    await expect(h.completeSale.execute({ cart: cartOf(h, 1), method: "qris" })).rejects.toThrow();
    expect(h.catalog.getById("p1")?.stockQty).toBe(10);
    expect(h.outbox.stats().pending).toBe(before);
  });
});

describe("void sale", () => {
  const setup = async (permissions: string[] = []) => {
    const h = createHarness({ permissions });
    h.catalog.replaceAll([product()], "t");
    h.openShift.execute(0);
    const sale = await h.completeSale.execute({ cart: cartOf(h, 2), method: "qris" });
    return { h, sale };
  };

  it("restocks tracked items, queues the void and keeps the sale", async () => {
    const { h, sale } = await setup(["sales:void_unattended"]);
    expect(await h.voidSale.authMode()).toBe("unattended");
    const voided = await h.voidSale.execute(sale.saleId);
    expect(voided.voidedAt).toBeTruthy();
    expect(h.catalog.getById("p1")?.stockQty).toBe(10);
    const rows = drainOutbox(h.outbox);
    expect(rows[rows.length - 1]).toMatchObject({ kind: "sale.void", entityId: sale.saleId, payload: { sale_id: sale.saleId, void_id: voided.voidId } });
  });

  it("without the permission: first void enrols a manager PIN that must differ from the user PIN", async () => {
    const { h, sale } = await setup();
    await h.pins.enroll("user-1", "111111");
    expect(await h.voidSale.authMode()).toBe("enroll");
    expect(await code(h.voidSale.execute(sale.saleId))).toBe("VOID_PIN_REQUIRED");
    expect(await code(h.voidSale.execute(sale.saleId, "111111"))).toBe("VOID_PIN_SAME");
    await h.voidSale.execute(sale.saleId, "222222");
    expect(await h.voidSale.authMode()).toBe("unlock");
  });

  it("unlock mode checks the manager PIN and locks after repeated failures", async () => {
    const { h, sale } = await setup();
    await h.pins.enrollManager("222222");
    for (let i = 0; i < 4; i += 1) expect(await code(h.voidSale.execute(sale.saleId, "000000"))).toBe("VOID_PIN_WRONG");
    expect(await code(h.voidSale.execute(sale.saleId, "000000"))).toBe("VOID_PIN_LOCKED");
    expect(await code(h.voidSale.execute(sale.saleId, "222222"))).toBe("VOID_PIN_LOCKED"); // even the right PIN, until the lock expires
    h.clock.advance(31_000);
    await h.voidSale.execute(sale.saleId, "222222");
  });

  it("only same-day, not-yet-voided sales can be voided", async () => {
    const { h, sale } = await setup(["sales:void_unattended"]);
    await h.voidSale.execute(sale.saleId);
    expect(await code(h.voidSale.execute(sale.saleId))).toBe("VOID_NOT_ALLOWED");
    expect(await code(h.voidSale.execute("missing"))).toBe("VOID_NOT_FOUND");

    const { h: h2, sale: old } = await setup(["sales:void_unattended"]);
    h2.clock.advance(2 * 86_400_000);
    expect(await code(h2.voidSale.execute(old.saleId))).toBe("VOID_NOT_ALLOWED");
  });
});
