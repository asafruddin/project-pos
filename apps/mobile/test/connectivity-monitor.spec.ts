import {
  ConnectivityMonitor,
  type NetworkSource,
} from "@/infrastructure/connectivity/connectivity-monitor";

function fakeNetwork(initial: boolean) {
  let listener: ((c: boolean) => void) | null = null;
  let connected = initial;
  const source: NetworkSource = {
    subscribe(l) {
      listener = l;
      return () => (listener = null);
    },
    fetch: async () => connected,
  };
  return {
    source,
    set(next: boolean) {
      connected = next;
      listener?.(next);
    },
  };
}

const flush = async () => {
  for (let i = 0; i < 10; i += 1) await Promise.resolve();
};

describe("ConnectivityMonitor", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("is online only when the network is up AND the API answers", async () => {
    const net = fakeNetwork(true);
    let apiUp = false;
    const monitor = new ConnectivityMonitor({ network: net.source, probe: async () => apiUp, degradedProbeMs: 5000 });
    const seen: string[] = [];
    monitor.subscribe((s) => seen.push(s.state));

    monitor.start();
    await flush();
    expect(monitor.getSnapshot().state).toBe("degraded"); // captive portal / server down

    apiUp = true;
    jest.advanceTimersByTime(5000);
    await flush();
    expect(monitor.getSnapshot().state).toBe("online");
    expect(seen).toEqual(["degraded", "online"]);
    monitor.stop();
  });

  it("goes offline immediately when the network drops and recovers when it returns", async () => {
    const net = fakeNetwork(true);
    const monitor = new ConnectivityMonitor({ network: net.source, probe: async () => true });
    monitor.start();
    await flush();
    expect(monitor.getSnapshot().state).toBe("online");

    net.set(false);
    expect(monitor.getSnapshot().state).toBe("offline");

    net.set(true);
    await flush();
    expect(monitor.getSnapshot().state).toBe("online");
    monitor.stop();
  });

  it("re-probes periodically to notice a silently dead uplink", async () => {
    const net = fakeNetwork(true);
    let apiUp = true;
    const monitor = new ConnectivityMonitor({ network: net.source, probe: async () => apiUp, onlineProbeMs: 30_000 });
    monitor.start();
    await flush();
    expect(monitor.getSnapshot().state).toBe("online");

    apiUp = false;
    jest.advanceTimersByTime(30_000);
    await flush();
    expect(monitor.getSnapshot().state).toBe("degraded");
    monitor.stop();
  });

  it("starts offline when the device has no network", async () => {
    const net = fakeNetwork(false);
    const monitor = new ConnectivityMonitor({ network: net.source, probe: async () => true });
    monitor.start();
    await flush();
    expect(monitor.getSnapshot().state).toBe("offline");
    monitor.stop();
  });
});
