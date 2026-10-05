/**
 * online    – device network is up and the API answered a health probe.
 * degraded  – network reports connected but the API is unreachable (captive
 *             portal, dead uplink, server down). Treated as offline for sync.
 * offline   – no network.
 */
export type ConnectivityState = "online" | "degraded" | "offline";

export type ConnectivitySnapshot = {
  state: ConnectivityState;
  /** Epoch ms of the last successful probe, or null if never. */
  lastOnlineAt: number | null;
};

export interface ConnectivityService {
  getSnapshot(): ConnectivitySnapshot;
  subscribe(listener: (snapshot: ConnectivitySnapshot) => void): () => void;
  /** Probe now (e.g. after a failed request). Resolves with the new snapshot. */
  refresh(): Promise<ConnectivitySnapshot>;
  start(): void;
  stop(): void;
}
