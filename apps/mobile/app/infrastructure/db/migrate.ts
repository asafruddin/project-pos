import { migrate } from "drizzle-orm/expo-sqlite/migrator";
import type { ExpoSQLiteDatabase } from "drizzle-orm/expo-sqlite";
import migrations from "../../../drizzle/migrations";
import type * as schema from "./schema";

/** Run pending migrations before anything reads the database. */
export async function runMigrations(
  db: ExpoSQLiteDatabase<typeof schema>,
): Promise<void> {
  await migrate(db, migrations);
}
