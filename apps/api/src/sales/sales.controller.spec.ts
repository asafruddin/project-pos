import { UnauthorizedException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { SalesController } from "./sales.controller";
import { SalesService } from "./sales.service";

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
      providers: [{ provide: SalesService, useValue: sales }],
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
});
