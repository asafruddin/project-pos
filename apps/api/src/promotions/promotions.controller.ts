import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import type { Promotion, Voucher } from "@pos-apps/types";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type { AuthUser } from "../auth/jwt.strategy";
import { RequirePermission } from "../auth/permission.decorator";
import { PermissionsGuard } from "../auth/permissions.guard";
import { UpsertPromotionDto, UpsertVoucherDto } from "./dto/promotion.dto";
import { PromotionsService } from "./promotions.service";

@Controller("promotions")
@UseGuards(JwtAuthGuard)
export class PromotionsController {
  constructor(private readonly promotions: PromotionsService) {}

  @Get()
  list(): Promise<{ promotions: Promotion[] }> {
    return this.promotions.list();
  }

  @Post()
  @RequirePermission("promotions", "create")
  @UseGuards(PermissionsGuard)
  create(
    @Body() body: UpsertPromotionDto,
    @CurrentUser() user: AuthUser,
  ): Promise<Promotion> {
    return this.promotions.upsert(body, user);
  }

  @Patch(":promotionId")
  @RequirePermission("promotions", "update")
  @UseGuards(PermissionsGuard)
  update(
    @Param("promotionId", ParseUUIDPipe) promotionId: string,
    @Body() body: UpsertPromotionDto,
    @CurrentUser() user: AuthUser,
  ): Promise<Promotion> {
    return this.promotions.upsert(body, user, promotionId);
  }

  @Delete(":promotionId")
  @RequirePermission("promotions", "delete")
  @UseGuards(PermissionsGuard)
  remove(
    @Param("promotionId", ParseUUIDPipe) promotionId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    return this.promotions.remove(promotionId, user);
  }
}

@Controller("vouchers")
@UseGuards(JwtAuthGuard)
export class VouchersController {
  constructor(private readonly promotions: PromotionsService) {}

  @Get()
  @RequirePermission("promotions", "view")
  @UseGuards(PermissionsGuard)
  list(@CurrentUser() user: AuthUser): Promise<{ vouchers: Voucher[] }> {
    return this.promotions.listVouchers(user);
  }

  @Get("code/:code")
  lookup(@Param("code") code: string): Promise<Voucher> {
    return this.promotions.lookupVoucher(code);
  }

  @Post()
  @RequirePermission("promotions", "create")
  @UseGuards(PermissionsGuard)
  create(
    @Body() body: UpsertVoucherDto,
    @CurrentUser() user: AuthUser,
  ): Promise<Voucher> {
    return this.promotions.upsertVoucher(body, user);
  }

  @Patch(":voucherId")
  @RequirePermission("promotions", "update")
  @UseGuards(PermissionsGuard)
  update(
    @Param("voucherId", ParseUUIDPipe) voucherId: string,
    @Body() body: UpsertVoucherDto,
    @CurrentUser() user: AuthUser,
  ): Promise<Voucher> {
    return this.promotions.upsertVoucher(body, user, voucherId);
  }
}
