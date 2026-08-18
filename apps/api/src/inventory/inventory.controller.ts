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
  OpnameDetail,
  OpnameListResponse,
  StockOverviewItem,
  StockOverviewResponse,
  UnpackUnitResponse,
} from "@pos-apps/types";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type { AuthUser } from "../auth/jwt.strategy";
import { RequirePermission } from "../auth/permission.decorator";
import { PermissionsGuard } from "../auth/permissions.guard";
import { CreateOpnameDto } from "./dto/create-opname.dto";
import { MarkDamagedDto } from "./dto/mark-damaged.dto";
import { SaveOpnameCountsDto } from "./dto/save-opname-counts.dto";
import { UnpackUnitDto } from "./dto/unpack-unit.dto";
import { InventoryService } from "./inventory.service";
import { OpnameService } from "./opname.service";

@Controller("inventory")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class InventoryController {
  constructor(
    private readonly inventory: InventoryService,
    private readonly opnames: OpnameService,
  ) {}

  @Get("overview")
  @RequirePermission("inventory", "view")
  overview(@Query("store_id") storeId?: string): Promise<StockOverviewResponse> {
    return this.inventory.overview(storeId);
  }

  @Post("products/:productId/unpack")
  @RequirePermission("inventory", "unpack")
  unpack(
    @Param("productId", ParseUUIDPipe) productId: string,
    @Body() body: UnpackUnitDto,
    @CurrentUser() user: AuthUser,
    @Query("store_id") storeId?: string,
  ): Promise<UnpackUnitResponse> {
    return this.inventory.unpack(
      productId,
      body ?? {},
      user.userId,
      storeId || user.storeId,
    );
  }

  @Post("products/:productId/damaged")
  @RequirePermission("inventory", "update")
  markDamaged(
    @Param("productId", ParseUUIDPipe) productId: string,
    @Body() body: MarkDamagedDto,
    @CurrentUser() user: AuthUser,
    @Query("store_id") storeId?: string,
  ): Promise<StockOverviewItem> {
    return this.inventory.markDamaged(productId, body, user.userId, storeId);
  }

  @Get("opnames")
  @RequirePermission("inventory", "view")
  listOpnames(): Promise<OpnameListResponse> {
    return this.opnames.list();
  }

  @Post("opnames")
  @RequirePermission("inventory", "create")
  createOpname(
    @Body() body: CreateOpnameDto,
    @CurrentUser() user: AuthUser,
  ): Promise<OpnameDetail> {
    return this.opnames.create(body, user.userId);
  }

  @Get("opnames/:opnameId")
  @RequirePermission("inventory", "view")
  getOpname(
    @Param("opnameId", ParseUUIDPipe) opnameId: string,
  ): Promise<OpnameDetail> {
    return this.opnames.get(opnameId);
  }

  @Patch("opnames/:opnameId/counts")
  @RequirePermission("inventory", "update")
  saveOpnameCounts(
    @Param("opnameId", ParseUUIDPipe) opnameId: string,
    @Body() body: SaveOpnameCountsDto,
  ): Promise<OpnameDetail> {
    return this.opnames.saveCounts(opnameId, body);
  }

  @Post("opnames/:opnameId/approve")
  @RequirePermission("inventory", "approve")
  approveOpname(
    @Param("opnameId", ParseUUIDPipe) opnameId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<OpnameDetail> {
    return this.opnames.approve(opnameId, user.userId);
  }

  @Post("opnames/:opnameId/reject")
  @RequirePermission("inventory", "approve")
  rejectOpname(
    @Param("opnameId", ParseUUIDPipe) opnameId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<OpnameDetail> {
    return this.opnames.reject(opnameId, user.userId);
  }

  @Post("opnames/:opnameId/cancel")
  @RequirePermission("inventory", "approve")
  cancelOpname(
    @Param("opnameId", ParseUUIDPipe) opnameId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<OpnameDetail> {
    return this.opnames.cancel(opnameId, user.userId);
  }
}
