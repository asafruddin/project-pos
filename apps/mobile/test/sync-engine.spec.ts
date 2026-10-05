import { AppError } from "@/core/errors/app-error";
import type { HttpClient } from "@/core/ports/http";
import { insertOutbox, OutboxRepository } from "@/infrastructure/sync/outbox";
import { SyncEngine, type OutboxHandler } from "@/infrastructure/sync/sync-engine";
import { createSyncStatusStore } from "@/infrastructure/sync/sync-status";
import { createTestDb, fakeClock } from "./helpers/test-db";

const http: HttpClient = { request: async () => undefined as never };

function setup(handlers: Record<string, OutboxHandler>) {
  const db = createTestDb();
  const clock = fakeClock();
  const outbox = new OutboxRepository(db);
  const status = createSyncStatusStore();
  const engine = new SyncEngine({ outbox, http, clock, status, handlers, random: () => 0.5 });
  const add = (id: string, kind: "shift.open" | "sale.sync" = "sale.sync") =>
    insertOutbox(db, { id, kind, entityId: id, payload: { id }, createdAt: clock.nowMs() });
  return { db, clock, outbox, status, engine, add };
}

describe("SyncEngine", () => {
  it("is a no-op with an empty outbox", async () => {
    const { engine, status } = setup({});
    expect(await engine.flush()).toEqual({ kind: "empty" });
    expect(status.getState().phase).toBe("idle");
  });

  it("sends rows in creation order and removes them when acknowledged", async () => {
    const sent: string[] = [];
    const { engine, add, outbox, status, clock } = setup({
      "shift.open": async (row) => void sent.push(row.id),
      "sale.sync": async (row) => void sent.push(row.id),
    });
    add("shift-1", "shift.open");
    add("sale-1");
    add("sale-2");

    expect(await engine.flush()).toEqual({ kind: "drained" });
    expect(sent).toEqual(["shift-1", "sale-1", "sale-2"]);
    expect(outbox.stats()).toEqual({ pending: 0, dead: 0 });
    expect(status.getState().lastSyncAt).toBe(clock.nowMs());
  });

  it("stops at a transient failure, backs off, and keeps order on retry", async () => {
    let fail = true;
    const sent: string[] = [];
    const { engine, add, outbox, status, clock } = setup({
      "sale.sync": async (row) => {
        if (row.id === "sale-1" && fail) throw new AppError("NETWORK");
        sent.push(row.id);
      },
    });
    add("sale-1");
    add("sale-2");

    const first = await engine.flush();
    expect(first).toEqual({ kind: "backoff", nextRetryAt: clock.nowMs() + 1000 });
    expect(sent).toEqual([]); // sale-2 must not jump ahead of sale-1
    expect(outbox.stats().pending).toBe(2);
    expect(status.getState().phase).toBe("waiting");

    // Still inside the backoff window: nothing is sent.
    expect((await engine.flush()).kind).toBe("backoff");
    expect(sent).toEqual([]);

    fail = false;
    clock.advance(1001);
    expect(await engine.flush()).toEqual({ kind: "drained" });
    expect(sent).toEqual(["sale-1", "sale-2"]);
  });

  it("treats 5xx and 429 as transient, other 4xx as permanent", async () => {
    const codes: Record<string, number> = { a: 503, b: 429, c: 422 };
    const { engine, add, outbox } = setup({
      "sale.sync": async (row) => {
        throw new AppError("API", "x", { status: codes[row.id] });
      },
    });
    add("c");
    expect((await engine.flush()).kind).toBe("drained"); // dead-lettered, queue moves on
    expect(outbox.stats()).toEqual({ pending: 0, dead: 1 });

    add("a");
    expect((await engine.flush()).kind).toBe("backoff");
    expect(outbox.stats()).toEqual({ pending: 1, dead: 1 });
  });

  it("dead-letters a rejected row and continues with the next", async () => {
    const sent: string[] = [];
    const { engine, add, outbox } = setup({
      "sale.sync": async (row) => {
        if (row.id === "bad") throw new AppError("API", "invalid", { status: 400, apiCode: "SALE_INVALID" });
        sent.push(row.id);
      },
    });
    add("bad");
    add("good");

    expect(await engine.flush()).toEqual({ kind: "drained" });
    expect(sent).toEqual(["good"]);
    const dead = outbox.listDead();
    expect(dead).toHaveLength(1);
    expect(dead[0]).toMatchObject({ id: "bad", lastError: "SALE_INVALID" });

    expect(outbox.reviveDead()).toBe(1);
    expect(outbox.stats()).toEqual({ pending: 1, dead: 0 });
  });

  it("pauses on auth errors without burning attempts", async () => {
    const { engine, add, outbox, status } = setup({
      "sale.sync": async () => {
        throw new AppError("AUTH_SESSION_EXPIRED");
      },
    });
    add("sale-1");

    expect(await engine.flush()).toEqual({ kind: "auth_required" });
    expect(status.getState().phase).toBe("auth_required");
    expect(outbox.nextPending()?.attempts).toBe(0);
  });

  it("recovers rows left in flight by a killed app", async () => {
    const sent: string[] = [];
    const { engine, add, outbox } = setup({ "sale.sync": async (r) => void sent.push(r.id) });
    add("sale-1");
    outbox.markInFlight("sale-1"); // app died after this point
    expect(outbox.nextPending()).toBeNull();

    await engine.flush();
    expect(sent).toEqual(["sale-1"]);
  });

  it("shares one run between concurrent flush calls", async () => {
    let calls = 0;
    const { engine, add } = setup({
      "sale.sync": async () => {
        calls += 1;
        await Promise.resolve();
      },
    });
    add("sale-1");
    const [a, b] = await Promise.all([engine.flush(), engine.flush()]);
    expect(a).toBe(b);
    expect(calls).toBe(1);
  });

  it("dead-letters rows of an unknown kind instead of looping", async () => {
    const { engine, add, outbox } = setup({});
    add("sale-1");
    await engine.flush();
    expect(outbox.stats()).toEqual({ pending: 0, dead: 1 });
  });
});

describe("SyncEngine re-entrancy", () => {
  it("sends a row queued while a flush is finishing, without waiting for the next tick", async () => {
    const sent: string[] = [];
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => (release = r));
    const { engine, add } = setup({
      "sale.sync": async (row) => {
        sent.push(row.id);
        if (row.id === "s1") await gate;
      },
    });
    add("s1");
    const first = engine.flush();
    await Promise.resolve();

    add("s2"); // queued after the loop already saw the queue
    const second = engine.flush();
    release();
    await Promise.all([first, second]);

    expect(sent).toEqual(["s1", "s2"]);
  });
});
