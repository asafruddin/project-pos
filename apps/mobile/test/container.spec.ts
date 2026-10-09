/**
 * Integration: the whole composition root against real SQLite, a fake API (fetch) and a fake network.
 * Covers the account → PIN → shift journey, offline queueing, token death, and "end session keeps data".
 */
import type { AuthMeResponse, LoginResponse, Product, ProductListResponse } from "@pos-apps/types";
import { createContainer } from "@/core/di/container";
import { addProduct, emptyCart } from "@/features/cart/domain/cart";
import type { NetworkSource } from "@/infrastructure/connectivity/connectivity-monitor";
import type { AppStateSource } from "@/infrastructure/sync/app-state-source";
import { createTestDb, fakeClock } from "./helpers/test-db";

const mockSecure = new Map<string, string>();
jest.mock("expo-secure-store", () => ({
  getItemAsync: async (k: string) => mockSecure.get(k) ?? null,
  setItemAsync: async (k: string, v: string) => void mockSecure.set(k, v),
  deleteItemAsync: async (k: string) => void mockSecure.delete(k),
}));
jest.mock("expo-crypto", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const nodeCrypto = require("node:crypto");
  return { randomUUID: () => nodeCrypto.randomUUID(), getRandomBytes: (n: number) => new Uint8Array(nodeCrypto.randomBytes(n)) };
});
jest.mock("expo-constants", () => ({ __esModule: true, default: { expoConfig: { extra: {} } } }));
jest.mock("expo-file-system", () => ({
  Directory: class {
    create() {}
  },
  File: class {},
  Paths: { cache: "" },
}));

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = (expSec: number) => `${b64({ alg: "none" })}.${b64({ exp: expSec })}.sig`;

type Req = { method: string; path: string; body?: unknown };

function fakeApi(opts: { clock: { nowMs(): number } }) {
  const requests: Req[] = [];
  const state = { reachable: true, rejectToken: false, tokenExpSec: Math.floor(opts.clock.nowMs() / 1000) + 3600, userId: "user-1" };
  const product: Product = {
    product_id: "p1", name: "Kopi", price_minor: 15000, stock_qty: 50, status: "active", track_stock: true,
    tags: [], images: [], has_primary_image: false,
  };
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    if (!state.reachable) throw new TypeError("Network request failed");
    requests.push({ method, path: url.pathname, body });
    const auth = (init?.headers as Record<string, string> | undefined)?.Authorization;
    if (url.pathname === "/health") return json(200, { status: "ok" });
    if (url.pathname === "/auth/login") {
      const res: LoginResponse = {
        access_token: jwt(state.tokenExpSec), token_type: "Bearer", user_id: state.userId, role: "cashier",
        permissions: ["sales:create"], store_id: "store-1", store_name: "Warung A", store_logo_url: null, register_id: "reg-1",
        queue_reset_mode: "daily", queue_reset_at: null, manager_pin: null,
      };
      return body?.password === "secret" ? json(200, res) : json(401, { code: "AUTH_INVALID_CREDENTIALS", message: "Username atau password salah." });
    }
    if (state.rejectToken || !auth) return json(401, { code: "AUTH_UNAUTHORIZED", message: "no" });
    if (url.pathname === "/auth/me") {
      const me: AuthMeResponse = { user_id: state.userId, role: "cashier", permissions: ["sales:create"], store_id: "store-1", store_name: "Warung A", store_logo_url: null, register_id: "reg-1" } as AuthMeResponse;
      return json(200, me);
    }
    if (url.pathname === "/catalog/products") {
      const res: ProductListResponse = { products: [product], meta: { page: 1, limit: 100, total: 1, total_pages: 1 } };
      return json(200, res);
    }
    if (url.pathname === "/customers" && method === "GET") return json(200, { customers: [] });
    if (url.pathname === "/promotions") return json(200, { promotions: [] });
    return json(200, { accepted: true, already_accepted: false, shift: {}, sale_id: "x" });
  }) as typeof fetch;

  return { fetchImpl, requests, state };
}

function fakeNetwork() {
  let listener: ((c: boolean) => void) | null = null;
  let up = true;
  const source: NetworkSource = {
    subscribe(l) {
      listener = l;
      return () => (listener = null);
    },
    fetch: async () => up,
  };
  return {
    source,
    set(next: boolean) {
      up = next;
      listener?.(next);
    },
  };
}

const appState: AppStateSource = { onForeground: () => () => undefined };

async function waitFor(check: () => boolean, ms = 3000): Promise<void> {
  const end = Date.now() + ms;
  while (!check()) {
    if (Date.now() > end) throw new Error("waitFor timed out");
    await new Promise((r) => setTimeout(r, 15));
  }
}

async function boot() {
  mockSecure.clear();
  const clock = fakeClock(Date.now());
  const api = fakeApi({ clock });
  const net = fakeNetwork();
  const db = createTestDb();
  const container = createContainer({
    db,
    network: net.source,
    appState,
    fetchImpl: api.fetchImpl,
    clock,
    files: { download: async () => null, exists: () => false, remove: () => undefined },
  });
  return { container, api, net, clock, db };
}

type Booted = Awaited<ReturnType<typeof boot>>;

async function signInAndUnlock(b: Booted, pin = "246810") {
  await b.container.start();
  await b.container.signIn({ login: "kasir", password: "secret" });
  expect(await b.container.pinMode()).toBe("enroll");
  await b.container.pins.enroll("user-1", pin);
  b.container.completePinUnlock();
}

const cart = (b: Booted) => addProduct(emptyCart, b.container.repositories.catalog.getById("p1")!);

describe("container: account → PIN → shift", () => {
  let b: Booted;
  afterEach(() => b?.container.stop());

  it("walks the gates login → pin → app and rejects wrong credentials with the server message", async () => {
    b = await boot();
    await b.container.start();
    expect(b.container.auth.getState().gate).toBe("login");
    await expect(b.container.signIn({ login: "kasir", password: "bad" })).rejects.toMatchObject({ message: "Username atau password salah." });
    expect(b.container.auth.getState().gate).toBe("login");

    await b.container.signIn({ login: "kasir", password: "secret" });
    expect(b.container.auth.getState().gate).toBe("pin");
    expect(await b.container.pinMode()).toBe("enroll");
    await b.container.pins.enroll("user-1", "246810");
    b.container.completePinUnlock();
    expect(b.container.auth.getState()).toMatchObject({ gate: "app", pinUnlocked: true, shiftIntent: null });
  });

  it("sells online: pulls the catalog, then syncs shift.open before the sale", async () => {
    b = await boot();
    await signInAndUnlock(b);
    await waitFor(() => b.container.repositories.catalog.count() === 1); // catalog pulled after login
    b.container.useCases.openShift.execute(50_000);
    await b.container.useCases.completeSale.execute({ cart: cart(b), method: "qris" });

    await waitFor(() => b.api.requests.some((r) => r.path === "/sales/sync"));
    const writes = b.api.requests.filter((r) => r.method === "POST" && ["/shifts", "/sales/sync"].includes(r.path)).map((r) => r.path);
    expect(writes).toEqual(["/shifts", "/sales/sync"]);
    await waitFor(() => b.container.syncStatus.getState().pending === 0);
  });

  it("queues offline and drains by itself when the connection returns", async () => {
    b = await boot();
    await signInAndUnlock(b);
    await waitFor(() => b.container.repositories.catalog.count() === 1);
    await waitFor(() => b.container.connectivity.getSnapshot().state === "online");

    b.net.set(false);
    b.api.state.reachable = false;
    expect(b.container.connectivity.getSnapshot().state).toBe("offline");
    b.container.useCases.openShift.execute(0);
    await b.container.useCases.completeSale.execute({ cart: cart(b), method: "qris" });
    await b.container.useCases.completeSale.execute({ cart: cart(b), method: "qris" });
    expect(b.container.repositories.outbox.stats().pending).toBe(3);
    expect(b.api.requests.filter((r) => r.path === "/sales/sync")).toHaveLength(0);

    b.api.state.reachable = true;
    b.net.set(true);
    await waitFor(() => b.container.repositories.outbox.stats().pending === 0);
    expect(b.api.requests.filter((r) => r.path === "/sales/sync")).toHaveLength(2);
  });

  it("a rejected token pauses sync but never the till; logging in again as the same user resumes it", async () => {
    b = await boot();
    await signInAndUnlock(b);
    await waitFor(() => b.container.repositories.catalog.count() === 1);
    await waitFor(() => b.container.connectivity.getSnapshot().state === "online");
    b.container.useCases.openShift.execute(0);
    await waitFor(() => b.container.syncStatus.getState().pending === 0);

    b.api.state.rejectToken = true;
    await b.container.useCases.completeSale.execute({ cart: cart(b), method: "qris" }); // still sellable
    await waitFor(() => b.container.auth.getState().reauth);
    expect(b.container.auth.getState()).toMatchObject({ gate: "app", pinUnlocked: true, reauth: true });
    expect(b.container.repositories.outbox.stats().pending).toBe(1);

    b.api.state.rejectToken = false;
    await b.container.signIn({ login: "kasir", password: "secret" });
    expect(b.container.auth.getState()).toMatchObject({ gate: "app", pinUnlocked: true, reauth: false }); // no PIN, no shift close
    await waitFor(() => b.container.repositories.outbox.stats().pending === 0);
  });

  it("notices a token that expires while offline (no request needed) and keeps the till open", async () => {
    b = await boot();
    await signInAndUnlock(b);
    expect(b.container.auth.getState().reauth).toBe(false);
    b.clock.advance(2 * 3600_000); // JWT lifetime is 1 h in the fake API
    b.container.checkTokenExpiry();
    await waitFor(() => b.container.auth.getState().reauth);
    expect(b.container.auth.getState()).toMatchObject({ gate: "app", pinUnlocked: true });
    expect(b.container.syncStatus.getState().phase).toBe("auth_required");
    expect(b.container.auth.getState().session?.accessToken).toBeNull();
  });

  it("end of day keeps sales, queue and PIN: the next login only needs the PIN again", async () => {
    b = await boot();
    await signInAndUnlock(b);
    await waitFor(() => b.container.repositories.catalog.count() === 1);
    b.container.useCases.openShift.execute(0);
    b.net.set(false);
    b.api.state.reachable = false;
    await b.container.useCases.completeSale.execute({ cart: cart(b), method: "qris" });
    b.container.useCases.closeShift.execute(15_000);
    const queued = b.container.repositories.outbox.stats().pending;
    expect(queued).toBeGreaterThan(0);

    await b.container.endAccountSession();
    expect(b.container.auth.getState()).toMatchObject({ gate: "login", pinUnlocked: false, session: null });
    expect(b.container.repositories.outbox.stats().pending).toBe(queued);
    expect(b.container.repositories.sales.listForLocalDay(new Date(b.clock.nowMs()))).toHaveLength(1);

    b.api.state.reachable = true; // server first: the probe fires synchronously when the network returns
    b.net.set(true);
    await b.container.signIn({ login: "kasir", password: "secret" });
    expect(b.container.auth.getState().gate).toBe("pin");
    expect(await b.container.pinMode()).toBe("unlock"); // PIN material survived
    expect((await b.container.pins.verify("user-1", "246810")).ok).toBe(true);
    b.container.completePinUnlock();
    expect(b.container.auth.getState().gate).toBe("app");
    await waitFor(() => b.container.repositories.outbox.stats().pending === 0); // and the queue drains under the new login
  });

  it("an open shift left over must be closed first after the PIN; sign-out with an open shift goes to the shift screen", async () => {
    b = await boot();
    await signInAndUnlock(b);
    b.container.useCases.openShift.execute(0);
    expect(b.container.requestLogout()).toBe("needs-shift-close");
    expect(b.container.auth.getState()).toMatchObject({ gate: "app", shiftIntent: "logout" });

    b.container.clearShiftIntent();
    await b.container.endAccountSession(); // (what the shift screen does after closing)
    await b.container.signIn({ login: "kasir", password: "secret" });
    b.container.completePinUnlock();
    expect(b.container.auth.getState().shiftIntent).toBe("close-then-open");
  });

  it("a PIN alone never opens the till without an account login", async () => {
    b = await boot();
    await b.container.start();
    await b.container.pins.enroll("user-1", "246810");
    b.container.completePinUnlock();
    expect(b.container.auth.getState().gate).toBe("login");
  });
});
