import { drizzle, type ExpoSQLiteDatabase } from "drizzle-orm/expo-sqlite";
import { openDatabaseSync } from "expo-sqlite";
import * as schema from "./schema";

export const DB_NAME = "pos-cashier.db";

/** Opens the on-device database. WAL keeps reads from blocking sync writes. */
export function openAppDb(): ExpoSQLiteDatabase<typeof schema> {
  const sqlite = openDatabaseSync(DB_NAME);
  sqlite.execSync("PRAGMA journal_mode = WAL;");
  sqlite.execSync("PRAGMA foreign_keys = ON;");
  return drizzle(sqlite, { schema });
}
