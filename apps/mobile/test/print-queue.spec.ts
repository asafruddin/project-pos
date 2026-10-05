import { PrintQueue } from "@/features/receipt/domain/print-queue";
import { DrizzlePrintJobRepository } from "@/features/receipt/data/drizzle-print-job-repository";
import { StubPrinter } from "@/infrastructure/printer/stub-printer";
import { createTestDb, fakeClock, sequentialIds } from "./helpers/test-db";

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const flush = async () => {
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
};

describe("PrintQueue", () => {
  function setup() {
    const printer = new StubPrinter();
    const jobs = new DrizzlePrintJobRepository(createTestDb());
    const queue = new PrintQueue(jobs, printer, fakeClock(), sequentialIds());
    return { printer, jobs, queue };
  }

  it("prints right away when the printer is reachable", async () => {
    const { printer, queue } = setup();
    queue.start();
    queue.enqueue("sale-1", new Uint8Array([1, 2, 3]));
    await flush();
    expect(printer.printed).toEqual([new Uint8Array([1, 2, 3])]);
    expect(queue.pendingCount()).toBe(0);
  });

  it("keeps receipts when the printer is unplugged and prints them in order on reconnect", async () => {
    const { printer, queue } = setup();
    queue.start();
    printer.setReachable(false);

    queue.enqueue("sale-1", new Uint8Array([1]));
    queue.enqueue("sale-2", new Uint8Array([2]));
    await flush();
    expect(queue.pendingCount()).toBe(2);
    expect(printer.printed).toHaveLength(0);

    printer.setReachable(true); // status change → queue drains by itself
    await flush();
    expect(printer.printed).toEqual([new Uint8Array([1]), new Uint8Array([2])]);
    expect(queue.pendingCount()).toBe(0);
  });

  it("never blocks the caller: enqueue returns even if the printer is down", () => {
    const { printer, queue } = setup();
    printer.setReachable(false);
    expect(() => queue.enqueue(null, new Uint8Array([9]))).not.toThrow();
    expect(queue.pendingCount()).toBe(1);
  });
});
