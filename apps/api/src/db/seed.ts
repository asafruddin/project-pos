import { config } from "dotenv";
import { resolve } from "node:path";
import { hash } from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { ACCOUNT_ROLES, defaultPermissionsForRole } from "@pos-apps/domain";
import { REGISTER_1_ID, STORE_1_ID } from "@pos-apps/types";
import { getDb, getPool } from "./client";
import { platformUsers, products, registers, rolePermissions, stockMovements, stores, users, customers } from "./schema";

config({ path: resolve(__dirname, "../../.env") });

const DEMO_USERS = [
  { username: "owner", password: "Owner123!", role: "owner" as const },
  { username: "admin", password: "Admin123!", role: "catalog_admin" as const },
  { username: "cashier", password: "Cashier123!", role: "cashier" as const },
];

const DEMO_PRODUCTS = [
  { name: "Espresso", priceMinor: 18000, stockQty: 50 },
  { name: "Latte", priceMinor: 25000, stockQty: 40 },
];

async function seed() {
  const db = getDb();

  await db
    .insert(stores)
    .values({ storeId: STORE_1_ID, name: "Store #1" })
    .onConflictDoNothing();
  await db
    .insert(registers)
    .values({
      registerId: REGISTER_1_ID,
      storeId: STORE_1_ID,
      name: "Register 1",
    })
    .onConflictDoNothing();

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
        .set({ passwordHash, role: demo.role, active: true, storeId: STORE_1_ID })
        .where(eq(users.username, demo.username));
      console.log(`updated seed user: ${demo.username} (${demo.role})`);
    } else {
      await db.insert(users).values({
        username: demo.username,
        passwordHash,
        role: demo.role,
        active: true,
        storeId: STORE_1_ID,
      });
      console.log(`created seed user: ${demo.username} (${demo.role})`);
    }
  }

  const platformPasswordHash = await hash("Superadmin123!", 10);
  const existingPlatform = await db
    .select()
    .from(platformUsers)
    .where(eq(platformUsers.username, "superadmin"))
    .limit(1);
  if (existingPlatform.length > 0) {
    await db
      .update(platformUsers)
      .set({
        passwordHash: platformPasswordHash,
        role: "super_admin",
        active: true,
      })
      .where(eq(platformUsers.username, "superadmin"));
    console.log("updated seed platform user: superadmin (super_admin)");
  } else {
    await db.insert(platformUsers).values({
      username: "superadmin",
      passwordHash: platformPasswordHash,
      role: "super_admin",
      active: true,
    });
    console.log("created seed platform user: superadmin (super_admin)");
  }

  for (const role of ACCOUNT_ROLES) {
    for (const key of defaultPermissionsForRole(role)) {
      const [resource, action] = key.split(":");
      if (!resource || !action) continue;
      await db
        .insert(rolePermissions)
        .values({ role, resource, action })
        .onConflictDoNothing();
    }
  }
  console.log("seeded role permissions");

  await db.transaction(async (tx) => {
    let rows = await tx.select().from(products);
    if (rows.length === 0) {
      rows = await tx.insert(products).values(DEMO_PRODUCTS).returning();
      console.log(`seeded ${rows.length} demo products`);
    } else {
      console.log("products already present — skip product insert");
    }

    const openings = await tx
      .select({ productId: stockMovements.productId })
      .from(stockMovements)
      .where(
        and(
          eq(stockMovements.sourceType, "cutover"),
          eq(stockMovements.reason, "opening_balance"),
        ),
      );
    const haveOpening = new Set(openings.map((row) => row.productId));
    const missing = rows.filter((row) => !haveOpening.has(row.productId));
    if (missing.length) {
      await tx.insert(stockMovements).values(
        missing.map((row) => ({
          productId: row.productId,
          storeId: STORE_1_ID,
          qtyDelta: row.stockQty,
          bucket: "sellable" as const,
          reason: "opening_balance",
          sourceType: "cutover",
        })),
      );
      console.log(`backfilled ${missing.length} opening movements`);
    }
  });

  await db
    .insert(customers)
    .values({
      customerId: "00000000-0000-4000-8000-0000000000c1",
      name: "Sari",
      phone: "081200000001",
      notes: "Pelanggan demo",
    })
    .onConflictDoNothing();

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
