import {
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { compare } from "bcryptjs";
import { eq } from "drizzle-orm";
import type { PlatformAuthMeResponse, PlatformLoginResponse } from "@pos-apps/types";
import { JWT_AUD_PLATFORM, isPlatformRole } from "@pos-apps/types";
import { getDb } from "../db/client";
import { platformUsers } from "../db/schema";
import type { JwtPayload } from "../auth/auth.service";

/** Precomputed bcrypt hash so unknown-user path still runs compare (timing). */
const DUMMY_PASSWORD_HASH =
  "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

@Injectable()
export class PlatformAuthService {
  private readonly logger = new Logger(PlatformAuthService.name);

  constructor(private readonly jwt: JwtService) {}

  async login(login: string, password: string): Promise<PlatformLoginResponse> {
    const db = getDb();
    const rows = await db
      .select()
      .from(platformUsers)
      .where(eq(platformUsers.username, login.trim()))
      .limit(1);

    const user = rows[0];
    const hashToCompare = user?.passwordHash ?? DUMMY_PASSWORD_HASH;

    let ok = false;
    try {
      ok = await compare(password, hashToCompare);
    } catch {
      ok = false;
    }

    if (!user || !user.active || !ok || !isPlatformRole(user.role)) {
      this.logger.warn("platform login failed");
      throw new UnauthorizedException({
        code: "AUTH_INVALID_CREDENTIALS",
        message: "Username atau password salah.",
      });
    }

    const payload: JwtPayload = {
      sub: user.platformUserId,
      role: user.role,
      aud: JWT_AUD_PLATFORM,
    };

    const access_token = await this.jwt.signAsync(payload);

    return {
      access_token,
      token_type: "Bearer",
      user_id: user.platformUserId,
      role: user.role,
    };
  }

  async me(userId: string): Promise<PlatformAuthMeResponse> {
    const db = getDb();
    const rows = await db
      .select()
      .from(platformUsers)
      .where(eq(platformUsers.platformUserId, userId))
      .limit(1);
    const user = rows[0];
    if (!user || !user.active || !isPlatformRole(user.role)) {
      throw new UnauthorizedException({
        code: "AUTH_INVALID_TOKEN",
        message: "Sesi tidak valid.",
      });
    }
    return {
      user_id: user.platformUserId,
      role: user.role,
      active: user.active,
    };
  }
}
