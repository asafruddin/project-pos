import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import path from "node:path";
import * as schema from "@/infrastructure/db/schema";
import type { AppDb } from "@/infrastructure/db/types";
import type { Clock } from "@/core/ports/clock";
import type { IdGenerator } from "@/core/ports/id";

/** Real SQLite + the real generated migrations, in memory. */
export function createTestDb(): AppDb {
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: path.join(__dirname, "../../drizzle") });
  return db;
}

export function fakeClock(startMs = 1_700_000_000_000): Clock & { advance(ms: number): void } {
  let now = startMs;
  return {
    nowMs: () => now,
    nowIso: () => new Date(now).toISOString(),
    advance: (ms) => {
      now += ms;
    },
  };
}

export function sequentialIds(prefix = "id"): IdGenerator {
  let n = 0;
  return { uuid: () => `${prefix}-${++n}` };
}
