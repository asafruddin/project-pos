import { BadRequestException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { GoodsReceiptService } from "./goods-receipt.service";
import { PurchaseOrderService } from "./purchase-order.service";

jest.mock("../db/client", () => ({
  getDb: jest.fn(),
}));

jest.mock("../db/stock-ledger", () => ({
  insertStockMovement: jest.fn().mockResolvedValue(undefined),
}));

import { getDb } from "../db/client";
import { insertStockMovement } from "../db/stock-ledger";

const getDbMock = getDb as jest.MockedFunction<typeof getDb>;
const insertMovementMock = insertStockMovement as jest.MockedFunction<
  typeof insertStockMovement
>;

const poId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const productId = "11111111-1111-4111-8111-111111111111";
const receiptId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

describe("GoodsReceiptService", () => {
  let service: GoodsReceiptService;
  const purchaseOrders = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    purchaseOrders.get.mockResolvedValue({
      po_id: poId,
      status: "partially_received",
      payment_status: "unpaid",
      lines: [{ product_id: productId, qty: 10, received_qty: 3 }],
    });
    const moduleRef = await Test.createTestingModule({
      providers: [
        GoodsReceiptService,
        { provide: PurchaseOrderService, useValue: purchaseOrders },
      ],
    }).compile();
    service = moduleRef.get(GoodsReceiptService);
    insertMovementMock.mockClear();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("receive posts STOCK IN and does not require invoice paid", async () => {
    const tx = {
      select: jest
        .fn()
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              limit: () => ({
                for: async () => [{ poId, status: "approved" }],
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: () => ({
            where: async () => [
              { productId, qty: 10, receivedQty: 0 },
            ],
          }),
        })
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              for: async () => [{ productId, stockQty: 5 }],
            }),
          }),
        }),
      insert: jest
        .fn()
        .mockReturnValueOnce({
          values: () => ({
            returning: async () => [{ receiptId, poId }],
          }),
        })
        .mockReturnValueOnce({
          values: async () => undefined,
        }),
      update: jest.fn().mockReturnValue({
        set: () => ({
          where: async () => undefined,
        }),
      }),
    };
    getDbMock.mockReturnValue({
      transaction: async (fn: (t: unknown) => Promise<unknown>) => fn(tx),
    } as never);

    const result = await service.receive(
      poId,
      { lines: [{ product_id: productId, qty: 3 }] },
      "actor-1",
    );
    expect(insertMovementMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        productId,
        qtyDelta: 3,
        bucket: "sellable",
        sourceType: "goods_receipt",
        sourceId: receiptId,
        reason: "penerimaan barang",
      }),
    );
    expect(result.status).toBe("partially_received");
    expect(result.payment_status).toBe("unpaid");
  });

  it("rejects receive on draft without movements", async () => {
    getDbMock.mockReturnValue({
      transaction: async (fn: (t: unknown) => Promise<unknown>) =>
        fn({
          select: jest
            .fn()
            .mockReturnValueOnce({
              from: () => ({
                where: () => ({
                  limit: () => ({
                    for: async () => [{ poId, status: "draft" }],
                  }),
                }),
              }),
            })
            .mockReturnValueOnce({
              from: () => ({
                where: async () => [{ productId, qty: 10, receivedQty: 0 }],
              }),
            }),
        }),
    } as never);
    await expect(
      service.receive(poId, { lines: [{ product_id: productId, qty: 1 }] }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(insertMovementMock).not.toHaveBeenCalled();
  });

  it("invoice patch does not post movements", async () => {
    getDbMock
      .mockReturnValueOnce({
        transaction: async (fn: (t: unknown) => Promise<unknown>) =>
          fn({
            select: () => ({
              from: () => ({
                where: () => ({
                  limit: () => ({
                    for: async () => [{ poId, status: "completed" }],
                  }),
                }),
              }),
            }),
            update: () => ({
              set: () => ({
                where: async () => undefined,
              }),
            }),
          }),
      } as never);
    purchaseOrders.get.mockResolvedValue({
      po_id: poId,
      status: "completed",
      payment_status: "unpaid",
      invoice_ref: "INV-1",
    });
    const result = await service.updateInvoice(poId, {
      invoice_ref: "INV-1",
      payment_status: "unpaid",
    });
    expect(insertMovementMock).not.toHaveBeenCalled();
    expect(result.status).toBe("completed");
    expect(result.payment_status).toBe("unpaid");
  });
});
