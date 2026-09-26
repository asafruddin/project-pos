import { STORE_1_ID, REGISTER_1_ID } from "@pos-apps/types";
import { asc, eq } from "drizzle-orm";
import { getDb } from "../db/client";
import { registers } from "../db/schema";

export async function firstRegisterId(storeId: string): Promise<string> {
  if (storeId === STORE_1_ID) return REGISTER_1_ID;
  const rows = await getDb()
    .select({ registerId: registers.registerId })
    .from(registers)
    .where(eq(registers.storeId, storeId))
    .orderBy(asc(registers.createdAt))
    .limit(1);
  return rows[0]?.registerId ?? REGISTER_1_ID;
}
