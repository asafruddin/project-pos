import { NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { SupplierService } from "./supplier.service";

jest.mock("../db/client", () => ({
  getDb: jest.fn(),
}));

import { getDb } from "../db/client";

const getDbMock = getDb as jest.MockedFunction<typeof getDb>;
const supplierId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("SupplierService", () => {
  let service: SupplierService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [SupplierService],
    }).compile();
    service = moduleRef.get(SupplierService);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("list maps supplier rows", async () => {
    getDbMock.mockReturnValue({
      select: () => ({
        from: () => ({
          orderBy: async () => [
            {
              supplierId,
              name: "Kopi Jaya",
              contactName: "Budi",
              phone: "0812",
              email: null,
              paymentTerms: "NET 7",
              notes: null,
              createdAt: new Date("2026-08-13T00:00:00Z"),
              updatedAt: new Date("2026-08-13T00:00:00Z"),
            },
          ],
        }),
      }),
    } as never);
    const result = await service.list();
    expect(result.suppliers[0]?.name).toBe("Kopi Jaya");
    expect(result.suppliers[0]?.payment_terms).toBe("NET 7");
  });

  it("get unknown → SUPPLIER_NOT_FOUND", async () => {
    getDbMock.mockReturnValue({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [],
          }),
        }),
      }),
    } as never);
    await expect(service.get(supplierId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
