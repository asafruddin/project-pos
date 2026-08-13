import { UnauthorizedException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ReturnsService } from "./returns.service";
import { SalesController } from "./sales.controller";
import { SalesService } from "./sales.service";

const returns = {
  lookup: jest.fn(),
  create: jest.fn(),
  listOpen: jest.fn(),
  refund: jest.fn(),
  linkExchange: jest.fn(),
};

describe("SalesController", () => {
  it("list returns empty shell from service", async () => {
    const sales = {
      listToday: jest.fn().mockResolvedValue({
        sales: [],
        daily_total_minor: 0,
      }),
    };
    const moduleRef = await Test.createTestingModule({
      controllers: [SalesController],
      providers: [
        { provide: SalesService, useValue: sales },
        { provide: ReturnsService, useValue: returns },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    const controller = moduleRef.get(SalesController);
    await expect(controller.list()).resolves.toEqual({
      sales: [],
      daily_total_minor: 0,
    });
  });

  it("route is Jwt-protected (guard contract)", () => {
    const guard = new JwtAuthGuard();
    expect(() =>
      guard.handleRequest(null, null as never, undefined),
    ).toThrow(UnauthorizedException);
  });

  it("void requires sales:void", () => {
    expect(
      Reflect.getMetadata("permission", SalesController.prototype.voidSale),
    ).toEqual({ resource: "sales", action: "void" });
  });

  it("refund requires returns:approve", () => {
    expect(
      Reflect.getMetadata("permission", SalesController.prototype.refund),
    ).toEqual({ resource: "returns", action: "approve" });
  });

  it("link exchange requires returns:update", () => {
    expect(
      Reflect.getMetadata("permission", SalesController.prototype.linkExchange),
    ).toEqual({ resource: "returns", action: "update" });
  });
});
