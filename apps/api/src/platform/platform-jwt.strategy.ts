import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import type { PlatformRole } from "@pos-apps/types";
import { isPlatformJwtAudience, isPlatformRole } from "@pos-apps/types";
import { eq } from "drizzle-orm";
import { getDb } from "../db/client";
import { platformUsers } from "../db/schema";
import type { JwtPayload } from "../auth/auth.service";

export type PlatformAuthUser = {
  userId: string;
  role: PlatformRole;
};

@Injectable()
export class PlatformJwtStrategy extends PassportStrategy(
  Strategy,
  "platform-jwt",
) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>("JWT_SECRET"),
    });
  }

  async validate(payload: JwtPayload): Promise<PlatformAuthUser> {
    if (!payload?.sub || typeof payload.sub !== "string" || !payload.sub.trim()) {
      throw new UnauthorizedException({
        code: "AUTH_INVALID_TOKEN",
        message: "Sesi tidak valid.",
      });
    }

    if (!isPlatformJwtAudience(payload.aud)) {
      throw new UnauthorizedException({
        code: "AUTH_INVALID_TOKEN",
        message: "Sesi tidak valid.",
      });
    }

    const db = getDb();
    const rows = await db
      .select()
      .from(platformUsers)
      .where(eq(platformUsers.platformUserId, payload.sub))
      .limit(1);
    const user = rows[0];
    if (!user || !user.active || !isPlatformRole(user.role)) {
      throw new UnauthorizedException({
        code: "AUTH_INVALID_TOKEN",
        message: "Sesi tidak valid.",
      });
    }

    return {
      userId: user.platformUserId,
      role: user.role,
    };
  }
}
