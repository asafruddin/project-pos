import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import type { PlatformAuthUser } from "./platform-jwt.strategy";

export const CurrentPlatformUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): PlatformAuthUser => {
    const req = ctx.switchToHttp().getRequest<{ user?: PlatformAuthUser }>();
    if (!req.user) {
      throw new UnauthorizedException({
        code: "AUTH_UNAUTHORIZED",
        message: "Autentikasi diperlukan.",
      });
    }
    return req.user;
  },
);
