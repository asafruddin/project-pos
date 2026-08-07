import { BadRequestException, ConflictException, Injectable } from "@nestjs/common";
import { acceptCompleteSale } from "@pos-apps/domain";
import type {
  SalesListItem,
  SalesListResponse,
  SyncSaleRequest,
  SyncSaleResponse,
} from "@pos-apps/types";
import { and, desc, eq, gte, inArray, lt } from "drizzle-orm";
import { getDb } from "../db/client";
import { products, sales } from "../db/schema";

@Injectable()
export class SalesService {
  async listToday(): Promise<SalesListResponse> {
    const db = getDb();
    const start = startOfUtcDay(new Date());
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);

    const rows = await db
      .select()
      .from(sales)
      .where(and(gte(sales.completedAt, start), lt(sales.completedAt, end)))
      .orderBy(desc(sales.completedAt));

    const items: SalesListItem[] = rows.map((r) => ({
      sale_id: r.saleId,
      completed_at: r.completedAt.toISOString(),
      amount_minor: r.amountMinor,
    }));

    const daily_total_minor = items.reduce((sum, s) => sum + s.amount_minor, 0);

    return { sales: items, daily_total_minor };
  }

  async acceptSync(request: SyncSaleRequest): Promise<SyncSaleResponse> {
    validateSyncRequest(request);
    const db = getDb();
    return db.transaction(async (tx) => {
      const existing = await tx
        .select({ saleId: sales.saleId })
        .from(sales)
        .where(eq(sales.saleId, request.sale_id))
        .limit(1);
      if (existing.length) {
        return {
          sale_id: request.sale_id,
          accepted: true,
          already_accepted: true,
        };
      }

      const productIds = [...new Set(request.lines.map((line) => line.product_id))];
      const stock = await tx
        .select({
          product_id: products.productId,
          stock_qty: products.stockQty,
        })
        .from(products)
        .where(inArray(products.productId, productIds))
        .for("update");
      const accepted = acceptCompleteSale(stock, request.lines);
      if (!accepted.ok) {
        throw new ConflictException({
          code: accepted.code,
          message: accepted.message,
        });
      }

      for (const product of accepted.products) {
        await tx
          .update(products)
          .set({ stockQty: product.stock_qty, updatedAt: new Date() })
          .where(eq(products.productId, product.product_id));
      }
      await tx.insert(sales).values({
        saleId: request.sale_id,
        deviceId: request.device_id,
        completedAt: new Date(request.completed_at),
        amountMinor: request.payment.amount_minor,
        payment: request.payment,
        lines: request.lines,
      });
      return {
        sale_id: request.sale_id,
        accepted: true,
        already_accepted: false,
      };
    });
  }
}

function validateSyncRequest(request: SyncSaleRequest): void {
  const invalid =
    !request ||
    typeof request.sale_id !== "string" ||
    !request.sale_id ||
    typeof request.device_id !== "string" ||
    !request.device_id ||
    !Number.isFinite(Date.parse(request.completed_at)) ||
    !request.lines?.length ||
    request.payment?.method !== "cash" ||
    !Number.isInteger(request.payment.amount_minor) ||
    request.payment.amount_minor < 0 ||
    request.lines.some(
      (line) =>
        !Number.isInteger(line.price_minor) ||
        line.price_minor < 0 ||
        !Number.isInteger(line.qty) ||
        line.qty <= 0,
    );
  if (invalid) {
    throw new BadRequestException({
      code: "SALE_INVALID_SYNC",
      message: "Data sinkronisasi penjualan tidak valid.",
    });
  }
  const amount = request.lines.reduce(
    (total, line) => total + line.qty * line.price_minor,
    0,
  );
  if (amount !== request.payment.amount_minor) {
    throw new BadRequestException({
      code: "SALE_INVALID_SYNC",
      message: "Jumlah pembayaran tidak cocok dengan item penjualan.",
    });
  }
}

function startOfUtcDay(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}
