import {
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

type JwtInfo = { name?: string; message?: string } | string | undefined;

@Injectable()
export class PlatformJwtAuthGuard extends AuthGuard("platform-jwt") {
  handleRequest<TUser>(err: Error | null, user: TUser, info: JwtInfo): TUser {
    if (err || !user) {
      if (err instanceof UnauthorizedException) {
        throw err;
      }
      const infoName =
        typeof info === "object" && info !== null ? info.name : undefined;
      const invalid =
        infoName === "JsonWebTokenError" ||
        infoName === "TokenExpiredError" ||
        infoName === "NotBeforeError";
      throw new UnauthorizedException({
        code: invalid ? "AUTH_INVALID_TOKEN" : "AUTH_UNAUTHORIZED",
        message: invalid
          ? "Sesi tidak valid atau sudah berakhir."
          : "Autentikasi diperlukan.",
      });
    }
    return user;
  }
}
