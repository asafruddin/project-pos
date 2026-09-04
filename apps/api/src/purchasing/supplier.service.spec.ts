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

  it("importSuppliers creates a new name and updates an existing name", async () => {
    getDbMock.mockReturnValue({
      select: () => ({
        from: () => ({
          where: () => ({
            then: (
              resolve: (value: Array<{ supplierId: string; name: string }>) => unknown,
            ) => resolve([{ supplierId, name: "Kopi Jaya" }]),
          }),
        }),
      }),
    } as never);
    const create = jest.spyOn(service, "create").mockResolvedValue({
      supplier_id: "new-id",
      name: "Baru",
    } as never);
    const update = jest.spyOn(service, "update").mockResolvedValue({} as never);

    const result = await service.importSuppliers(
      [
        { row: 2, name: "Baru", phone: "0800" },
        { row: 3, name: "Kopi Jaya", phone: "0812" },
      ],
      [],
    );

    expect(create).toHaveBeenCalledWith(expect.objectContaining({ name: "Baru" }));
    expect(update).toHaveBeenCalledWith(
      supplierId,
      expect.objectContaining({ name: "Kopi Jaya", phone: "0812" }),
    );
    expect(result.created).toBe(1);
    expect(result.updated).toBe(1);
    expect(result.updated_keys).toEqual(["Kopi Jaya"]);
    create.mockRestore();
    update.mockRestore();
  });

  it("importSuppliers reports ambiguous names without aborting other rows", async () => {
    getDbMock.mockReturnValue({
      select: () => ({
        from: () => ({
          where: () => ({
            then: (
              resolve: (value: Array<{ supplierId: string; name: string }>) => unknown,
            ) =>
              resolve([
                { supplierId, name: "Dup" },
                { supplierId: "other", name: "Dup" },
              ]),
          }),
        }),
      }),
    } as never);
    const create = jest.spyOn(service, "create").mockResolvedValue({
      supplier_id: "solo",
      name: "Solo",
    } as never);

    const result = await service.importSuppliers(
      [
        { row: 2, name: "Dup" },
        { row: 3, name: "Solo" },
      ],
      [],
    );

    expect(result.created).toBe(1);
    expect(result.errors[0]?.message).toContain("Dup");
    expect(create).toHaveBeenCalledTimes(1);
    create.mockRestore();
  });
});
