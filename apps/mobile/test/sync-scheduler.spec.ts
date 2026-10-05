import { AppError } from "@/core/errors/app-error";
import type { ConnectivityService, ConnectivitySnapshot } from "@/core/ports/connectivity";
import type { AppStateSource } from "@/infrastructure/sync/app-state-source";
import { insertOutbox, OutboxRepository } from "@/infrastructure/sync/outbox";
import { SyncEngine } from "@/infrastructure/sync/sync-engine";
import { SyncScheduler } from "@/infrastructure/sync/sync-scheduler";
import { createSyncStatusStore } from "@/infrastructure/sync/sync-status";
import { createTestDb, fakeClock } from "./helpers/test-db";

function fakeConnectivity(initial: ConnectivitySnapshot["state"]) {
  let snap: ConnectivitySnapshot = { state: initial, lastOnlineAt: null };
  const listeners = new Set<(s: ConnectivitySnapshot) => void>();
  const service: ConnectivityService = {
    getSnapshot: () => snap,
    subscribe: (l) => (listeners.add(l), () => listeners.delete(l)),
    refresh: async () => snap,
    start: () => {},
    stop: () => {},
  };
  return {
    service,
    set(state: ConnectivitySnapshot["state"]) {
      snap = { state, lastOnlineAt: null };
      listeners.forEach((l) => l(snap));
    },
  };
}

const flush = async () => {
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
};

function setup(initial: ConnectivitySnapshot["state"], send: () => Promise<void>) {
  const db = createTestDb();
  const clock = fakeClock();
  const outbox = new OutboxRepository(db);
  const status = createSyncStatusStore();
  const engine = new SyncEngine({
    outbox, clock, status,
    http: { request: async () => undefined as never },
    handlers: { "sale.sync": send },
    random: () => 0.5,
  });
  const net = fakeConnectivity(initial);
  let foreground: () => void = () => {};
  const appState: AppStateSource = { onForeground: (l) => ((foreground = l), () => {}) };
  const pulls: string[] = [];
  const scheduler = new SyncScheduler({
    engine, connectivity: net.service, appState, status, clock, intervalMs: 30_000, debounceMs: 500,
    pullTasks: [{ name: "catalog", minIntervalMs: 10 * 60_000, run: async () => void pulls.push("catalog") }],
  });
  const enqueue = (id: string) =>
    insertOutbox(db, { id, kind: "sale.sync", entityId: id, payload: {}, createdAt: clock.nowMs() });
  return { outbox, status, scheduler, net, enqueue, clock, pulls, foreground: () => foreground() };
}

describe("SyncScheduler", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("keeps work queued while offline and drains automatically when back online", async () => {
    const sent: string[] = [];
    const t = setup("offline", async () => void sent.push("x"));
    t.enqueue("s1");
    t.enqueue("s2");
    t.scheduler.start();
    await flush();

    expect(sent).toHaveLength(0);
    expect(t.status.getState().phase).toBe("offline");
    expect(t.status.getState().pending).toBe(2);

    t.net.set("online");
    await flush();

    expect(sent).toHaveLength(2);
    expect(t.outbox.stats().pending).toBe(0);
    expect(t.status.getState().phase).toBe("idle");
    expect(t.pulls).toEqual(["catalog"]); // pull follows a drained push
    t.scheduler.stop();
  });

  it("treats a degraded connection (network up, API down) like offline", async () => {
    const sent: string[] = [];
    const t = setup("degraded", async () => void sent.push("x"));
    t.enqueue("s1");
    t.scheduler.start();
    await flush();
    expect(sent).toHaveLength(0);
    expect(t.status.getState().phase).toBe("offline");
    t.scheduler.stop();
  });

  it("debounces bursts of local writes into one flush while online", async () => {
    const send = jest.fn(async () => {});
    const t = setup("online", send);
    t.scheduler.start();
    await flush();

    t.enqueue("s1");
    t.scheduler.notifyLocalWrite();
    t.enqueue("s2");
    t.scheduler.notifyLocalWrite();
    jest.advanceTimersByTime(499);
    await flush();
    expect(send).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    await flush();
    expect(send).toHaveBeenCalledTimes(2); // both rows, one cycle
    t.scheduler.stop();
  });

  it("retries on its own after a transient failure once the backoff elapses", async () => {
    let fail = true;
    const t = setup("online", async () => {
      if (fail) throw new AppError("API", "down", { status: 503 });
    });
    t.enqueue("s1");
    t.scheduler.start();
    await flush();
    expect(t.status.getState().phase).toBe("waiting");

    fail = false;
    t.clock.advance(1000);
    jest.advanceTimersByTime(1000);
    await flush();
    expect(t.outbox.stats().pending).toBe(0);
    t.scheduler.stop();
  });

  it("stops hammering the API after the token dies until the user logs in again", async () => {
    let calls = 0;
    let tokenOk = false;
    const t = setup("online", async () => {
      calls += 1;
      if (!tokenOk) throw new AppError("AUTH_UNAUTHORIZED", undefined, { status: 401 });
    });
    t.enqueue("s1");
    t.scheduler.start();
    await flush();
    expect(t.status.getState().phase).toBe("auth_required");
    expect(calls).toBe(1);

    jest.advanceTimersByTime(30_000); // interval tick is ignored
    await flush();
    expect(calls).toBe(1);

    tokenOk = true;
    await t.scheduler.syncNow("login");
    expect(t.outbox.stats().pending).toBe(0);
    t.scheduler.stop();
  });

  it("syncs again when the app returns to the foreground", async () => {
    const send = jest.fn(async () => {});
    const t = setup("online", send);
    t.scheduler.start();
    await flush();
    t.enqueue("s1");
    t.foreground();
    await flush();
    expect(send).toHaveBeenCalledTimes(1);
    t.scheduler.stop();
  });
});
