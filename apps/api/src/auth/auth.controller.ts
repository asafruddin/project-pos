import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import type { AuthMeResponse, LoginResponse } from "@pos-apps/types";
import { AuthService } from "./auth.service";
import { CurrentUser } from "./current-user.decorator";
import { LoginDto } from "./dto/login.dto";
import { JwtAuthGuard } from "./jwt-auth.guard";
import type { AuthUser } from "./jwt.strategy";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("login")
  login(@Body() body: LoginDto): Promise<LoginResponse> {
    return this.auth.login(body.login, body.password);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthUser): Promise<AuthMeResponse> {
    return this.auth.me(user.userId);
  }
}
