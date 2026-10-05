import type {
  ConnectivityService,
  ConnectivitySnapshot,
  ConnectivityState,
} from "@/core/ports/connectivity";

/** Raw device-network signal (NetInfo in the app, a fake in tests). */
export interface NetworkSource {
  /** Emits whenever the device network connected-ness changes. */
  subscribe(listener: (connected: boolean) => void): () => void;
  fetch(): Promise<boolean>;
}

export type ConnectivityMonitorOptions = {
  network: NetworkSource;
  /** Resolves true when the API answered. Must never throw. */
  probe: () => Promise<boolean>;
  nowMs?: () => number;
  /** Re-probe cadence while online (detect silent drops). */
  onlineProbeMs?: number;
  /** Re-probe cadence while network is up but the API is not reachable. */
  degradedProbeMs?: number;
};

/**
 * Combines "device says it has a network" with "the API actually answers".
 * NetInfo alone reports `connected` on captive portals and dead uplinks, which
 * would make sync loop forever against a server it cannot reach.
 */
export class ConnectivityMonitor implements ConnectivityService {
  private snapshot: ConnectivitySnapshot = { state: "offline", lastOnlineAt: null };
  private readonly listeners = new Set<(s: ConnectivitySnapshot) => void>();
  private unsubscribeNetwork: (() => void) | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private networkUp = false;
  private started = false;
  private probing: Promise<ConnectivitySnapshot> | null = null;

  private readonly nowMs: () => number;
  private readonly onlineProbeMs: number;
  private readonly degradedProbeMs: number;

  constructor(private readonly options: ConnectivityMonitorOptions) {
    this.nowMs = options.nowMs ?? Date.now;
    this.onlineProbeMs = options.onlineProbeMs ?? 30_000;
    this.degradedProbeMs = options.degradedProbeMs ?? 5_000;
  }

  getSnapshot(): ConnectivitySnapshot {
    return this.snapshot;
  }

  subscribe(listener: (s: ConnectivitySnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.unsubscribeNetwork = this.options.network.subscribe((connected) => {
      this.networkUp = connected;
      if (!connected) {
        this.clearTimer();
        this.setState("offline");
      } else {
        void this.refresh();
      }
    });
    void this.options.network.fetch().then((connected) => {
      if (!this.started) return;
      this.networkUp = connected;
      if (connected) void this.refresh();
    });
  }

  stop(): void {
    this.started = false;
    this.unsubscribeNetwork?.();
    this.unsubscribeNetwork = null;
    this.clearTimer();
  }

  refresh(): Promise<ConnectivitySnapshot> {
    if (this.probing) return this.probing;
    this.clearTimer();
    this.probing = this.runProbe().finally(() => {
      this.probing = null;
    });
    return this.probing;
  }

  private async runProbe(): Promise<ConnectivitySnapshot> {
    if (!this.networkUp) {
      // The OS may not have told us yet (e.g. refresh() after a failed request).
      this.networkUp = await this.options.network.fetch();
    }
    if (!this.networkUp) {
      this.setState("offline");
      return this.snapshot;
    }
    const reachable = await this.options.probe();
    if (!this.started) return this.snapshot;
    this.setState(reachable ? "online" : "degraded");
    this.scheduleNextProbe();
    return this.snapshot;
  }

  private scheduleNextProbe(): void {
    this.clearTimer();
    if (!this.started) return;
    const delay =
      this.snapshot.state === "online" ? this.onlineProbeMs : this.degradedProbeMs;
    this.timer = setTimeout(() => void this.refresh(), delay);
  }

  private clearTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private setState(state: ConnectivityState): void {
    const lastOnlineAt = state === "online" ? this.nowMs() : this.snapshot.lastOnlineAt;
    if (state === this.snapshot.state) {
      this.snapshot = { state, lastOnlineAt };
      return;
    }
    this.snapshot = { state, lastOnlineAt };
    for (const listener of this.listeners) listener(this.snapshot);
  }
}
