import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import type {
  CreateReturnRequest,
  LinkExchangeSaleRequest,
  RefundReturnRequest,
  ReturnDetail,
  ReturnListResponse,
  SaleLookupResponse,
  SalesListResponse,
  SyncSaleRequest,
  SyncSaleResponse,
  SyncVoidRequest,
  SyncVoidResponse,
} from "@pos-apps/types";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type { AuthUser } from "../auth/jwt.strategy";
import { RequirePermission } from "../auth/permission.decorator";
import { PermissionsGuard } from "../auth/permissions.guard";
import { ReturnsService } from "./returns.service";
import { SalesService } from "./sales.service";

@Controller("sales")
@UseGuards(JwtAuthGuard)
export class SalesController {
  constructor(
    private readonly sales: SalesService,
    private readonly returns: ReturnsService,
  ) {}

  @Get()
  list(): Promise<SalesListResponse> {
    return this.sales.listToday();
  }

  @Get("returns")
  listOpenReturns(): Promise<ReturnListResponse> {
    return this.returns.listOpen();
  }

  @Get(":saleId")
  lookup(
    @Param("saleId", ParseUUIDPipe) saleId: string,
  ): Promise<SaleLookupResponse> {
    return this.returns.lookup(saleId);
  }

  @Post("sync")
  @RequirePermission("sales", "create")
  @UseGuards(PermissionsGuard)
  sync(
    @CurrentUser() user: AuthUser,
    @Body() sale: SyncSaleRequest,
  ): Promise<SyncSaleResponse> {
    return this.sales.acceptSync(sale, user.userId, user.storeId);
  }

  @Post("void")
  @RequirePermission("sales", "void")
  @UseGuards(PermissionsGuard)
  voidSale(
    @CurrentUser() user: AuthUser,
    @Body() body: SyncVoidRequest,
  ): Promise<SyncVoidResponse> {
    return this.sales.acceptVoid(body, user.userId);
  }

  @Post(":saleId/returns")
  @RequirePermission("returns", "create")
  @UseGuards(PermissionsGuard)
  createReturn(
    @CurrentUser() user: AuthUser,
    @Param("saleId", ParseUUIDPipe) saleId: string,
    @Body() body: CreateReturnRequest,
  ): Promise<ReturnDetail> {
    return this.returns.create(saleId, body, user.userId);
  }

  @Post("returns/:returnId/refund")
  @RequirePermission("returns", "approve")
  @UseGuards(PermissionsGuard)
  refund(
    @CurrentUser() user: AuthUser,
    @Param("returnId", ParseUUIDPipe) returnId: string,
    @Body() body: RefundReturnRequest,
  ): Promise<ReturnDetail> {
    return this.returns.refund(returnId, body, user.userId);
  }

  @Patch("returns/:returnId/exchange")
  @RequirePermission("returns", "update")
  @UseGuards(PermissionsGuard)
  linkExchange(
    @Param("returnId", ParseUUIDPipe) returnId: string,
    @Body() body: LinkExchangeSaleRequest,
  ): Promise<ReturnDetail> {
    return this.returns.linkExchange(returnId, body);
  }
}
