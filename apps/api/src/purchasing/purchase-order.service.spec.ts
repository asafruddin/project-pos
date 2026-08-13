import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PurchaseOrderService } from "./purchase-order.service";

jest.mock("../db/client", () => ({
  getDb: jest.fn(),
}));

import { getDb } from "../db/client";

const getDbMock = getDb as jest.MockedFunction<typeof getDb>;
const supplierId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const poId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const productId = "11111111-1111-4111-8111-111111111111";

function detailDb(status: string) {
  return {
    select: jest
      .fn()
      .mockReturnValueOnce({
        from: () => ({
          innerJoin: () => ({
            where: () => ({
              limit: async () => [
                {
                  poId,
                  storeId: "00000000-0000-4000-8000-000000000001",
                  supplierId,
                  supplierName: "Kopi Jaya",
                  status,
                  createdBy: "actor-1",
                  submittedAt: null,
                  approvedAt: null,
                  approvedBy: null,
                  createdAt: new Date("2026-08-13T00:00:00Z"),
                },
              ],
            }),
          }),
        }),
      })
      .mockReturnValueOnce({
        from: () => ({
          innerJoin: () => ({
            where: async () => [
              {
                productId,
                qty: 2,
                costMinor: 15000,
                receivedQty: 0,
                name: "Espresso",
              },
            ],
          }),
        }),
      }),
  };
}

describe("PurchaseOrderService", () => {
  let service: PurchaseOrderService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [PurchaseOrderService],
    }).compile();
    service = moduleRef.get(PurchaseOrderService);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("create unknown supplier → SUPPLIER_NOT_FOUND", async () => {
    getDbMock.mockReturnValue({
      transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          select: () => ({
            from: () => ({
              where: () => ({
                limit: async () => [],
              }),
            }),
          }),
        }),
    } as never);
    await expect(
      service.create({ supplier_id: supplierId, lines: [] }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("submit from draft does not touch stock and sets submitted", async () => {
    const tx = {
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
            where: async () => [{ productId }],
          }),
        }),
      update: jest.fn().mockReturnValue({
        set: () => ({
          where: async () => undefined,
        }),
      }),
    };
    getDbMock
      .mockReturnValueOnce({
        transaction: async (fn: (t: unknown) => Promise<unknown>) => fn(tx),
      } as never)
      .mockReturnValueOnce(detailDb("submitted") as never);

    const result = await service.submit(poId, "actor-1");
    expect(result.status).toBe("submitted");
    expect(tx.update).toHaveBeenCalled();
  });

  it("approve from draft is rejected", async () => {
    const tx = {
      select: jest.fn().mockReturnValue({
        from: () => ({
          where: () => ({
            limit: () => ({
              for: async () => [{ poId, status: "draft" }],
            }),
          }),
        }),
      }),
    };
    getDbMock.mockReturnValue({
      transaction: async (fn: (t: unknown) => Promise<unknown>) => fn(tx),
    } as never);
    await expect(service.approve(poId, "actor-1")).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("cancel approved is rejected", async () => {
    const tx = {
      select: jest.fn().mockReturnValue({
        from: () => ({
          where: () => ({
            limit: () => ({
              for: async () => [{ poId, status: "approved" }],
            }),
          }),
        }),
      }),
    };
    getDbMock.mockReturnValue({
      transaction: async (fn: (t: unknown) => Promise<unknown>) => fn(tx),
    } as never);
    await expect(service.cancel(poId)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
