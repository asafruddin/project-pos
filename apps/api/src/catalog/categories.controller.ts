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
import type { CategoryListResponse, CategoryRecord } from "@pos-apps/types";
import { STORE_1_ID } from "@pos-apps/types";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type { AuthUser } from "../auth/jwt.strategy";
import { RequirePermission } from "../auth/permission.decorator";
import { PermissionsGuard } from "../auth/permissions.guard";
import { CategoriesService } from "./categories.service";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { UpdateCategoryDto } from "./dto/update-category.dto";

@Controller("catalog/categories")
@UseGuards(JwtAuthGuard)
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  private storeId(user: AuthUser): string {
    return user.storeId ?? STORE_1_ID;
  }

  @Get()
  @RequirePermission("products", "view")
  @UseGuards(PermissionsGuard)
  list(@CurrentUser() user: AuthUser): Promise<CategoryListResponse> {
    return this.categories.list(this.storeId(user));
  }

  @Post()
  @RequirePermission("products", "create")
  @UseGuards(PermissionsGuard)
  create(
    @Body() body: CreateCategoryDto,
    @CurrentUser() user: AuthUser,
  ): Promise<CategoryRecord> {
    return this.categories.create(this.storeId(user), body);
  }

  @Patch(":categoryId")
  @RequirePermission("products", "update")
  @UseGuards(PermissionsGuard)
  update(
    @Param("categoryId", ParseUUIDPipe) categoryId: string,
    @Body() body: UpdateCategoryDto,
    @CurrentUser() user: AuthUser,
  ): Promise<CategoryRecord> {
    return this.categories.update(this.storeId(user), categoryId, body);
  }

  @Delete(":categoryId")
  @RequirePermission("products", "update")
  @UseGuards(PermissionsGuard)
  remove(
    @Param("categoryId", ParseUUIDPipe) categoryId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<{ deleted: true }> {
    return this.categories.remove(this.storeId(user), categoryId);
  }
}
