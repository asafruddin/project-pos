import { PromotionsController } from "./promotions.controller";

describe("PromotionsController", () => {
  it("mutating routes require promotions permissions", () => {
    expect(
      Reflect.getMetadata("permission", PromotionsController.prototype.create),
    ).toEqual({ resource: "promotions", action: "create" });
    expect(
      Reflect.getMetadata("permission", PromotionsController.prototype.update),
    ).toEqual({ resource: "promotions", action: "update" });
    expect(
      Reflect.getMetadata("permission", PromotionsController.prototype.remove),
    ).toEqual({ resource: "promotions", action: "delete" });
  });
});
