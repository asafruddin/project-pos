import { isAuthError } from "@/core/errors/app-error";
import type { Clock } from "@/core/ports/clock";
import type { ConnectivityService } from "@/core/ports/connectivity";
import type { AppStateSource } from "./app-state-source";
import type { PullTask } from "./pull-task";
import type { SyncEngine } from "./sync-engine";
import type { SyncStatusStore } from "./sync-status";

export type SyncReason =
  | "start"
  | "online"
  | "foreground"
  | "local-write"
  | "interval"
  | "retry"
  | "login"
  | "manual";

export type SyncSchedulerOptions = {
  engine: SyncEngine;
  connectivity: ConnectivityService;
  appState: AppStateSource;
  status: SyncStatusStore;
  clock: Clock;
  pullTasks?: PullTask[];
  /** Safety-net tick while online. */
  intervalMs?: number;
  /** Coalesce bursts of local writes into one flush. */
  debounceMs?: number;
  /** Only pull when a user is signed in. */
  canSync?: () => boolean;
};

/**
 * Decides *when* to sync. Triggers: back online, app foreground, after a local
 * write (debounced), backoff expiry, periodic tick, login, manual.
 */
export class SyncScheduler {
  private unsubscribers: (() => void)[] = [];
  private intervalTimer: ReturnType<typeof setInterval> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private lastPullAt = new Map<string, number>();
  private started = false;

  private readonly intervalMs: number;
  private readonly debounceMs: number;

  constructor(private readonly options: SyncSchedulerOptions) {
    this.intervalMs = options.intervalMs ?? 30_000;
    this.debounceMs = options.debounceMs ?? 500;
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    const { connectivity, appState } = this.options;

    let previous = connectivity.getSnapshot().state;
    this.unsubscribers.push(
      connectivity.subscribe(({ state }) => {
        const wasOnline = previous === "online";
        previous = state;
        if (state === "online" && !wasOnline) void this.syncNow("online");
        if (state !== "online") this.markOffline();
      }),
      appState.onForeground(() => {
        void connectivity.refresh().then(() => this.syncNow("foreground"));
      }),
    );
    this.intervalTimer = setInterval(() => void this.syncNow("interval"), this.intervalMs);

    this.options.engine.refreshStats();
    connectivity.start();
    void this.syncNow("start");
  }

  stop(): void {
    this.started = false;
    for (const off of this.unsubscribers) off();
    this.unsubscribers = [];
    if (this.intervalTimer) clearInterval(this.intervalTimer);
    if (this.retryTimer) clearTimeout(this.retryTimer);
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.intervalTimer = this.retryTimer = this.debounceTimer = null;
    this.options.connectivity.stop();
  }

  /** Call after every local write that enqueued an outbox row. */
  notifyLocalWrite(): void {
    this.options.engine.refreshStats();
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      void this.syncNow("local-write");
    }, this.debounceMs);
  }

  /** Run a sync cycle now (push, then pull). Safe to call at any time. */
  async syncNow(reason: SyncReason): Promise<void> {
    const { engine, connectivity, status, canSync } = this.options;
    if (canSync && !canSync()) return;

    if (connectivity.getSnapshot().state !== "online") {
      this.markOffline();
      return;
    }
    // Waiting for a fresh login: don't hammer the API with a dead token.
    if (status.getState().phase === "auth_required" && reason !== "login" && reason !== "manual") {
      return;
    }

    const outcome = await engine.flush();

    if (outcome.kind === "backoff") {
      this.scheduleRetry(outcome.nextRetryAt);
      // A network error may mean we silently lost connectivity — verify.
      void connectivity.refresh();
      return;
    }
    if (outcome.kind === "auth_required") return;

    await this.runPullTasks(reason);
  }

  private async runPullTasks(reason: SyncReason): Promise<void> {
    const { pullTasks = [], clock } = this.options;
    for (const task of pullTasks) {
      const last = this.lastPullAt.get(task.name) ?? 0;
      const due = clock.nowMs() - last >= task.minIntervalMs;
      // Interval ticks respect minIntervalMs; every other trigger refreshes.
      if (reason === "interval" && !due) continue;
      try {
        await task.run();
        this.lastPullAt.set(task.name, clock.nowMs());
      } catch (error) {
        if (isAuthError(error)) {
          this.options.status.setState({ phase: "auth_required" });
          return;
        }
        // Transient pull failures are retried on the next trigger.
      }
    }
  }

  private markOffline(): void {
    const { status } = this.options;
    if (status.getState().phase !== "auth_required") {
      status.setState({ phase: "offline", nextRetryAt: null });
    }
  }

  private scheduleRetry(at: number): void {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    const delay = Math.max(0, at - this.options.clock.nowMs());
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      void this.syncNow("retry");
    }, delay);
  }
}
