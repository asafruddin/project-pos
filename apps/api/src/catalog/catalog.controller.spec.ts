import { UnauthorizedException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { CatalogController } from "./catalog.controller";
import { CatalogService } from "./catalog.service";
import { MediaService } from "../media/media.service";

describe("CatalogController", () => {
  it("create delegates to CatalogService", async () => {
    const catalog = {
      create: jest.fn().mockResolvedValue({
        product_id: "p1",
        name: "Espresso",
        price_minor: 18000,
        stock_qty: 10,
      }),
      list: jest.fn(),
      update: jest.fn(),
      setStock: jest.fn(),
    };
    const moduleRef = await Test.createTestingModule({
      controllers: [CatalogController],
      providers: [
        { provide: CatalogService, useValue: catalog },
        { provide: MediaService, useValue: { upload: jest.fn() } },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    const controller = moduleRef.get(CatalogController);
    const result = await controller.create(
      {
        name: "Espresso",
        price_minor: 18000,
        stock_qty: 10,
      },
      { userId: "u-admin", role: "catalog_admin" },
    );
    expect(catalog.create).toHaveBeenCalledWith(
      {
        name: "Espresso",
        price_minor: 18000,
        stock_qty: 10,
      },
      "u-admin",
      "00000000-0000-4000-8000-000000000001",
    );
    expect(result.name).toBe("Espresso");
  });

  it("cashier GET omits cost_minor", async () => {
    const catalog = {
      create: jest.fn(),
      list: jest.fn().mockResolvedValue({
        products: [
          {
            product_id: "p1",
            name: "Espresso",
            price_minor: 18000,
            stock_qty: 10,
            status: "inactive",
            cost_minor: 9000,
          },
        ],
        meta: { page: 1, limit: 50, total: 1, total_pages: 1 },
      }),
      update: jest.fn(),
      setStock: jest.fn(),
    };
    const moduleRef = await Test.createTestingModule({
      controllers: [CatalogController],
      providers: [
        { provide: CatalogService, useValue: catalog },
        { provide: MediaService, useValue: { upload: jest.fn() } },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    const controller = moduleRef.get(CatalogController);
    const result = await controller.list({
      userId: "u-cashier",
      role: "cashier",
      storeId: "store-2",
    });
    expect(catalog.list).toHaveBeenCalledWith("store-2", {
      page: undefined,
      limit: undefined,
    });
    expect(result.products[0]?.cost_minor).toBeUndefined();
    expect(result.products[0]?.status).toBe("inactive");
    expect(result.meta.total).toBe(1);
  });
});

describe("Catalog routes auth contract", () => {
  it("JwtAuthGuard rejects missing token with AUTH_UNAUTHORIZED", () => {
    const guard = new JwtAuthGuard();
    try {
      guard.handleRequest(null, null as never, undefined);
      fail("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(UnauthorizedException);
      expect((err as UnauthorizedException).getResponse()).toMatchObject({
        code: "AUTH_UNAUTHORIZED",
      });
    }
  });
});
