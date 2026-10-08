import { addProduct, emptyCart } from "@/features/cart/domain/cart";
import { renderShiftReportHtml, type ShiftPdfLabels } from "@/features/shift/domain/shift-pdf";
import { createHarness, drainOutbox, product } from "./helpers/harness";

const sell = (h: ReturnType<typeof createHarness>, qty: number, guestName?: string) => {
  let cart = emptyCart;
  for (let i = 0; i < qty; i += 1) cart = addProduct(cart, h.catalog.getById("p1")!);
  return h.completeSale.execute({ cart, method: "cash", cashReceivedMinor: 1_000_000, guestName });
};

describe("automatic shift close", () => {
  it("counts cash automatically: counted = expected (net of cash out), difference 0, close queued", async () => {
    const h = createHarness();
    h.catalog.replaceAll([product({ stockQty: 100 })], "t");
    h.openShift.execute(50_000);
    await sell(h, 2); // 30.000 cash
    h.recordCash.execute({ kind: "out", amountMinor: 12_000, reason: "Beli es batu" });

    const closed = h.closeShift.executeAuto();

    expect(closed.expectedCashMinor).toBe(50_000 + 30_000 - 12_000);
    expect(closed.countedCashMinor).toBe(closed.expectedCashMinor);
    expect(closed.differenceMinor).toBe(0);
    expect(h.shifts.getOpen()).toBeNull();
    const close = drainOutbox(h.outbox).find((r) => r.kind === "shift.close");
    expect(JSON.stringify(close?.payload)).toContain('"counted_cash_minor":68000');
  });

  it("includes known cash refunds in the final cash", () => {
    const h = createHarness();
    h.openShift.execute(100_000);
    expect(h.closeShift.executeAuto(5_000).expectedCashMinor).toBe(95_000);
  });
});

describe("shift report", () => {
  const labels = new Proxy({} as ShiftPdfLabels, { get: (_t, key) => `<${String(key)}>` });

  it("lists this shift's sales and cash out, with the final cash after cash out", async () => {
    const h = createHarness();
    h.catalog.replaceAll([product({ stockQty: 100 })], "t");
    const shift = h.openShift.execute(10_000);
    await sell(h, 1, "Sari");
    h.clock.advance(1_000);
    await sell(h, 2);
    h.recordCash.execute({ kind: "out", amountMinor: 5_000, reason: "Parkir & <kantong>" });
    const closed = h.closeShift.executeAuto();

    const report = h.shiftReport.build(closed, { minor: 0, known: false });
    expect(report.sales.map((s) => s.queueNumber)).toEqual([1, 2]);
    expect(report.sales[0].guestName).toBe("Sari");
    expect(report.totals.cashMinor).toBe(45_000);
    expect(report.recap.finalCashMinor).toBe(10_000 + 45_000 - 5_000);
    expect(report.recap.openingCashMinor).toBe(shift.openingCashMinor);

    const html = renderShiftReportHtml(report, labels, (m) => `Rp${m}`, (iso) => iso.slice(0, 10));
    expect(html).toContain("Rp50000");
    expect(html).toContain("#2");
    expect(html).toContain("Sari");
    expect(html).toContain("Parkir &amp; &lt;kantong&gt;");
    expect(html).toContain("&lt;refundsUnknown&gt;");
  });
});

describe("new shift clean slate", () => {
  it("drops synced sales of closed shifts, keeps unsynced and current ones, and restarts the queue at #1", async () => {
    const h = createHarness();
    h.catalog.replaceAll([product({ stockQty: 100 })], "t");
    h.openShift.execute(0);
    const synced = await sell(h, 1);
    drainOutbox(h.outbox); // the server has the first sale
    h.clock.advance(1_000);
    const unsynced = await sell(h, 1); // still waiting in the outbox
    expect([synced.queueNumber, unsynced.queueNumber]).toEqual([1, 2]);
    h.clock.advance(1_000);
    const closed = h.closeShift.executeAuto();

    // Closing alone keeps everything: the PDF and day close still need the data.
    expect(h.sales.getSale(synced.saleId)).not.toBeNull();

    h.clock.advance(1_000);
    h.openShift.execute(0);
    expect(h.sales.getSale(synced.saleId)).toBeNull();
    expect(h.sales.getSale(unsynced.saleId)).not.toBeNull();
    expect(h.shifts.list().find((x) => x.shiftId === closed.shiftId)?.status).toBe("closed");

    const fresh = await sell(h, 1);
    expect(fresh.queueNumber).toBe(1);
    expect(h.sales.getSale(fresh.saleId)).not.toBeNull();
  });
});
