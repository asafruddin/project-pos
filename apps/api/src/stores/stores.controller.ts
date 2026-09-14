import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type {
  RegisterRecord,
  StockTransfer,
  StockTransferListResponse,
  StoreListResponse,
  StorePrice,
  StoreRecord,
} from "@pos-apps/types";
import { assertPermission } from "../auth/assert-permission";
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
  UpdateStoreDto,
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

  @Get("stores/:storeId")
  @RequirePermission("stores", "view")
  getStore(
    @Param("storeId", ParseUUIDPipe) storeId: string,
  ): Promise<StoreRecord> {
    return this.stores.getById(storeId);
  }

  @Post("stores")
  @RequirePermission("stores", "update")
  createStore(@Body() body: CreateStoreDto): Promise<StoreRecord> {
    return this.stores.createStore(body);
  }

  @Patch("stores/:storeId")
  @RequirePermission("stores", "update")
  updateStore(
    @Param("storeId", ParseUUIDPipe) storeId: string,
    @Body() body: UpdateStoreDto,
  ): Promise<StoreRecord> {
    return this.stores.updateStore(storeId, body);
  }

  @Post("stores/:storeId/logo")
  @RequirePermission("stores", "update")
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: 8 * 1024 * 1024 } }),
  )
  uploadLogo(
    @Param("storeId", ParseUUIDPipe) storeId: string,
    @UploadedFile() file: { buffer: Buffer; mimetype: string; size: number },
  ): Promise<StoreRecord> {
    return this.stores.setLogo(storeId, file);
  }

  @Get("stores/:storeId/logo/file")
  @Header("Cache-Control", "private, max-age=60")
  async logoFile(
    @Param("storeId", ParseUUIDPipe) storeId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<StreamableFile> {
    if (user.storeId !== storeId) {
      assertPermission(user, "stores", "view");
    }
    const file = await this.stores.getLogoFile(storeId);
    return new StreamableFile(file.bytes, {
      type: file.mimeType,
      disposition: "inline",
    });
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
