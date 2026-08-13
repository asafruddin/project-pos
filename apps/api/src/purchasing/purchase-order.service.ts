import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  transitionPurchaseOrder,
  validatePurchaseOrderLines,
} from "@pos-apps/domain";
import {
  STORE_1_ID,
  type CreatePurchaseOrderRequest,
  type PurchaseOrderDetail,
  type PurchaseOrderListResponse,
  type PurchaseOrderStatus,
  type SavePurchaseOrderLinesRequest,
} from "@pos-apps/types";
import { desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "../db/client";
import {
  products,
  purchaseOrderLines,
  purchaseOrders,
  suppliers,
} from "../db/schema";

@Injectable()
export class PurchaseOrderService {
  async list(): Promise<PurchaseOrderListResponse> {
    const rows = await getDb()
      .select({
        poId: purchaseOrders.poId,
        supplierId: purchaseOrders.supplierId,
        supplierName: suppliers.name,
        status: purchaseOrders.status,
        createdAt: purchaseOrders.createdAt,
        lineCount: sql<string>`count(${purchaseOrderLines.productId})`,
      })
      .from(purchaseOrders)
      .innerJoin(suppliers, eq(suppliers.supplierId, purchaseOrders.supplierId))
      .leftJoin(
        purchaseOrderLines,
        eq(purchaseOrderLines.poId, purchaseOrders.poId),
      )
      .groupBy(
        purchaseOrders.poId,
        purchaseOrders.supplierId,
        suppliers.name,
        purchaseOrders.status,
        purchaseOrders.createdAt,
      )
      .orderBy(desc(purchaseOrders.createdAt));

    return {
      purchase_orders: rows.map((row) => ({
        po_id: row.poId,
        supplier_id: row.supplierId,
        supplier_name: row.supplierName,
        status: row.status,
        created_at: row.createdAt.toISOString(),
        line_count: Number(row.lineCount) || 0,
      })),
    };
  }

  async get(poId: string): Promise<PurchaseOrderDetail> {
    const detail = await this.load(poId);
    if (!detail) {
      throw new NotFoundException({
        code: "PO_NOT_FOUND",
        message: "Pesanan pembelian tidak ditemukan.",
      });
    }
    return detail;
  }

  async create(
    input: CreatePurchaseOrderRequest,
    actorId?: string,
  ): Promise<PurchaseOrderDetail> {
    const lines = input.lines?.length
      ? this.parseLines(input.lines)
      : [];
    const poId = await getDb().transaction(async (tx) => {
      const supplierRows = await tx
        .select({ supplierId: suppliers.supplierId })
        .from(suppliers)
        .where(eq(suppliers.supplierId, input.supplier_id))
        .limit(1);
      if (!supplierRows[0]) {
        throw new NotFoundException({
          code: "SUPPLIER_NOT_FOUND",
          message: "Pemasok tidak ditemukan.",
        });
      }
      await this.assertProducts(tx, lines.map((l) => l.product_id));
      const [header] = await tx
        .insert(purchaseOrders)
        .values({
          storeId: STORE_1_ID,
          supplierId: input.supplier_id,
          status: "draft",
          createdBy: actorId ?? null,
        })
        .returning();
      if (!header) {
        throw new BadRequestException({
          code: "PO_INVALID_LINE",
          message: "Gagal membuat pesanan pembelian.",
        });
      }
      if (lines.length) {
        await tx.insert(purchaseOrderLines).values(
          lines.map((line) => ({
            poId: header.poId,
            productId: line.product_id,
            qty: line.qty,
            costMinor: line.cost_minor,
            receivedQty: 0,
          })),
        );
      }
      return header.poId;
    });
    return this.get(poId);
  }

  async saveLines(
    poId: string,
    input: SavePurchaseOrderLinesRequest,
  ): Promise<PurchaseOrderDetail> {
    const lines = this.parseLines(input.lines);
    await getDb().transaction(async (tx) => {
      const header = await this.lock(tx, poId);
      if (header.status !== "draft") {
        throw new BadRequestException({
          code: "PO_NOT_DRAFT",
          message: "Hanya draf pesanan yang bisa diubah.",
        });
      }
      await this.assertProducts(tx, lines.map((l) => l.product_id));
      await tx.delete(purchaseOrderLines).where(eq(purchaseOrderLines.poId, poId));
      await tx.insert(purchaseOrderLines).values(
        lines.map((line) => ({
          poId,
          productId: line.product_id,
          qty: line.qty,
          costMinor: line.cost_minor,
          receivedQty: 0,
        })),
      );
      await tx
        .update(purchaseOrders)
        .set({ updatedAt: new Date() })
        .where(eq(purchaseOrders.poId, poId));
    });
    return this.get(poId);
  }

  async submit(poId: string, actorId?: string): Promise<PurchaseOrderDetail> {
    await getDb().transaction(async (tx) => {
      const header = await this.lock(tx, poId);
      const next = this.move(header.status, "submitted");
      const lineRows = await tx
        .select({ productId: purchaseOrderLines.productId })
        .from(purchaseOrderLines)
        .where(eq(purchaseOrderLines.poId, poId));
      if (!lineRows.length) {
        throw new BadRequestException({
          code: "PO_INVALID_LINE",
          message: "Pesanan harus punya minimal satu item.",
        });
      }
      await tx
        .update(purchaseOrders)
        .set({
          status: next,
          submittedAt: new Date(),
          submittedBy: actorId ?? null,
          updatedAt: new Date(),
        })
        .where(eq(purchaseOrders.poId, poId));
    });
    return this.get(poId);
  }

  async approve(poId: string, actorId?: string): Promise<PurchaseOrderDetail> {
    await getDb().transaction(async (tx) => {
      const header = await this.lock(tx, poId);
      const next = this.move(header.status, "approved");
      await tx
        .update(purchaseOrders)
        .set({
          status: next,
          approvedAt: new Date(),
          approvedBy: actorId ?? null,
          updatedAt: new Date(),
        })
        .where(eq(purchaseOrders.poId, poId));
    });
    return this.get(poId);
  }

  async cancel(poId: string, actorId?: string): Promise<PurchaseOrderDetail> {
    await getDb().transaction(async (tx) => {
      const header = await this.lock(tx, poId);
      const next = this.move(header.status, "cancelled");
      await tx
        .update(purchaseOrders)
        .set({
          status: next,
          cancelledAt: new Date(),
          cancelledBy: actorId ?? null,
          updatedAt: new Date(),
        })
        .where(eq(purchaseOrders.poId, poId));
    });
    return this.get(poId);
  }

  private move(from: PurchaseOrderStatus, to: PurchaseOrderStatus) {
    const result = transitionPurchaseOrder({ from, to });
    if (!result.ok) {
      throw new BadRequestException({
        code: result.code,
        message: result.message,
      });
    }
    return result.status;
  }

  private parseLines(
    lines: Array<{ product_id: string; qty: number; cost_minor: number }>,
  ) {
    const parsed = validatePurchaseOrderLines(lines);
    if (!parsed.ok) {
      throw new BadRequestException({
        code: parsed.code,
        message: parsed.message,
      });
    }
    return parsed.lines;
  }

  private async assertProducts(
    tx: Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0],
    productIds: string[],
  ): Promise<void> {
    if (!productIds.length) return;
    const found = await tx
      .select({ productId: products.productId })
      .from(products)
      .where(inArray(products.productId, productIds));
    if (found.length !== productIds.length) {
      throw new NotFoundException({
        code: "CATALOG_NOT_FOUND",
        message: "Produk tidak ditemukan.",
      });
    }
  }

  private async lock(
    tx: Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0],
    poId: string,
  ) {
    const rows = await tx
      .select()
      .from(purchaseOrders)
      .where(eq(purchaseOrders.poId, poId))
      .limit(1)
      .for("update");
    const header = rows[0];
    if (!header) {
      throw new NotFoundException({
        code: "PO_NOT_FOUND",
        message: "Pesanan pembelian tidak ditemukan.",
      });
    }
    return header;
  }

  private async load(poId: string): Promise<PurchaseOrderDetail | null> {
    const db = getDb();
    const headers = await db
      .select({
        poId: purchaseOrders.poId,
        storeId: purchaseOrders.storeId,
        supplierId: purchaseOrders.supplierId,
        supplierName: suppliers.name,
        status: purchaseOrders.status,
        createdBy: purchaseOrders.createdBy,
        submittedAt: purchaseOrders.submittedAt,
        approvedAt: purchaseOrders.approvedAt,
        approvedBy: purchaseOrders.approvedBy,
        createdAt: purchaseOrders.createdAt,
        invoiceRef: purchaseOrders.invoiceRef,
        paymentStatus: purchaseOrders.paymentStatus,
      })
      .from(purchaseOrders)
      .innerJoin(suppliers, eq(suppliers.supplierId, purchaseOrders.supplierId))
      .where(eq(purchaseOrders.poId, poId))
      .limit(1);
    const header = headers[0];
    if (!header) return null;

    const lines = await db
      .select({
        productId: purchaseOrderLines.productId,
        qty: purchaseOrderLines.qty,
        costMinor: purchaseOrderLines.costMinor,
        receivedQty: purchaseOrderLines.receivedQty,
        name: products.name,
      })
      .from(purchaseOrderLines)
      .innerJoin(products, eq(products.productId, purchaseOrderLines.productId))
      .where(eq(purchaseOrderLines.poId, poId));

    return {
      po_id: header.poId,
      store_id: header.storeId,
      supplier_id: header.supplierId,
      supplier_name: header.supplierName,
      status: header.status,
      created_by: header.createdBy,
      submitted_at: header.submittedAt?.toISOString() ?? null,
      approved_at: header.approvedAt?.toISOString() ?? null,
      approved_by: header.approvedBy,
      created_at: header.createdAt.toISOString(),
      invoice_ref: header.invoiceRef ?? null,
      payment_status: header.paymentStatus ?? "unpaid",
      lines: lines.map((row) => ({
        product_id: row.productId,
        name: row.name,
        qty: row.qty,
        cost_minor: row.costMinor,
        received_qty: row.receivedQty,
      })),
    };
  }
}
