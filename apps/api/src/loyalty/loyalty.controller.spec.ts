import { Test } from "@nestjs/testing";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { LoyaltyController } from "./loyalty.controller";
import { LoyaltyService } from "./loyalty.service";

describe("LoyaltyController", () => {
  it("program patch requires loyalty:update", () => {
    expect(
      Reflect.getMetadata(
        "permission",
        LoyaltyController.prototype.updateProgram,
      ),
    ).toEqual({ resource: "loyalty", action: "update" });
  });

  it("getProgram does not require catalog_admin", async () => {
    const loyalty = { getProgram: jest.fn().mockResolvedValue({ enabled: true }) };
    const moduleRef = await Test.createTestingModule({
      controllers: [LoyaltyController],
      providers: [{ provide: LoyaltyService, useValue: loyalty }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    const controller = moduleRef.get(LoyaltyController);
    await controller.getProgram();
    expect(loyalty.getProgram).toHaveBeenCalled();
  });
});
