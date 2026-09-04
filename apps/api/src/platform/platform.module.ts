import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PlatformAuthController } from "./platform-auth.controller";
import { PlatformAuthService } from "./platform-auth.service";
import { PlatformJwtAuthGuard } from "./platform-jwt-auth.guard";
import { PlatformJwtStrategy } from "./platform-jwt.strategy";
import { PlatformController } from "./platform.controller";
import { PlatformService } from "./platform.service";

@Module({
  imports: [AuthModule],
  controllers: [PlatformAuthController, PlatformController],
  providers: [
    PlatformAuthService,
    PlatformService,
    PlatformJwtStrategy,
    PlatformJwtAuthGuard,
  ],
})
export class PlatformModule {}
