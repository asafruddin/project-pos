import { config } from "dotenv";
import { resolve } from "node:path";
import { hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import { getDb, getPool } from "./client";
import { products, users } from "./schema";

config({ path: resolve(__dirname, "../../.env") });

const DEMO_USERS = [
  { username: "admin", password: "Admin123!", role: "catalog_admin" as const },
  { username: "cashier", password: "Cashier123!", role: "cashier" as const },
];

const DEMO_PRODUCTS = [
  { name: "Espresso", priceMinor: 18000, stockQty: 50 },
  { name: "Latte", priceMinor: 25000, stockQty: 40 },
];

async function seed() {
  const db = getDb();

  for (const demo of DEMO_USERS) {
    const passwordHash = await hash(demo.password, 10);
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.username, demo.username))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(users)
        .set({ passwordHash, role: demo.role })
        .where(eq(users.username, demo.username));
      console.log(`updated seed user: ${demo.username} (${demo.role})`);
    } else {
      await db.insert(users).values({
        username: demo.username,
        passwordHash,
        role: demo.role,
      });
      console.log(`created seed user: ${demo.username} (${demo.role})`);
    }
  }

  const existingProducts = await db.select().from(products).limit(1);
  if (existingProducts.length === 0) {
    await db.insert(products).values(DEMO_PRODUCTS);
    console.log(`seeded ${DEMO_PRODUCTS.length} demo products`);
  } else {
    console.log("products already present — skip product seed");
  }

  await getPool().end();
}

void seed().catch(async (err: unknown) => {
  console.error(err);
  try {
    await getPool().end();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
