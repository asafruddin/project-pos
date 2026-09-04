import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { evaluateCustomerProfile } from "@pos-apps/domain";
import { CustomersService } from "./customers.service";

jest.mock("@pos-apps/domain", () => {
  const actual = jest.requireActual("@pos-apps/domain") as object;
  return {
    ...actual,
    evaluateCustomerProfile: jest.fn(),
  };
});

jest.mock("../db/client", () => ({
  getDb: jest.fn(),
}));

import { getDb } from "../db/client";

const evaluateMock = evaluateCustomerProfile as jest.MockedFunction<
  typeof evaluateCustomerProfile
>;
const getDbMock = getDb as jest.MockedFunction<typeof getDb>;
const customerId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function okProfile() {
  return {
    ok: true as const,
    name: "Sari",
    phone: "0812",
    email: null,
    notes: null,
    group_name: null,
  };
}

describe("CustomersService", () => {
  let service: CustomersService;

  beforeEach(() => {
    service = new CustomersService();
    jest.clearAllMocks();
    evaluateMock.mockReturnValue(okProfile());
  });

  it("create warns on duplicate phone and still inserts", async () => {
    getDbMock.mockReturnValue({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [{ customerId: "other" }],
          }),
        }),
      }),
      insert: () => ({
        values: () => ({
          returning: async () => [
            {
              customerId,
              name: "Sari",
              phone: "0812",
              email: null,
              notes: null,
              groupName: null,
              createdAt: new Date("2026-08-13T00:00:00Z"),
              updatedAt: new Date("2026-08-13T00:00:00Z"),
            },
          ],
        }),
      }),
    } as never);

    const result = await service.create(
      { name: "Sari", phone: "0812" },
      { role: "cashier" },
    );
    expect(result.warnings).toEqual(["DUPLICATE_PHONE"]);
    expect(result.already_accepted).toBe(false);
    expect(result.customer.name).toBe("Sari");
  });

  it("create with existing customer_id is idempotent", async () => {
    getDbMock.mockReturnValue({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [
              {
                customerId,
                name: "Sari",
                phone: "0812",
                email: null,
                notes: null,
                groupName: null,
                createdAt: new Date("2026-08-13T00:00:00Z"),
                updatedAt: new Date("2026-08-13T00:00:00Z"),
              },
            ],
          }),
        }),
      }),
    } as never);

    const result = await service.create(
      { customer_id: customerId, name: "Sari", phone: "0812" },
      { role: "cashier" },
    );
    expect(result.already_accepted).toBe(true);
  });

  it("cashier remove is AUTH_FORBIDDEN", async () => {
    await expect(
      service.remove(customerId, { role: "cashier" }),
    ).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("get unknown → CUSTOMER_NOT_FOUND", async () => {
    getDbMock.mockReturnValue({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [],
          }),
        }),
      }),
    } as never);
    await expect(service.get(customerId)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("create maps domain validation errors", async () => {
    evaluateMock.mockReturnValue({
      ok: false,
      code: "CUSTOMER_CONTACT_REQUIRED",
      message: "Isi nomor telepon atau email.",
    });
    await expect(
      service.create({ name: "Sari" }, { role: "cashier" }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("cashier setPrice is AUTH_FORBIDDEN", async () => {
    await expect(
      service.setPrice(
        customerId,
        { product_id: "22222222-2222-4222-8222-222222222222", price_minor: 1000 },
        { role: "cashier" },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("importCustomers creates a new phone and updates an existing phone", async () => {
    getDbMock.mockReturnValue({
      select: () => ({
        from: () => ({
          where: () => ({
            then: (
              resolve: (value: Array<{ customerId: string; phone: string }>) => unknown,
            ) => resolve([{ customerId, phone: "0812" }]),
          }),
        }),
      }),
    } as never);
    const create = jest.spyOn(service, "create").mockResolvedValue({
      customer: { customer_id: "new-id", name: "Baru", phone: "0899" },
      warnings: [],
      already_accepted: false,
    } as never);
    const update = jest.spyOn(service, "update").mockResolvedValue({} as never);

    const result = await service.importCustomers(
      [
        {
          row: 2,
          key: "0899",
          name: "Baru",
          phone: "0899",
          email: null,
        },
        {
          row: 3,
          key: "0812",
          name: "Sari Updated",
          phone: "0812",
          email: null,
        },
      ],
      [],
      { role: "catalog_admin" },
    );

    expect(create).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith(
      customerId,
      expect.objectContaining({ name: "Sari Updated", phone: "0812" }),
      { role: "catalog_admin" },
    );
    expect(result.created).toBe(1);
    expect(result.updated).toBe(1);
    expect(result.updated_keys).toEqual(["0812"]);
    create.mockRestore();
    update.mockRestore();
  });

  it("importCustomers reports ambiguous phones without aborting other rows", async () => {
    getDbMock.mockReturnValue({
      select: () => ({
        from: () => ({
          where: () => ({
            then: (
              resolve: (
                value: Array<{ customerId: string; phone: string }>,
              ) => unknown,
            ) =>
              resolve([
                { customerId, phone: "0812" },
                { customerId: "other-id", phone: "0812" },
              ]),
          }),
        }),
      }),
    } as never);
    const create = jest.spyOn(service, "create").mockResolvedValue({
      customer: { customer_id: "solo", name: "Solo", phone: "0800" },
      warnings: [],
      already_accepted: false,
    } as never);

    const result = await service.importCustomers(
      [
        {
          row: 2,
          key: "0812",
          name: "Dup",
          phone: "0812",
          email: null,
        },
        {
          row: 3,
          key: "0800",
          name: "Solo",
          phone: "0800",
          email: null,
        },
      ],
      [],
      { role: "catalog_admin" },
    );

    expect(result.created).toBe(1);
    expect(result.errors[0]?.message).toContain("0812");
    expect(create).toHaveBeenCalledTimes(1);
    create.mockRestore();
  });
});
