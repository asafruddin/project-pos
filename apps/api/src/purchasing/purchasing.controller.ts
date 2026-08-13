import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import type {
  PurchaseOrderDetail,
  PurchaseOrderListResponse,
  Supplier,
  SupplierListResponse,
} from "@pos-apps/types";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type { AuthUser } from "../auth/jwt.strategy";
import { RequirePermission } from "../auth/permission.decorator";
import { PermissionsGuard } from "../auth/permissions.guard";
import {
  CreatePurchaseOrderDto,
  CreateSupplierDto,
  ReceiveGoodsDto,
  SavePurchaseOrderLinesDto,
  UpdatePoInvoiceDto,
  UpdateSupplierDto,
} from "./dto/purchasing.dto";
import { GoodsReceiptService } from "./goods-receipt.service";
import { PurchaseOrderService } from "./purchase-order.service";
import { SupplierService } from "./supplier.service";

@Controller("purchasing")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PurchasingController {
  constructor(
    private readonly suppliers: SupplierService,
    private readonly purchaseOrders: PurchaseOrderService,
    private readonly goodsReceipts: GoodsReceiptService,
  ) {}

  @Get("suppliers")
  @RequirePermission("purchases", "view")
  listSuppliers(@Query("q") q?: string): Promise<SupplierListResponse> {
    return this.suppliers.list(q);
  }

  @Post("suppliers")
  @RequirePermission("purchases", "create")
  createSupplier(@Body() body: CreateSupplierDto): Promise<Supplier> {
    return this.suppliers.create(body);
  }

  @Get("suppliers/:supplierId")
  @RequirePermission("purchases", "view")
  getSupplier(
    @Param("supplierId", ParseUUIDPipe) supplierId: string,
  ): Promise<Supplier> {
    return this.suppliers.get(supplierId);
  }

  @Patch("suppliers/:supplierId")
  @RequirePermission("purchases", "update")
  updateSupplier(
    @Param("supplierId", ParseUUIDPipe) supplierId: string,
    @Body() body: UpdateSupplierDto,
  ): Promise<Supplier> {
    return this.suppliers.update(supplierId, body);
  }

  @Get("purchase-orders")
  @RequirePermission("purchases", "view")
  listPurchaseOrders(): Promise<PurchaseOrderListResponse> {
    return this.purchaseOrders.list();
  }

  @Post("purchase-orders")
  @RequirePermission("purchases", "create")
  createPurchaseOrder(
    @Body() body: CreatePurchaseOrderDto,
    @CurrentUser() user: AuthUser,
  ): Promise<PurchaseOrderDetail> {
    return this.purchaseOrders.create(body, user.userId);
  }

  @Get("purchase-orders/:poId")
  @RequirePermission("purchases", "view")
  getPurchaseOrder(
    @Param("poId", ParseUUIDPipe) poId: string,
  ): Promise<PurchaseOrderDetail> {
    return this.purchaseOrders.get(poId);
  }

  @Patch("purchase-orders/:poId/lines")
  @RequirePermission("purchases", "update")
  savePurchaseOrderLines(
    @Param("poId", ParseUUIDPipe) poId: string,
    @Body() body: SavePurchaseOrderLinesDto,
  ): Promise<PurchaseOrderDetail> {
    return this.purchaseOrders.saveLines(poId, body);
  }

  @Post("purchase-orders/:poId/submit")
  @RequirePermission("purchases", "update")
  submitPurchaseOrder(
    @Param("poId", ParseUUIDPipe) poId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<PurchaseOrderDetail> {
    return this.purchaseOrders.submit(poId, user.userId);
  }

  @Post("purchase-orders/:poId/approve")
  @RequirePermission("purchases", "approve")
  approvePurchaseOrder(
    @Param("poId", ParseUUIDPipe) poId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<PurchaseOrderDetail> {
    return this.purchaseOrders.approve(poId, user.userId);
  }

  @Post("purchase-orders/:poId/cancel")
  @RequirePermission("purchases", "update")
  cancelPurchaseOrder(
    @Param("poId", ParseUUIDPipe) poId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<PurchaseOrderDetail> {
    return this.purchaseOrders.cancel(poId, user.userId);
  }

  @Post("purchase-orders/:poId/receipts")
  @RequirePermission("purchases", "update")
  receiveGoods(
    @Param("poId", ParseUUIDPipe) poId: string,
    @Body() body: ReceiveGoodsDto,
    @CurrentUser() user: AuthUser,
  ): Promise<PurchaseOrderDetail> {
    return this.goodsReceipts.receive(poId, body, user.userId);
  }

  @Patch("purchase-orders/:poId/invoice")
  @RequirePermission("purchases", "update")
  updateInvoice(
    @Param("poId", ParseUUIDPipe) poId: string,
    @Body() body: UpdatePoInvoiceDto,
  ): Promise<PurchaseOrderDetail> {
    return this.goodsReceipts.updateInvoice(poId, body);
  }
}
