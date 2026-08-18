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
import type { UnitListResponse, UnitRecord } from "@pos-apps/types";
import { STORE_1_ID } from "@pos-apps/types";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type { AuthUser } from "../auth/jwt.strategy";
import { RequirePermission } from "../auth/permission.decorator";
import { PermissionsGuard } from "../auth/permissions.guard";
import { CreateUnitDto } from "./dto/create-unit.dto";
import { UpdateUnitDto } from "./dto/update-unit.dto";
import { UnitsService } from "./units.service";

@Controller("catalog/units")
@UseGuards(JwtAuthGuard)
export class UnitsController {
  constructor(private readonly units: UnitsService) {}

  private storeId(user: AuthUser): string {
    return user.storeId ?? STORE_1_ID;
  }

  @Get()
  @RequirePermission("products", "view")
  @UseGuards(PermissionsGuard)
  list(@CurrentUser() user: AuthUser): Promise<UnitListResponse> {
    return this.units.list(this.storeId(user));
  }

  @Post()
  @RequirePermission("products", "create")
  @UseGuards(PermissionsGuard)
  create(
    @Body() body: CreateUnitDto,
    @CurrentUser() user: AuthUser,
  ): Promise<UnitRecord> {
    return this.units.create(this.storeId(user), body);
  }

  @Patch(":unitId")
  @RequirePermission("products", "update")
  @UseGuards(PermissionsGuard)
  update(
    @Param("unitId", ParseUUIDPipe) unitId: string,
    @Body() body: UpdateUnitDto,
    @CurrentUser() user: AuthUser,
  ): Promise<UnitRecord> {
    return this.units.update(this.storeId(user), unitId, body);
  }

  @Delete(":unitId")
  @RequirePermission("products", "update")
  @UseGuards(PermissionsGuard)
  remove(
    @Param("unitId", ParseUUIDPipe) unitId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<{ deleted: true }> {
    return this.units.remove(this.storeId(user), unitId);
  }
}
