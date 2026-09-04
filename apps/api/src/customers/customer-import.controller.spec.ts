import { Test } from "@nestjs/testing";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CustomerImportController } from "./customer-import.controller";
import { buildCustomerCsvTemplate } from "./customer-import";
import { CustomersService } from "./customers.service";

describe("CustomerImportController", () => {
  it("importFile delegates parsed rows to CustomersService", async () => {
    const customers = {
      importCustomers: jest.fn().mockResolvedValue({
        created: 1,
        updated: 0,
        updated_keys: [],
        errors: [],
      }),
    };
    const moduleRef = await Test.createTestingModule({
      controllers: [CustomerImportController],
      providers: [{ provide: CustomersService, useValue: customers }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    const controller = moduleRef.get(CustomerImportController);
    const result = await controller.importFile(
      {
        buffer: buildCustomerCsvTemplate(),
        originalname: "pelanggan-impor-template.csv",
        size: 100,
      },
      { userId: "u-admin", role: "catalog_admin" },
    );
    expect(customers.importCustomers).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ phone: "08123456789" })]),
      [],
      expect.objectContaining({ userId: "u-admin", role: "catalog_admin" }),
    );
    expect(result.created).toBe(1);
  });
});
