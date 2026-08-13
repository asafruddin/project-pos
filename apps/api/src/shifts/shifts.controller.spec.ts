import { ShiftsController } from "./shifts.controller";

describe("ShiftsController", () => {
  it("open requires shifts:create", () => {
    expect(
      Reflect.getMetadata("permission", ShiftsController.prototype.open),
    ).toEqual({ resource: "shifts", action: "create" });
  });

  it("cash in/out and close require shifts:update", () => {
    expect(
      Reflect.getMetadata("permission", ShiftsController.prototype.recordCash),
    ).toEqual({ resource: "shifts", action: "update" });
    expect(
      Reflect.getMetadata("permission", ShiftsController.prototype.close),
    ).toEqual({ resource: "shifts", action: "update" });
  });
});
