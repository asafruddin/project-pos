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
  PlatformOperator,
  PlatformOperatorListResponse,
  StoreListResponse,
  UserAccount,
  UserListResponse,
} from "@pos-apps/types";
import { CurrentPlatformUser } from "./current-platform-user.decorator";
import {
  CreatePlatformAccountDto,
  CreatePlatformOperatorDto,
  UpdatePlatformAccountDto,
  UpdatePlatformOperatorDto,
} from "./dto/platform.dto";
import { PlatformJwtAuthGuard } from "./platform-jwt-auth.guard";
import type { PlatformAuthUser } from "./platform-jwt.strategy";
import { PlatformService } from "./platform.service";

@Controller("platform")
@UseGuards(PlatformJwtAuthGuard)
export class PlatformController {
  constructor(private readonly platform: PlatformService) {}

  @Get("operators")
  listOperators(): Promise<PlatformOperatorListResponse> {
    return this.platform.listOperators();
  }

  @Post("operators")
  createOperator(
    @Body() body: CreatePlatformOperatorDto,
  ): Promise<PlatformOperator> {
    return this.platform.createOperator(body);
  }

  @Patch("operators/:id")
  updateOperator(
    @CurrentPlatformUser() actor: PlatformAuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: UpdatePlatformOperatorDto,
  ): Promise<PlatformOperator> {
    return this.platform.updateOperator(id, body, actor);
  }

  @Get("accounts")
  listAccounts(): Promise<UserListResponse> {
    return this.platform.listAccounts();
  }

  @Post("accounts")
  createAccount(@Body() body: CreatePlatformAccountDto): Promise<UserAccount> {
    return this.platform.createAccount(body);
  }

  @Patch("accounts/:userId")
  updateAccount(
    @Param("userId", ParseUUIDPipe) userId: string,
    @Body() body: UpdatePlatformAccountDto,
  ): Promise<UserAccount> {
    return this.platform.updateAccount(userId, body);
  }

  @Get("stores")
  listStores(): Promise<StoreListResponse> {
    return this.platform.listStores();
  }
}
