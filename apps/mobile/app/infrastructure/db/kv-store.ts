import { eq } from "drizzle-orm";
import type { AppDb } from "./types";
import { kv } from "./schema";

export interface KvStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
  delete(key: string): void;
}

export class DrizzleKvStore implements KvStore {
  constructor(private readonly db: AppDb) {}

  get(key: string): string | null {
    const row = this.db.select().from(kv).where(eq(kv.key, key)).get();
    return row?.value ?? null;
  }

  set(key: string, value: string): void {
    this.db
      .insert(kv)
      .values({ key, value })
      .onConflictDoUpdate({ target: kv.key, set: { value } })
      .run();
  }

  delete(key: string): void {
    this.db.delete(kv).where(eq(kv.key, key)).run();
  }
}
