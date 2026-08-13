import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
} from "@nestjs/common";
import type { LoyaltyAccount, LoyaltyProgram } from "@pos-apps/types";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type { AuthUser } from "../auth/jwt.strategy";
import { RequirePermission } from "../auth/permission.decorator";
import { PermissionsGuard } from "../auth/permissions.guard";
import { UpdateLoyaltyProgramDto } from "./dto/loyalty.dto";
import { LoyaltyService } from "./loyalty.service";

@Controller("loyalty")
@UseGuards(JwtAuthGuard)
export class LoyaltyController {
  constructor(private readonly loyalty: LoyaltyService) {}

  @Get("program")
  getProgram(): Promise<LoyaltyProgram> {
    return this.loyalty.getProgram();
  }

  @Patch("program")
  @RequirePermission("loyalty", "update")
  @UseGuards(PermissionsGuard)
  updateProgram(
    @Body() body: UpdateLoyaltyProgramDto,
    @CurrentUser() user: AuthUser,
  ): Promise<LoyaltyProgram> {
    return this.loyalty.updateProgram(body, user);
  }

  @Get("accounts/:customerId")
  getAccount(
    @Param("customerId", ParseUUIDPipe) customerId: string,
  ): Promise<LoyaltyAccount> {
    return this.loyalty.getAccount(customerId);
  }
}
