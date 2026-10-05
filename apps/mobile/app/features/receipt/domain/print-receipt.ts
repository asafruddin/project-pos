import type { CompletedSale } from "@/features/checkout/domain/sale";
import type { PrintQueue } from "./print-queue";
import { encodeSaleReceipt, encodeTestPage, type ReceiptLabels } from "./receipt-encoder";

export class PrintReceiptUseCase {
  constructor(
    private readonly queue: PrintQueue,
    private readonly storeName: () => string,
    private readonly labels: () => ReceiptLabels,
    private readonly nowLabel: () => string,
    private readonly locale: () => string,
    private readonly lang: () => "id" | "en" = () => "id",
  ) {}

  /** Queue (and try to print) the customer copy. Never throws for printer problems. */
  execute(sale: CompletedSale, customerName?: string | null): void {
    const bytes = encodeSaleReceipt(sale, {
      storeName: this.storeName(),
      customerName,
      labels: this.labels(),
      locale: this.locale(),
      lang: this.lang(),
    });
    this.queue.enqueue(sale.saleId, bytes);
  }

  testPage(): void {
    this.queue.enqueue(null, encodeTestPage(this.storeName(), this.nowLabel()));
  }
}
