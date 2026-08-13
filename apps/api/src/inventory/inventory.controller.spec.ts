import { Test } from "@nestjs/testing";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { InventoryController } from "./inventory.controller";
import { InventoryService } from "./inventory.service";
import { OpnameService } from "./opname.service";

describe("InventoryController", () => {
  it("overview delegates to InventoryService", async () => {
    const inventory = {
      overview: jest.fn().mockResolvedValue({ store_id: "s1", products: [] }),
      markDamaged: jest.fn(),
    };
    const moduleRef = await Test.createTestingModule({
      controllers: [InventoryController],
      providers: [
        { provide: InventoryService, useValue: inventory },
        { provide: OpnameService, useValue: { list: jest.fn() } },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    const controller = moduleRef.get(InventoryController);
    const result = await controller.overview();
    expect(inventory.overview).toHaveBeenCalled();
    expect(result.products).toEqual([]);
  });

  it("markDamaged delegates qty/reason and actor", async () => {
    const inventory = {
      overview: jest.fn(),
      markDamaged: jest.fn().mockResolvedValue({
        product_id: "p1",
        sellable_qty: 8,
        damaged_qty: 2,
      }),
    };
    const moduleRef = await Test.createTestingModule({
      controllers: [InventoryController],
      providers: [
        { provide: InventoryService, useValue: inventory },
        { provide: OpnameService, useValue: { list: jest.fn() } },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    const controller = moduleRef.get(InventoryController);
    await controller.markDamaged(
      "p1",
      { qty: 2, reason: "pecah" },
      { userId: "u-admin", role: "catalog_admin" },
    );
    expect(inventory.markDamaged).toHaveBeenCalledWith(
      "p1",
      { qty: 2, reason: "pecah" },
      "u-admin",
      undefined,
    );
  });
});
