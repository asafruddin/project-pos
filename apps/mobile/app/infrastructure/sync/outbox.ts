import { and, asc, count, eq, lte, sql } from "drizzle-orm";
import type { AppDb } from "@/infrastructure/db/types";
import { outbox } from "@/infrastructure/db/schema";

/** Order here is documentation only; ordering at runtime is by `seq`. */
export type OutboxKind =
  | "customer.create"
  | "shift.open"
  | "cash.movement"
  | "shift.close"
  | "sale.sync"
  | "sale.void";

export type OutboxRow = {
  seq: number;
  id: string;
  kind: string;
  entityId: string;
  payload: unknown;
  attempts: number;
  nextAttemptAt: number;
  lastError: string | null;
  status: "pending" | "in_flight" | "dead";
};

export type NewOutboxEntry = {
  id: string;
  kind: OutboxKind;
  entityId: string;
  payload: unknown;
  createdAt: number;
};

export type OutboxStats = {
  pending: number;
  dead: number;
};

/**
 * Insert into the outbox. Takes any db/transaction handle so callers can write
 * the domain row and its outbox row atomically.
 */
export function insertOutbox(db: AppDb, entry: NewOutboxEntry): void {
  db.insert(outbox)
    .values({
      id: entry.id,
      kind: entry.kind,
      entityId: entry.entityId,
      payload: JSON.stringify(entry.payload),
      createdAt: entry.createdAt,
    })
    .run();
}

function toRow(r: typeof outbox.$inferSelect): OutboxRow {
  return {
    seq: r.seq,
    id: r.id,
    kind: r.kind,
    entityId: r.entityId,
    payload: JSON.parse(r.payload),
    attempts: r.attempts,
    nextAttemptAt: r.nextAttemptAt,
    lastError: r.lastError,
    status: r.status,
  };
}

export class OutboxRepository {
  constructor(private readonly db: AppDb) {}

  /** App was killed mid-request: those rows were never confirmed, retry them. */
  resetInFlight(): void {
    this.db
      .update(outbox)
      .set({ status: "pending" })
      .where(eq(outbox.status, "in_flight"))
      .run();
  }

  /** Oldest row still waiting to be sent (strict creation order). */
  nextPending(): OutboxRow | null {
    const row = this.db
      .select()
      .from(outbox)
      .where(eq(outbox.status, "pending"))
      .orderBy(asc(outbox.seq))
      .limit(1)
      .get();
    return row ? toRow(row) : null;
  }

  markInFlight(id: string): void {
    this.db.update(outbox).set({ status: "in_flight" }).where(eq(outbox.id, id)).run();
  }

  /** Sent and acknowledged by the API. */
  markDone(id: string): void {
    this.db.delete(outbox).where(eq(outbox.id, id)).run();
  }

  /** Failed for a reason that may pass (network, 5xx): retry later. */
  markRetry(id: string, input: { error: string | null; nextAttemptAt: number }): void {
    this.db
      .update(outbox)
      .set({
        status: "pending",
        attempts: sql`${outbox.attempts} + 1`,
        nextAttemptAt: input.nextAttemptAt,
        lastError: input.error,
      })
      .where(eq(outbox.id, id))
      .run();
  }

  /** Back to pending without counting an attempt (e.g. auth required). */
  release(id: string): void {
    this.db.update(outbox).set({ status: "pending" }).where(eq(outbox.id, id)).run();
  }

  /** Rejected permanently by the API; stops retrying, stays visible. */
  markDead(id: string, error: string | null): void {
    this.db
      .update(outbox)
      .set({
        status: "dead",
        attempts: sql`${outbox.attempts} + 1`,
        lastError: error,
      })
      .where(eq(outbox.id, id))
      .run();
  }

  /** Manual "try again" for rows the API rejected. */
  reviveDead(): number {
    const result = this.db
      .update(outbox)
      .set({ status: "pending", nextAttemptAt: 0, attempts: 0 })
      .where(eq(outbox.status, "dead"))
      .run();
    return result.changes;
  }

  listDead(): OutboxRow[] {
    return this.db
      .select()
      .from(outbox)
      .where(eq(outbox.status, "dead"))
      .orderBy(asc(outbox.seq))
      .all()
      .map(toRow);
  }

  /** Rewrite the payload (used when a local id is replaced by the server's). */
  rewritePayloads(
    kind: OutboxKind,
    transform: (payload: unknown, row: OutboxRow) => unknown,
  ): void {
    const rows = this.db.select().from(outbox).where(eq(outbox.kind, kind)).all();
    for (const raw of rows) {
      const row = toRow(raw);
      this.db
        .update(outbox)
        .set({ payload: JSON.stringify(transform(row.payload, row)) })
        .where(eq(outbox.id, row.id))
        .run();
    }
  }

  stats(): OutboxStats {
    const rows = this.db
      .select({ status: outbox.status, n: count() })
      .from(outbox)
      .groupBy(outbox.status)
      .all();
    const get = (s: string) => rows.find((r) => r.status === s)?.n ?? 0;
    return { pending: get("pending") + get("in_flight"), dead: get("dead") };
  }

  /** Entity ids that still wait to be sent (pending, in flight or dead) for the given kinds. */
  unsyncedEntityIds(kinds: OutboxKind[]): Set<string> {
    const rows = this.db
      .select({ entityId: outbox.entityId, kind: outbox.kind })
      .from(outbox)
      .all();
    return new Set(rows.filter((r) => (kinds as string[]).includes(r.kind)).map((r) => r.entityId));
  }

  /** Exposed for tests. */
  dueCount(nowMs: number): number {
    return (
      this.db
        .select({ n: count() })
        .from(outbox)
        .where(and(eq(outbox.status, "pending"), lte(outbox.nextAttemptAt, nowMs)))
        .get()?.n ?? 0
    );
  }
}
