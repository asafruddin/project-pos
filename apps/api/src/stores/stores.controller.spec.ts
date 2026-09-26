import { ForbiddenException } from "@nestjs/common";
import { StoresController } from "./stores.controller";

describe("StoresController", () => {
  it("store create and update require stores:update", () => {
    expect(
      Reflect.getMetadata("permission", StoresController.prototype.createStore),
    ).toEqual({ resource: "stores", action: "update" });
    expect(
      Reflect.getMetadata("permission", StoresController.prototype.updateStore),
    ).toEqual({ resource: "stores", action: "update" });
    expect(
      Reflect.getMetadata("permission", StoresController.prototype.uploadLogo),
    ).toEqual({ resource: "stores", action: "update" });
  });

  it("status changes require transfers:update", () => {
    expect(
      Reflect.getMetadata("permission", StoresController.prototype.transition),
    ).toEqual({ resource: "transfers", action: "update" });
  });

  it("rejects tenant creation from a store JWT", () => {
    const controller = new StoresController({} as never, {} as never);
    expect(() => controller.createStore()).toThrow(ForbiddenException);
  });
});
