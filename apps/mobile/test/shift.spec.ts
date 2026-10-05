import { AppError } from "@/core/errors/app-error";
import { addProduct, emptyCart } from "@/features/cart/domain/cart";
import { buildDayCloseSummary, dayCloseGate } from "@/features/shift/domain/day-close";
import { createHarness, drainOutbox, product } from "./helpers/harness";

const cashSale = async (h: ReturnType<typeof createHarness>, qty = 1, productId = "p1") => {
  let cart = emptyCart;
  for (let i = 0; i < qty; i += 1) cart = addProduct(cart, h.catalog.getById(productId)!);
  return h.completeSale.execute({ cart, method: "cash", cashReceivedMinor: 1_000_000 });
};

describe("shift", () => {
  it("opens once, validates opening cash and queues exactly one sync row", () => {
    const h = createHarness();
    expect(() => h.openShift.execute(-1)).toThrow(AppError);
    const shift = h.openShift.execute(50_000);
    expect(h.shifts.getOpen()?.shiftId).toBe(shift.shiftId);
    expect(h.openShift.execute(1).shiftId).toBe(shift.shiftId); // idempotent
    expect(h.outbox.stats().pending).toBe(1);
    expect(h.outbox.nextPending()).toMatchObject({
      kind: "shift.open",
      payload: { shift_id: shift.shiftId, opening_cash_minor: 50_000 },
    });
  });

  it("records cash in/out only while a shift is open and requires a reason", () => {
    const h = createHarness();
    expect(() => h.recordCash.execute({ kind: "in", amountMinor: 1000, reason: "x" })).toThrow();
    h.openShift.execute(0);
    expect(() => h.recordCash.execute({ kind: "in", amountMinor: 1000, reason: "  " })).toThrow();
    expect(() => h.recordCash.execute({ kind: "out", amountMinor: 0, reason: "x" })).toThrow();
    h.recordCash.execute({ kind: "in", amountMinor: 20_000, reason: "change fund" });
    expect(h.shifts.listMovements()).toHaveLength(1);
  });

  it("expected cash = opening + cash sales + in − out − voided cash sales", async () => {
    const h = createHarness();
    h.catalog.replaceAll([product({ stockQty: 100 })], "t");
    h.openShift.execute(50_000);
    await cashSale(h, 2); // 30.000 cash
    const toVoid = await cashSale(h, 1); // 15.000 cash
    h.recordCash.execute({ kind: "in", amountMinor: 10_000, reason: "in" });
    h.recordCash.execute({ kind: "out", amountMinor: 5_000, reason: "out" });
    h.state.permissions = ["sales:void_unattended"];
    await h.voidSale.execute(toVoid.saleId);

    const view = h.summary.compute(h.shifts.getOpen()!, 0);
    expect(view).toMatchObject({
      opening_cash_minor: 50_000,
      cash_sales_minor: 45_000,
      cash_in_minor: 10_000,
      cash_out_minor: 5_000,
      cash_voids_minor: 15_000,
      expected_cash_minor: 50_000 + 45_000 + 10_000 - 5_000 - 15_000,
    });
  });

  it("closing computes the difference, queues the close after the other rows and leaves no open shift", async () => {
    const h = createHarness();
    h.catalog.replaceAll([product({ stockQty: 100 })], "t");
    const shift = h.openShift.execute(10_000);
    await cashSale(h, 1);
    const closed = h.closeShift.execute(30_000); // expected 25.000 → +5.000
    expect(closed).toMatchObject({ status: "closed", expectedCashMinor: 25_000, countedCashMinor: 30_000, differenceMinor: 5_000 });
    expect(h.shifts.getOpen()).toBeNull();
    expect(() => h.closeShift.execute(0)).toThrow(AppError);

    const rows = drainOutbox(h.outbox);
    expect(rows.map((r) => r.kind)).toEqual(["shift.open", "sale.sync", "shift.close"]);
    expect(rows[2].payload).toEqual({
      shiftId: shift.shiftId,
      request: { closed_at: closed.closedAt, counted_cash_minor: 30_000, expected_cash_minor: 25_000 },
    });
  });

  it("adopting the server's shift re-points the shift, sales, cash movements and every queued payload", async () => {
    const h = createHarness();
    h.catalog.replaceAll([product()], "t");
    const local = h.openShift.execute(0);
    const sale = await cashSale(h);
    h.recordCash.execute({ kind: "in", amountMinor: 1000, reason: "r" });

    h.shifts.adoptServerShift(local.shiftId, {
      shiftId: "server-shift",
      storeId: "s",
      registerId: "r",
      openedAt: "2025-01-01T00:00:00.000Z",
      openingCashMinor: 0,
      status: "open",
      closedAt: null,
      countedCashMinor: null,
      expectedCashMinor: null,
      differenceMinor: null,
    });

    expect(h.shifts.getOpen()?.shiftId).toBe("server-shift");
    expect(h.sales.getSale(sale.saleId)?.shiftId).toBe("server-shift");
    expect(h.shifts.listMovements()[0].shiftId).toBe("server-shift");
    const rows = drainOutbox(h.outbox).filter((r) => r.kind !== "shift.open");
    expect(rows.find((r) => r.kind === "sale.sync")?.payload).toMatchObject({ shift_id: "server-shift" });
    expect(rows.find((r) => r.kind === "cash.movement")?.payload).toMatchObject({ shiftId: "server-shift" });
  });
});

describe("day close", () => {
  it("summarises the day, QRIS and closed shifts, and gates on open shift / unsynced sales", async () => {
    const h = createHarness();
    h.catalog.replaceAll([product({ stockQty: 100 })], "t");
    h.openShift.execute(0);
    await cashSale(h, 2);
    let cart = addProduct(emptyCart, h.catalog.getById("p1")!);
    const qris = await h.completeSale.execute({ cart, method: "qris" });
    cart = emptyCart;

    let summary = h.dayClose.execute(new Date(h.clock.nowMs()));
    expect(summary).toMatchObject({ transactionCount: 2, totalMinor: 45_000, qrisTotalMinor: 15_000, qrisTransactionCount: 1 });
    expect(summary.qrisSales[0].saleId).toBe(qris.saleId);
    expect(dayCloseGate(summary, false)).toMatchObject({ ok: false, code: "DAY_CLOSE_SHIFT_OPEN" });

    h.closeShift.execute(30_000);
    summary = h.dayClose.execute(new Date(h.clock.nowMs()));
    expect(summary.closedShifts).toHaveLength(1);
    expect(summary.pendingSyncCount).toBe(2); // both sales still queued
    expect(dayCloseGate(summary, false)).toMatchObject({ ok: false, code: "DAY_CLOSE_SYNC_PENDING" });
    expect(dayCloseGate(summary, true)).toEqual({ ok: true });

    drainOutbox(h.outbox);
    summary = h.dayClose.execute(new Date(h.clock.nowMs()));
    expect(summary.pendingSyncCount).toBe(0);
    expect(dayCloseGate(summary, false)).toEqual({ ok: true });
  });

  it("requires a closed shift for the day when there were sales", () => {
    const summary = buildDayCloseSummary({ sales: [], unsyncedSaleIds: new Set(), openShift: null, closedShifts: [] });
    expect(summary.transactionCount).toBe(0);
    expect(dayCloseGate(summary, false).ok).toBe(true); // empty day can close
  });
});
