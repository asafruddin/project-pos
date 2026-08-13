import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  grantsFor,
  hasPermission,
  receiveTransfer,
  shipTransfer,
  transitionStockTransfer,
  validateTransferLines,
} from "@pos-apps/domain";
import type {
  CreateStockTransferRequest,
  Role,
  StockTransfer,
  StockTransferListResponse,
  StockTransferStatus,
} from "@pos-apps/types";
import { STORE_1_ID } from "@pos-apps/types";
import { asc, eq, inArray } from "drizzle-orm";
import { getDb } from "../db/client";
import { insertStockMovement } from "../db/stock-ledger";
import {
  products,
  stockTransferLines,
  stockTransfers,
} from "../db/schema";
import { StoresService } from "./stores.service";

@Injectable()
export class TransferService {
  constructor(private readonly storesService: StoresService) {}

  async list(): Promise<StockTransferListResponse> {
    const headers = await getDb()
      .select()
      .from(stockTransfers)
      .orderBy(asc(stockTransfers.createdAt));
    const lines = headers.length
      ? await getDb().select().from(stockTransferLines)
      : [];
    const names = await this.productNames(
      lines.map((line) => line.productId),
    );
    const byId = new Map<string, typeof lines>();
    for (const line of lines) {
      const list = byId.get(line.transferId) ?? [];
      list.push(line);
      byId.set(line.transferId, list);
    }
    return {
      transfers: headers.map((header) =>
        this.toTransfer(header, byId.get(header.transferId) ?? [], names),
      ),
    };
  }

  async create(
    input: CreateStockTransferRequest,
    actorId?: string,
  ): Promise<StockTransfer> {
    await this.storesService.requireStore(input.from_store_id);
    await this.storesService.requireStore(input.to_store_id);
    const parsed = validateTransferLines(input.lines);
    if (!parsed.ok) {
      throw new BadRequestException({
        code: parsed.code,
        message: parsed.message,
      });
    }
    if (input.from_store_id === input.to_store_id) {
      throw new BadRequestException({
        code: "TRANSFER_INVALID_STORE",
        message: "Toko asal dan tujuan harus berbeda.",
      });
    }
    const db = getDb();
    return db.transaction(async (tx) => {
      const [header] = await tx
        .insert(stockTransfers)
        .values({
          fromStoreId: input.from_store_id,
          toStoreId: input.to_store_id,
          status: "draft",
          createdBy: actorId ?? null,
        })
        .returning();
      if (!header) {
        throw new BadRequestException({
          code: "TRANSFER_INVALID_LINE",
          message: "Gagal membuat transfer.",
        });
      }
      await tx.insert(stockTransferLines).values(
        parsed.lines.map((line) => ({
          transferId: header.transferId,
          productId: line.product_id,
          qty: line.qty,
        })),
      );
      const names = await this.productNames(
        parsed.lines.map((line) => line.product_id),
      );
      return this.toTransfer(
        header,
        parsed.lines.map((line) => ({
          transferId: header.transferId,
          productId: line.product_id,
          qty: line.qty,
        })),
        names,
      );
    });
  }

  async transition(
    transferId: string,
    status: StockTransferStatus,
    actor: { role: Role; permissions?: string[]; userId?: string },
  ): Promise<StockTransfer> {
    const db = getDb();
    return db.transaction(async (tx) => {
      const headers = await tx
        .select()
        .from(stockTransfers)
        .where(eq(stockTransfers.transferId, transferId))
        .limit(1)
        .for("update");
      const header = headers[0];
      if (!header) {
        throw new NotFoundException({
          code: "TRANSFER_NOT_FOUND",
          message: "Transfer tidak ditemukan.",
        });
      }
      const lineRows = await tx
        .select()
        .from(stockTransferLines)
        .where(eq(stockTransferLines.transferId, transferId));
      const lines = lineRows.map((line) => ({
        product_id: line.productId,
        qty: line.qty,
      }));

      let nextStatus = status;
      const actorId = actor.userId;
      if (
        status === "approved" ||
        status === "preparing" ||
        status === "shipped" ||
        status === "received" ||
        status === "completed"
      ) {
        if (!hasPermission(grantsFor(actor), "transfers", "approve")) {
          throw new ForbiddenException({
            code: "AUTH_FORBIDDEN",
            message: "Anda tidak dapat menyetujui atau mengirim transfer.",
          });
        }
      }
      if (status === "shipped") {
        const moved = transitionStockTransfer({
          from: header.status,
          to: "shipped",
        });
        if (!moved.ok) {
          throw new BadRequestException({
            code: moved.code,
            message: moved.message,
          });
        }
        const shipped = shipTransfer({
          from_store_id: header.fromStoreId,
          to_store_id: header.toStoreId,
          lines,
        });
        if (!shipped.ok) {
          throw new BadRequestException({
            code: shipped.code,
            message: shipped.message,
          });
        }
        await this.postMovements(tx, transferId, shipped.movements, actorId);
        nextStatus = "shipped";
      } else if (status === "received") {
        const toReceived = transitionStockTransfer({
          from: header.status,
          to: "received",
        });
        if (!toReceived.ok) {
          throw new BadRequestException({
            code: toReceived.code,
            message: toReceived.message,
          });
        }
        const received = receiveTransfer({
          from_store_id: header.fromStoreId,
          to_store_id: header.toStoreId,
          lines,
        });
        if (!received.ok) {
          throw new BadRequestException({
            code: received.code,
            message: received.message,
          });
        }
        await this.postMovements(tx, transferId, received.movements, actorId);
        nextStatus = "received";
      } else {
        const moved = transitionStockTransfer({
          from: header.status,
          to: status,
        });
        if (!moved.ok) {
          throw new BadRequestException({
            code: moved.code,
            message: moved.message,
          });
        }
        nextStatus = moved.status;
      }

      const [updated] = await tx
        .update(stockTransfers)
        .set({ status: nextStatus, updatedAt: new Date() })
        .where(eq(stockTransfers.transferId, transferId))
        .returning();
      const names = await this.productNames(lineRows.map((line) => line.productId));
      return this.toTransfer(updated!, lineRows, names);
    });
  }

  private async postMovements(
    tx: Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0],
    transferId: string,
    movements: Array<{
      store_id: string;
      product_id: string;
      qty_delta: number;
      bucket: "sellable" | "damaged" | "in_transit";
      reason: string;
    }>,
    actorId?: string,
  ): Promise<void> {
    const productIds = [...new Set(movements.map((row) => row.product_id))];
    const productRows = await tx
      .select()
      .from(products)
      .where(inArray(products.productId, productIds))
      .for("update");
    const byId = new Map(productRows.map((row) => [row.productId, row]));
    for (const movement of movements) {
      const product = byId.get(movement.product_id);
      if (!product) {
        throw new NotFoundException({
          code: "CATALOG_NOT_FOUND",
          message: "Produk tidak ditemukan.",
        });
      }
      await insertStockMovement(tx, {
        productId: movement.product_id,
        storeId: movement.store_id,
        qtyDelta: movement.qty_delta,
        bucket: movement.bucket,
        reason: movement.reason,
        sourceType: "transfer",
        sourceId: transferId,
        actorId: actorId ?? null,
      });
      if (
        movement.store_id === STORE_1_ID &&
        movement.bucket === "sellable"
      ) {
        const next = product.stockQty + movement.qty_delta;
        byId.set(movement.product_id, { ...product, stockQty: next });
        await tx
          .update(products)
          .set({ stockQty: next, updatedAt: new Date() })
          .where(eq(products.productId, movement.product_id));
      }
    }
  }

  private async productNames(
    productIds: string[],
  ): Promise<Map<string, string>> {
    if (!productIds.length) return new Map();
    const rows = await getDb()
      .select({ productId: products.productId, name: products.name })
      .from(products)
      .where(inArray(products.productId, [...new Set(productIds)]));
    return new Map(rows.map((row) => [row.productId, row.name]));
  }

  private toTransfer(
    header: typeof stockTransfers.$inferSelect,
    lines: Array<{ productId: string; qty: number }>,
    names: Map<string, string>,
  ): StockTransfer {
    return {
      transfer_id: header.transferId,
      from_store_id: header.fromStoreId,
      to_store_id: header.toStoreId,
      status: header.status,
      lines: lines.map((line) => ({
        product_id: line.productId,
        name: names.get(line.productId),
        qty: line.qty,
      })),
      created_at: header.createdAt.toISOString(),
      updated_at: header.updatedAt.toISOString(),
    };
  }
}
