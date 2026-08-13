import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";
import type {
  RolePermissionsResponse,
  UserAccount,
  UserListResponse,
} from "@pos-apps/types";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type { AuthUser } from "../auth/jwt.strategy";
import { RequirePermission } from "../auth/permission.decorator";
import { PermissionsGuard } from "../auth/permissions.guard";
import {
  CreateUserDto,
  ReplaceRolePermissionsDto,
  UpdateUserDto,
} from "./dto/user.dto";
import { UsersService } from "./users.service";

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get("users")
  @RequirePermission("users", "view")
  list(@CurrentUser() actor: AuthUser): Promise<UserListResponse> {
    return this.users.list(actor);
  }

  @Post("users")
  @RequirePermission("users", "create")
  create(
    @CurrentUser() actor: AuthUser,
    @Body() body: CreateUserDto,
  ): Promise<UserAccount> {
    return this.users.create(body, actor);
  }

  @Patch("users/:userId")
  @RequirePermission("users", "update")
  update(
    @CurrentUser() actor: AuthUser,
    @Param("userId", ParseUUIDPipe) userId: string,
    @Body() body: UpdateUserDto,
  ): Promise<UserAccount> {
    return this.users.update(userId, body, actor);
  }

  @Get("rbac/roles")
  @RequirePermission("users", "view")
  listRoles(@CurrentUser() actor: AuthUser): Promise<RolePermissionsResponse> {
    return this.users.listRoles(actor);
  }

  @Put("rbac/roles/:role")
  @RequirePermission("rbac", "update")
  replacePermissions(
    @CurrentUser() actor: AuthUser,
    @Param("role") role: string,
    @Body() body: ReplaceRolePermissionsDto,
  ): Promise<RolePermissionsResponse> {
    return this.users.replacePermissions(role, body.permissions, actor);
  }
}
