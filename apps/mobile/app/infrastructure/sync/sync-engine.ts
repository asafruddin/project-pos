import { AppError, isAuthError, isTransientError } from "@/core/errors/app-error";
import type { HttpClient } from "@/core/ports/http";
import type { Clock } from "@/core/ports/clock";
import { computeBackoffMs } from "./backoff";
import type { OutboxRepository, OutboxRow } from "./outbox";
import type { SyncStatusStore } from "./sync-status";

export type OutboxHandlerContext = {
  http: HttpClient;
};

/** Sends one outbox row. Throw `AppError` to signal failure; return = acknowledged. */
export type OutboxHandler = (row: OutboxRow, ctx: OutboxHandlerContext) => Promise<void>;

export type FlushOutcome =
  | { kind: "empty" }
  | { kind: "drained" }
  | { kind: "backoff"; nextRetryAt: number }
  | { kind: "auth_required" };

export type SyncEngineOptions = {
  outbox: OutboxRepository;
  http: HttpClient;
  clock: Clock;
  status: SyncStatusStore;
  handlers: Record<string, OutboxHandler>;
  random?: () => number;
};

/**
 * Pushes the outbox to the API in creation order.
 *
 * - transient failure (network/5xx): stop, back off, retry later — later rows
 *   may depend on this one, so we never skip ahead.
 * - auth failure: pause until the user logs in again.
 * - permanent failure (4xx): mark the row dead, keep going.
 */
export class SyncEngine {
  private running: Promise<FlushOutcome> | null = null;
  /** Someone asked for a flush mid-run (e.g. a sale was just queued). */
  private rerun = false;

  constructor(private readonly options: SyncEngineOptions) {}

  /**
   * Single-flight: concurrent callers share the in-progress run. A request that
   * arrives mid-run triggers one more pass, so a row queued right as the loop
   * finished is not left waiting for the next scheduler tick.
   */
  flush(): Promise<FlushOutcome> {
    if (this.running) {
      this.rerun = true;
      return this.running;
    }
    this.running = (async () => {
      let outcome: FlushOutcome;
      do {
        this.rerun = false;
        outcome = await this.run();
      } while (this.rerun && (outcome.kind === "drained" || outcome.kind === "empty"));
      return outcome;
    })().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  refreshStats(): void {
    this.options.status.setState({ ...this.options.outbox.stats() });
  }

  private async run(): Promise<FlushOutcome> {
    const { outbox, status, clock } = this.options;
    outbox.resetInFlight();
    this.refreshStats();
    if (outbox.nextPending() === null) {
      status.setState({ phase: "idle", lastError: null, nextRetryAt: null });
      return { kind: "empty" };
    }

    status.setState({ phase: "syncing" });
    for (;;) {
      const row = outbox.nextPending();
      if (!row) break;

      const waitMs = row.nextAttemptAt - clock.nowMs();
      if (waitMs > 0) {
        status.setState({ phase: "waiting", nextRetryAt: row.nextAttemptAt });
        return { kind: "backoff", nextRetryAt: row.nextAttemptAt };
      }

      const outcome = await this.send(row);
      this.refreshStats();
      if (outcome) return outcome;
    }

    status.setState({
      phase: "idle",
      lastSyncAt: clock.nowMs(),
      lastError: null,
      nextRetryAt: null,
    });
    return { kind: "drained" };
  }

  /** Returns an outcome to stop the loop, or null to continue with the next row. */
  private async send(row: OutboxRow): Promise<FlushOutcome | null> {
    const { outbox, http, clock, status, handlers, random } = this.options;
    const handler = handlers[row.kind];
    if (!handler) {
      outbox.markDead(row.id, `NO_HANDLER:${row.kind}`);
      return null;
    }

    outbox.markInFlight(row.id);
    try {
      await handler(row, { http });
      outbox.markDone(row.id);
      return null;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (isAuthError(error)) {
        outbox.release(row.id);
        status.setState({ phase: "auth_required", lastError: message, nextRetryAt: null });
        return { kind: "auth_required" };
      }

      if (isTransientError(error)) {
        const nextRetryAt = clock.nowMs() + computeBackoffMs(row.attempts + 1, random);
        outbox.markRetry(row.id, { error: message, nextAttemptAt: nextRetryAt });
        status.setState({ phase: "waiting", lastError: message, nextRetryAt });
        return { kind: "backoff", nextRetryAt };
      }

      outbox.markDead(row.id, error instanceof AppError ? (error.apiCode ?? message) : message);
      return null;
    }
  }
}
