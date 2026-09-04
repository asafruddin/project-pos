import { Test } from "@nestjs/testing";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { CatalogService } from "./catalog.service";
import { ProductImportController } from "./product-import.controller";
import { buildCsvTemplate } from "./product-import";

describe("ProductImportController", () => {
  it("importFile delegates parsed rows to CatalogService", async () => {
    const catalog = {
      importProducts: jest.fn().mockResolvedValue({
        created: 1,
        updated: 0,
        updated_skus: [],
        errors: [],
      }),
    };
    const moduleRef = await Test.createTestingModule({
      controllers: [ProductImportController],
      providers: [{ provide: CatalogService, useValue: catalog }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    const controller = moduleRef.get(ProductImportController);
    const result = await controller.importFile(
      {
        buffer: buildCsvTemplate(),
        originalname: "produk-impor-template.csv",
        size: 100,
      },
      { userId: "u-admin", role: "catalog_admin" },
    );

    expect(catalog.importProducts).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ sku: "ESP-001" })]),
      [],
      "u-admin",
      "00000000-0000-4000-8000-000000000001",
    );
    expect(result.created).toBe(1);
  });

  it("template returns a csv stream by default", async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ProductImportController],
      providers: [{ provide: CatalogService, useValue: {} }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    const controller = moduleRef.get(ProductImportController);
    const file = await controller.template();
    expect(file).toBeDefined();
  });
});
