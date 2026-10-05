import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";
import type * as schema from "./schema";

/**
 * Driver-agnostic handle: expo-sqlite in the app, better-sqlite3 in tests.
 * Both are synchronous drizzle drivers.
 */
export type AppDb = BaseSQLiteDatabase<"sync", any, typeof schema>;
