import { isAppError } from "@/core/errors/app-error";
import type { Clock } from "@/core/ports/clock";
import type { IdGenerator } from "@/core/ports/id";
import { base64ToBytes, bytesToBase64 } from "@/utils/base64";
import { isPrinterReady, type Printer } from "./printer";

export type PrintJob = {
  jobId: string;
  saleId: string | null;
  payloadB64: string;
  attempts: number;
};

export interface PrintJobRepository {
  insert(job: { jobId: string; saleId: string | null; payloadB64: string; createdAt: number }): void;
  listPending(): PrintJob[];
  markPrinted(jobId: string, at: number): void;
  markAttempt(jobId: string, error: string | null): void;
  pendingCount(): number;
}

/**
 * Receipts are persisted before printing, so completing a sale never waits on
 * (or fails because of) the printer. The queue drains whenever the printer is
 * reachable: right away, on reconnect, or via `process()`.
 */
export class PrintQueue {
  private running: Promise<void> | null = null;
  /** A job arrived while a drain was running; that drain may already have listed its queue. */
  private again = false;
  private unsubscribe: (() => void) | null = null;
  private listeners = new Set<() => void>();

  constructor(
    private readonly jobs: PrintJobRepository,
    private readonly printer: Printer,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  start(): void {
    this.unsubscribe ??= this.printer.subscribe((status) => {
      if (isPrinterReady(status)) void this.process();
    });
    void this.process();
  }

  stop(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  pendingCount(): number {
    return this.jobs.pendingCount();
  }

  /** Persist a job and try to print it; returns immediately after persisting. */
  enqueue(saleId: string | null, bytes: Uint8Array): string {
    const jobId = this.ids.uuid();
    this.jobs.insert({
      jobId,
      saleId,
      payloadB64: bytesToBase64(bytes),
      createdAt: this.clock.nowMs(),
    });
    this.emit();
    void this.process();
    return jobId;
  }

  /** Single-flight drain, oldest first; stops at the first failure to keep order. */
  process(): Promise<void> {
    if (this.running) {
      this.again = true;
      return this.running;
    }
    this.running = (async () => {
      do {
        this.again = false;
        await this.drain();
      } while (this.again);
    })().finally(() => {
      this.running = null;
      this.emit();
    });
    return this.running;
  }

  private async drain(): Promise<void> {
    for (const job of this.jobs.listPending()) {
      try {
        if (!isPrinterReady(this.printer.getStatus())) await this.printer.connect();
        await this.printer.print(base64ToBytes(job.payloadB64));
        this.jobs.markPrinted(job.jobId, this.clock.nowMs());
      } catch (error) {
        this.jobs.markAttempt(
          job.jobId,
          isAppError(error) || error instanceof Error ? error.message : String(error),
        );
        return;
      }
    }
  }

  private emit(): void {
    for (const l of this.listeners) l();
  }
}
