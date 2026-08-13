import { BadRequestException } from "@nestjs/common";
import { postStockMovement } from "@pos-apps/domain";
import { STORE_1_ID, type StockBucket } from "@pos-apps/types";
import type { AppDb } from "./client";
import { stockMovements } from "./schema";

type LedgerTx = Parameters<Parameters<AppDb["transaction"]>[0]>[0];

export async function insertStockMovement(
  tx: LedgerTx,
  input: {
    productId: string;
    qtyDelta: number;
    bucket: StockBucket;
    reason: string;
    sourceType: string;
    sourceId?: string | null;
    actorId?: string | null;
    storeId?: string;
  },
): Promise<void> {
  const validated = postStockMovement({
    qty_delta: input.qtyDelta,
    bucket: input.bucket,
    reason: input.reason,
  });
  if (!validated.ok) {
    throw new BadRequestException({
      code: validated.code,
      message: validated.message,
    });
  }
  await tx.insert(stockMovements).values({
    productId: input.productId,
    storeId: input.storeId ?? STORE_1_ID,
    qtyDelta: validated.qty_delta,
    bucket: validated.bucket,
    reason: validated.reason,
    sourceType: input.sourceType,
    sourceId: input.sourceId ?? null,
    actorId: input.actorId ?? null,
  });
}
