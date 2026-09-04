import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { GoodsReceiptService } from "./goods-receipt.service";
import { PurchaseOrderService } from "./purchase-order.service";
import { PurchasingController } from "./purchasing.controller";
import { SupplierImportController } from "./supplier-import.controller";
import { SupplierService } from "./supplier.service";

@Module({
  imports: [AuthModule],
  controllers: [SupplierImportController, PurchasingController],
  providers: [SupplierService, PurchaseOrderService, GoodsReceiptService],
})
export class PurchasingModule {}
