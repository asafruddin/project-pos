import { AppError } from "@/core/errors/app-error";
import type { Printer, PrinterStatus } from "@/features/receipt/domain/printer";

/**
 * Stand-in until the native Bluetooth module exists. Behaves like a printer
 * that can be unplugged (`setReachable(false)`), so the queue/reconnect UI can
 * be exercised on an emulator. Printed payloads are kept for inspection.
 */
export class StubPrinter implements Printer {
  private status: PrinterStatus = { state: "connected", name: "Stub printer", detail: null };
  private listeners = new Set<(s: PrinterStatus) => void>();
  private reachable = true;
  readonly printed: Uint8Array[] = [];

  getStatus(): PrinterStatus {
    return this.status;
  }

  subscribe(listener: (status: PrinterStatus) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Dev/test switch: simulate the printer dropping or coming back. */
  setReachable(reachable: boolean): void {
    this.reachable = reachable;
    this.set(
      reachable
        ? { state: "connected", name: "Stub printer", detail: null }
        : { state: "disconnected", name: "Stub printer", detail: null },
    );
  }

  isReachable(): boolean {
    return this.reachable;
  }

  async connect(): Promise<void> {
    if (!this.reachable) throw new AppError("PRINTER", "PRINTER_UNREACHABLE");
    this.set({ state: "connected", name: "Stub printer", detail: null });
  }

  async print(bytes: Uint8Array): Promise<void> {
    if (!this.reachable) throw new AppError("PRINTER", "PRINTER_UNREACHABLE");
    this.printed.push(bytes);
    if (__DEV__) console.log(`[StubPrinter] printed ${bytes.length} bytes`);
  }

  private set(next: PrinterStatus): void {
    this.status = next;
    for (const l of this.listeners) l(next);
  }
}
