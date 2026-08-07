import { UnauthorizedException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { CatalogController } from "./catalog.controller";
import { CatalogService } from "./catalog.service";

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
      providers: [{ provide: CatalogService, useValue: catalog }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    const controller = moduleRef.get(CatalogController);
    const result = await controller.create({
      name: "Espresso",
      price_minor: 18000,
      stock_qty: 10,
    });
    expect(catalog.create).toHaveBeenCalledWith({
      name: "Espresso",
      price_minor: 18000,
      stock_qty: 10,
    });
    expect(result.name).toBe("Espresso");
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
