import type { CompletedSale } from "@/features/checkout/domain/sale";
import type { PrintQueue } from "./print-queue";
import type { Printer } from "./printer";
import { encodeKitchenReceipt, encodeSaleReceipt, encodeTestPage, type ReceiptLabels } from "./receipt-encoder";

const CUSTOMER_TO_KITCHEN_MS = 5_000;

export class PrintReceiptUseCase {
  private inFlight: Promise<void> | null = null;

  constructor(
    private readonly queue: PrintQueue,
    private readonly printer: Printer,
    private readonly storeName: () => string,
    private readonly labels: () => ReceiptLabels,
    private readonly nowLabel: () => string,
    private readonly locale: () => string,
    private readonly lang: () => "id" | "en" = () => "id",
    private readonly queueNumber: (sale: CompletedSale) => number = () => 0,
    private readonly wait: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  ) {}

  private input(sale: CompletedSale, customerName?: string | null) {
    return {
      storeName: this.storeName(),
      customerName,
      queueNumber: this.queueNumber(sale),
      labels: this.labels(),
      locale: this.locale(),
      lang: this.lang(),
    };
  }

  /** Queue (and try to print) the customer copy. Never throws for printer problems. */
  execute(sale: CompletedSale, customerName?: string | null): void {
    this.queue.enqueue(sale.saleId, encodeSaleReceipt(sale, this.input(sale, customerName)));
  }

  testPage(): void {
    this.queue.enqueue(null, encodeTestPage(this.storeName(), this.nowLabel()));
  }

  /** Connect (if needed) and print a test page. Throws `AppError("PRINTER")` on failure. */
  async testNow(): Promise<void> {
    await this.printer.connect();
    await this.printer.print(encodeTestPage(this.storeName(), this.nowLabel()));
  }

  /**
   * Prints one customer copy, waits 5s, then both kitchen tickets in one write.
   * A second tap while this is running is ignored.
   */
  printNow(sale: CompletedSale, customerName?: string | null): Promise<void> {
    if (this.inFlight) return this.inFlight;
    this.inFlight = this.runPrintNow(sale, customerName).finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  private async runPrintNow(sale: CompletedSale, customerName?: string | null): Promise<void> {
    const input = this.input(sale, customerName);
    this.queue.hold();
    try {
      await this.printer.connect();
      await this.printer.print(encodeSaleReceipt(sale, input));
      await this.wait(CUSTOMER_TO_KITCHEN_MS);
      await this.printer.connect();
      await this.printer.print(encodeKitchenReceipt(sale, input));
    } finally {
      this.queue.release();
    }
  }
}
