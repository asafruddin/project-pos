import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import type {
  PlatformAuthMeResponse,
  PlatformLoginResponse,
} from "@pos-apps/types";
import { LoginDto } from "../auth/dto/login.dto";
import { CurrentPlatformUser } from "./current-platform-user.decorator";
import { PlatformAuthService } from "./platform-auth.service";
import { PlatformJwtAuthGuard } from "./platform-jwt-auth.guard";
import type { PlatformAuthUser } from "./platform-jwt.strategy";

@Controller("platform/auth")
export class PlatformAuthController {
  constructor(private readonly auth: PlatformAuthService) {}

  @Post("login")
  login(@Body() body: LoginDto): Promise<PlatformLoginResponse> {
    return this.auth.login(body.login, body.password);
  }

  @Get("me")
  @UseGuards(PlatformJwtAuthGuard)
  me(
    @CurrentPlatformUser() user: PlatformAuthUser,
  ): Promise<PlatformAuthMeResponse> {
    return this.auth.me(user.userId);
  }
}
