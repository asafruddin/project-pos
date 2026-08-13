import { Test } from "@nestjs/testing";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CustomersController } from "./customers.controller";
import { CustomersService } from "./customers.service";

describe("CustomersController", () => {
  it("create passes actor role", async () => {
    const customers = {
      create: jest.fn().mockResolvedValue({
        customer: { customer_id: "c1", name: "Sari" },
        warnings: [],
        already_accepted: false,
      }),
    };
    const moduleRef = await Test.createTestingModule({
      controllers: [CustomersController],
      providers: [{ provide: CustomersService, useValue: customers }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    const controller = moduleRef.get(CustomersController);
    await controller.create(
      { name: "Sari", phone: "0812" },
      { userId: "u1", role: "cashier" },
    );
    expect(customers.create).toHaveBeenCalledWith(
      { name: "Sari", phone: "0812" },
      { userId: "u1", role: "cashier" },
    );
  });

  it("create requires customers:create", () => {
    expect(
      Reflect.getMetadata("permission", CustomersController.prototype.create),
    ).toEqual({ resource: "customers", action: "create" });
  });

  it("delete requires customers:delete", () => {
    expect(
      Reflect.getMetadata("permission", CustomersController.prototype.remove),
    ).toEqual({ resource: "customers", action: "delete" });
  });

  it("price endpoints require customers:update", () => {
    expect(
      Reflect.getMetadata("permission", CustomersController.prototype.setPrice),
    ).toEqual({ resource: "customers", action: "update" });
    expect(
      Reflect.getMetadata(
        "permission",
        CustomersController.prototype.setGroupPrice,
      ),
    ).toEqual({ resource: "customers", action: "update" });
  });
});
