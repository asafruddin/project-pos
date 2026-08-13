import { StoresController } from "./stores.controller";

describe("StoresController", () => {
  it("store create requires stores:update", () => {
    expect(
      Reflect.getMetadata("permission", StoresController.prototype.createStore),
    ).toEqual({ resource: "stores", action: "update" });
  });

  it("status changes require transfers:update", () => {
    expect(
      Reflect.getMetadata("permission", StoresController.prototype.transition),
    ).toEqual({ resource: "transfers", action: "update" });
  });
});
