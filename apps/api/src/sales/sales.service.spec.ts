import { BadRequestException, ConflictException } from "@nestjs/common";
import { acceptCompleteSale } from "@pos-apps/domain";
import type { SyncSaleRequest } from "@pos-apps/types";
import { SalesService } from "./sales.service";

jest.mock("@pos-apps/domain", () => ({
  acceptCompleteSale: jest.fn(),
}));

jest.mock("../db/client", () => ({
  getDb: jest.fn(),
}));

import { getDb } from "../db/client";

const acceptCompleteSaleMock = acceptCompleteSale as jest.MockedFunction<
  typeof acceptCompleteSale
>;
const getDbMock = getDb as jest.MockedFunction<typeof getDb>;

function validRequest(overrides: Partial<SyncSaleRequest> = {}): SyncSaleRequest {
  return {
    sale_id: "11111111-1111-4111-8111-111111111111",
    device_id: "device-1",
    completed_at: "2026-08-07T02:00:00.000Z",
    payment: { method: "cash", amount_minor: 36000 },
    lines: [
      {
        product_id: "22222222-2222-4222-8222-222222222222",
        qty: 2,
        price_minor: 18000,
      },
    ],
    ...overrides,
  };
}

describe("SalesService.acceptSync", () => {
  let service: SalesService;

  beforeEach(() => {
    service = new SalesService();
    jest.clearAllMocks();
  });

  it("rejects invalid sync payloads", async () => {
    await expect(
      service.acceptSync(validRequest({ payment: { method: "cash", amount_minor: 1 } })),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("returns already_accepted when sale_id exists (idempotent)", async () => {
    getDbMock.mockReturnValue({
      transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          select: () => ({
            from: () => ({
              where: () => ({
                limit: async () => [{ saleId: "11111111-1111-4111-8111-111111111111" }],
              }),
            }),
          }),
        }),
    } as never);

    await expect(service.acceptSync(validRequest())).resolves.toEqual({
      sale_id: "11111111-1111-4111-8111-111111111111",
      accepted: true,
      already_accepted: true,
    });
    expect(acceptCompleteSaleMock).not.toHaveBeenCalled();
  });

  it("fails closed when AcceptCompleteSale rejects stock", async () => {
    acceptCompleteSaleMock.mockReturnValue({
      ok: false,
      code: "SALE_INSUFFICIENT_STOCK",
      message: "Stok tidak mencukupi untuk menyelesaikan penjualan.",
    });
    getDbMock.mockReturnValue({
      transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          select: () => ({
            from: () => ({
              where: () => ({
                limit: async () => [],
                for: async () => [
                  {
                    product_id: "22222222-2222-4222-8222-222222222222",
                    stock_qty: 1,
                  },
                ],
              }),
            }),
          }),
        }),
    } as never);

    await expect(service.acceptSync(validRequest())).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
