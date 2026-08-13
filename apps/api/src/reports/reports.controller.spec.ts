import { ForbiddenException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ReportsController } from "./reports.controller";
import { ReportsService } from "./reports.service";

describe("ReportsController", () => {
  it("inventory and export require financial/export permissions", () => {
    expect(
      Reflect.getMetadata("permission", ReportsController.prototype.inventory),
    ).toEqual({ resource: "reports", action: "view_financial" });
    expect(
      Reflect.getMetadata("permission", ReportsController.prototype.exportCsv),
    ).toEqual({ resource: "reports", action: "export" });
  });

  it("summary passes the viewer role through", async () => {
    const reports = {
      summary: jest.fn().mockResolvedValue({ revenue_minor: 0, txn_count: 0 }),
    };
    const moduleRef = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [{ provide: ReportsService, useValue: reports }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    const controller = moduleRef.get(ReportsController);
    await controller.summary(
      { userId: "u1", role: "cashier" },
      "2026-08-13",
      "2026-08-13",
    );
    expect(reports.summary).toHaveBeenCalledWith(
      { from: "2026-08-13", to: "2026-08-13", store_id: undefined },
      { userId: "u1", role: "cashier" },
    );
  });

  it("cashiers pass the viewer so own-only filter can apply", async () => {
    const reports = { cashiers: jest.fn().mockResolvedValue({ cashiers: [] }) };
    const moduleRef = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [{ provide: ReportsService, useValue: reports }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    const user = { userId: "cashier-1", role: "cashier" as const };
    await moduleRef.get(ReportsController).cashiers(user);
    expect(reports.cashiers).toHaveBeenCalledWith(
      { from: undefined, to: undefined, store_id: undefined },
      user,
    );
  });
});

describe("ReportsController guards", () => {
  it("does not treat ForbiddenException as a missing service", () => {
    expect(new ForbiddenException().getStatus()).toBe(403);
  });
});
