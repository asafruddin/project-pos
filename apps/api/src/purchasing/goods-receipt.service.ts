import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { receiveGoods, transitionPurchaseOrder } from "@pos-apps/domain";
import {
  STORE_1_ID,
  type PaymentStatus,
  type PurchaseOrderDetail,
  type ReceiveGoodsRequest,
  type UpdatePoInvoiceRequest,
} from "@pos-apps/types";
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "../db/client";
import { insertStockMovement } from "../db/stock-ledger";
import {
  goodsReceiptLines,
  goodsReceipts,
  products,
  purchaseOrderLines,
  purchaseOrders,
} from "../db/schema";
import { PurchaseOrderService } from "./purchase-order.service";

@Injectable()
export class GoodsReceiptService {
  constructor(private readonly purchaseOrders: PurchaseOrderService) {}

  async receive(
    poId: string,
    input: ReceiveGoodsRequest,
    actorId?: string,
  ): Promise<PurchaseOrderDetail> {
    await getDb().transaction(async (tx) => {
      const headers = await tx
        .select()
        .from(purchaseOrders)
        .where(eq(purchaseOrders.poId, poId))
        .limit(1)
        .for("update");
      const header = headers[0];
      if (!header) {
        throw new NotFoundException({
          code: "PO_NOT_FOUND",
          message: "Pesanan pembelian tidak ditemukan.",
        });
      }

      const poLines = await tx
        .select()
        .from(purchaseOrderLines)
        .where(eq(purchaseOrderLines.poId, poId));

      const parsed = receiveGoods({
        po_status: header.status,
        po_lines: poLines.map((line) => ({
          product_id: line.productId,
          ordered_qty: line.qty,
          received_qty: line.receivedQty,
        })),
        receive: input.lines,
      });
      if (!parsed.ok) {
        throw new BadRequestException({
          code: parsed.code,
          message: parsed.message,
        });
      }

      const productIds = parsed.receipts.map((row) => row.product_id);
      const productRows = await tx
        .select()
        .from(products)
        .where(inArray(products.productId, productIds))
        .for("update");
      const productById = new Map(
        productRows.map((row) => [row.productId, row]),
      );

      const [receipt] = await tx
        .insert(goodsReceipts)
        .values({
          poId,
          createdBy: actorId ?? null,
        })
        .returning();
      if (!receipt) {
        throw new BadRequestException({
          code: "GR_INVALID",
          message: "Gagal mencatat penerimaan.",
        });
      }

      await tx.insert(goodsReceiptLines).values(
        parsed.receipts.map((row) => ({
          receiptId: receipt.receiptId,
          productId: row.product_id,
          qty: row.qty,
        })),
      );

      for (const row of parsed.receipts) {
        const existing = productById.get(row.product_id);
        if (!existing) {
          throw new NotFoundException({
            code: "CATALOG_NOT_FOUND",
            message: "Produk tidak ditemukan.",
          });
        }
        await tx
          .update(purchaseOrderLines)
          .set({ receivedQty: row.received_qty })
          .where(
            and(
              eq(purchaseOrderLines.poId, poId),
              eq(purchaseOrderLines.productId, row.product_id),
            ),
          );
        await insertStockMovement(tx, {
          productId: row.product_id,
          storeId: STORE_1_ID,
          qtyDelta: row.qty,
          bucket: "sellable",
          reason: "penerimaan barang",
          sourceType: "goods_receipt",
          sourceId: receipt.receiptId,
          actorId: actorId ?? null,
        });
        await tx
          .update(products)
          .set({
            stockQty: existing.stockQty + row.qty,
            updatedAt: new Date(),
          })
          .where(eq(products.productId, row.product_id));
      }

      if (header.status !== parsed.status) {
        const moved = transitionPurchaseOrder({
          from: header.status,
          to: parsed.status,
        });
        if (!moved.ok) {
          throw new BadRequestException({
            code: moved.code,
            message: moved.message,
          });
        }
        await tx
          .update(purchaseOrders)
          .set({
            status: moved.status,
            updatedAt: new Date(),
          })
          .where(eq(purchaseOrders.poId, poId));
      } else {
        await tx
          .update(purchaseOrders)
          .set({ updatedAt: new Date() })
          .where(eq(purchaseOrders.poId, poId));
      }
    });
    return this.purchaseOrders.get(poId);
  }

  async updateInvoice(
    poId: string,
    input: UpdatePoInvoiceRequest,
  ): Promise<PurchaseOrderDetail> {
    await getDb().transaction(async (tx) => {
      const headers = await tx
        .select()
        .from(purchaseOrders)
        .where(eq(purchaseOrders.poId, poId))
        .limit(1)
        .for("update");
      const header = headers[0];
      if (!header) {
        throw new NotFoundException({
          code: "PO_NOT_FOUND",
          message: "Pesanan pembelian tidak ditemukan.",
        });
      }
      if (
        header.status === "draft" ||
        header.status === "submitted" ||
        header.status === "cancelled"
      ) {
        throw new BadRequestException({
          code: "PO_NOT_RECEIVABLE",
          message: "Faktur hanya untuk pesanan yang sudah disetujui.",
        });
      }
      const patch: {
        invoiceRef?: string | null;
        paymentStatus?: PaymentStatus;
        updatedAt: Date;
      } = { updatedAt: new Date() };
      if (input.invoice_ref !== undefined) {
        const trimmed = input.invoice_ref?.trim() ?? "";
        patch.invoiceRef = trimmed.length ? trimmed : null;
      }
      if (input.payment_status !== undefined) {
        patch.paymentStatus = input.payment_status;
      }
      await tx
        .update(purchaseOrders)
        .set(patch)
        .where(eq(purchaseOrders.poId, poId));
    });
    return this.purchaseOrders.get(poId);
  }
}
