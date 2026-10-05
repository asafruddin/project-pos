import { createStore, type StoreApi } from "zustand/vanilla";

export type SyncPhase =
  | "idle" // nothing to do / all synced
  | "syncing"
  | "waiting" // transient failure, backing off
  | "offline" // no connection, work is queued
  | "auth_required"; // token expired/rejected, user must log in again

export type SyncStatus = {
  phase: SyncPhase;
  pending: number;
  dead: number;
  lastSyncAt: number | null;
  lastError: string | null;
  /** Epoch ms of the next scheduled retry, if backing off. */
  nextRetryAt: number | null;
};

export type SyncStatusStore = StoreApi<SyncStatus>;

export function createSyncStatusStore(): SyncStatusStore {
  return createStore<SyncStatus>(() => ({
    phase: "idle",
    pending: 0,
    dead: 0,
    lastSyncAt: null,
    lastError: null,
    nextRetryAt: null,
  }));
}
