import { Test } from "@nestjs/testing";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { GoodsReceiptService } from "./goods-receipt.service";
import { PurchaseOrderService } from "./purchase-order.service";
import { PurchasingController } from "./purchasing.controller";
import { SupplierService } from "./supplier.service";

describe("PurchasingController", () => {
  it("createPurchaseOrder passes actor id", async () => {
    const purchaseOrders = {
      create: jest.fn().mockResolvedValue({ po_id: "po1", status: "draft" }),
    };
    const moduleRef = await Test.createTestingModule({
      controllers: [PurchasingController],
      providers: [
        { provide: SupplierService, useValue: { list: jest.fn() } },
        { provide: PurchaseOrderService, useValue: purchaseOrders },
        { provide: GoodsReceiptService, useValue: { receive: jest.fn() } },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    const controller = moduleRef.get(PurchasingController);
    await controller.createPurchaseOrder(
      { supplier_id: "s1" },
      { userId: "u-admin", role: "catalog_admin" },
    );
    expect(purchaseOrders.create).toHaveBeenCalledWith(
      { supplier_id: "s1" },
      "u-admin",
    );
  });
});
