import { Test } from "@nestjs/testing";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { SupplierImportController } from "./supplier-import.controller";
import { buildSupplierCsvTemplate } from "./supplier-import";
import { SupplierService } from "./supplier.service";

describe("SupplierImportController", () => {
  it("importFile delegates parsed rows to SupplierService", async () => {
    const suppliers = {
      importSuppliers: jest.fn().mockResolvedValue({
        created: 1,
        updated: 0,
        updated_keys: [],
        errors: [],
      }),
    };
    const moduleRef = await Test.createTestingModule({
      controllers: [SupplierImportController],
      providers: [{ provide: SupplierService, useValue: suppliers }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    const controller = moduleRef.get(SupplierImportController);
    const result = await controller.importFile({
      buffer: buildSupplierCsvTemplate(),
      originalname: "pemasok-impor-template.csv",
      size: 80,
    });
    expect(suppliers.importSuppliers).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ name: "Kopi Jaya" })]),
      [],
    );
    expect(result.created).toBe(1);
  });
});
