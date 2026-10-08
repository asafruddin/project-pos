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
import type { VariantGroupListResponse, VariantGroupRecord } from "@pos-apps/types";
import { STORE_1_ID } from "@pos-apps/types";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type { AuthUser } from "../auth/jwt.strategy";
import { RequirePermission } from "../auth/permission.decorator";
import { PermissionsGuard } from "../auth/permissions.guard";
import { VariantsService } from "./variants.service";
import { CreateVariantGroupDto } from "./dto/create-variant-group.dto";
import { UpdateVariantGroupDto } from "./dto/update-variant-group.dto";

@Controller("catalog/variants")
@UseGuards(JwtAuthGuard)
export class VariantsController {
  constructor(private readonly variants: VariantsService) {}

  private storeId(user: AuthUser): string {
    return user.storeId ?? STORE_1_ID;
  }

  @Get()
  @RequirePermission("products", "view")
  @UseGuards(PermissionsGuard)
  list(@CurrentUser() user: AuthUser): Promise<VariantGroupListResponse> {
    return this.variants.list(this.storeId(user));
  }

  @Post()
  @RequirePermission("products", "create")
  @UseGuards(PermissionsGuard)
  create(
    @Body() body: CreateVariantGroupDto,
    @CurrentUser() user: AuthUser,
  ): Promise<VariantGroupRecord> {
    return this.variants.create(this.storeId(user), body);
  }

  @Patch(":variantGroupId")
  @RequirePermission("products", "update")
  @UseGuards(PermissionsGuard)
  update(
    @Param("variantGroupId", ParseUUIDPipe) variantGroupId: string,
    @Body() body: UpdateVariantGroupDto,
    @CurrentUser() user: AuthUser,
  ): Promise<VariantGroupRecord> {
    return this.variants.update(this.storeId(user), variantGroupId, body);
  }

  @Delete(":variantGroupId")
  @RequirePermission("products", "update")
  @UseGuards(PermissionsGuard)
  remove(
    @Param("variantGroupId", ParseUUIDPipe) variantGroupId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<{ deleted: true }> {
    return this.variants.remove(this.storeId(user), variantGroupId);
  }
}
