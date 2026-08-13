import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";
import type {
  RegisterRecord,
  StockTransfer,
  StockTransferListResponse,
  StoreListResponse,
  StorePrice,
  StoreRecord,
} from "@pos-apps/types";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type { AuthUser } from "../auth/jwt.strategy";
import { RequirePermission } from "../auth/permission.decorator";
import { PermissionsGuard } from "../auth/permissions.guard";
import {
  CreateRegisterDto,
  CreateStockTransferDto,
  CreateStoreDto,
  SetStorePriceDto,
  TransitionStockTransferDto,
} from "./dto/stores.dto";
import { StoresService } from "./stores.service";
import { TransferService } from "./transfer.service";

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class StoresController {
  constructor(
    private readonly stores: StoresService,
    private readonly transfers: TransferService,
  ) {}

  @Get("stores")
  @RequirePermission("stores", "view")
  list(): Promise<StoreListResponse> {
    return this.stores.list();
  }

  @Post("stores")
  @RequirePermission("stores", "update")
  createStore(@Body() body: CreateStoreDto): Promise<StoreRecord> {
    return this.stores.createStore(body);
  }

  @Post("registers")
  @RequirePermission("stores", "update")
  createRegister(@Body() body: CreateRegisterDto): Promise<RegisterRecord> {
    return this.stores.createRegister(body);
  }

  @Put("stores/prices")
  @RequirePermission("stores", "update")
  setPrice(
    @Body() body: SetStorePriceDto,
  ): Promise<StorePrice> {
    return this.stores.setPrice({
      ...body,
      price_minor: body.price_minor ?? null,
    });
  }

  @Get("transfers")
  @RequirePermission("transfers", "view")
  listTransfers(): Promise<StockTransferListResponse> {
    return this.transfers.list();
  }

  @Post("transfers")
  @RequirePermission("transfers", "create")
  createTransfer(
    @CurrentUser() user: AuthUser,
    @Body() body: CreateStockTransferDto,
  ): Promise<StockTransfer> {
    return this.transfers.create(body, user.userId);
  }

  @Post("transfers/:transferId/status")
  @RequirePermission("transfers", "update")
  transition(
    @CurrentUser() user: AuthUser,
    @Param("transferId", ParseUUIDPipe) transferId: string,
    @Body() body: TransitionStockTransferDto,
  ): Promise<StockTransfer> {
    return this.transfers.transition(transferId, body.status, user);
  }
}
