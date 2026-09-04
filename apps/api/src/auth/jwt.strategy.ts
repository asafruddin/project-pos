import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import type { Role } from "@pos-apps/types";
import { isPlatformJwtAudience, isStoreJwtAudience } from "@pos-apps/types";
import { eq } from "drizzle-orm";
import { getDb } from "../db/client";
import { users } from "../db/schema";
import type { JwtPayload } from "./auth.service";
import { loadRolePermissions } from "./load-permissions";
import { isRole } from "./roles";

export type AuthUser = {
  userId: string;
  role: Role;
  permissions?: string[];
  storeId?: string;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>("JWT_SECRET"),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    if (!payload?.sub || typeof payload.sub !== "string" || !payload.sub.trim()) {
      throw new UnauthorizedException({
        code: "AUTH_INVALID_TOKEN",
        message: "Sesi tidak valid.",
      });
    }

    if (isPlatformJwtAudience(payload.aud) || !isStoreJwtAudience(payload.aud)) {
      throw new UnauthorizedException({
        code: "AUTH_INVALID_TOKEN",
        message: "Sesi tidak valid.",
      });
    }

    const db = getDb();
    const rows = await db
      .select()
      .from(users)
      .where(eq(users.userId, payload.sub))
      .limit(1);
    const user = rows[0];
    if (!user || !user.active || !isRole(user.role)) {
      throw new UnauthorizedException({
        code: "AUTH_INVALID_TOKEN",
        message: "Sesi tidak valid.",
      });
    }

    const permissions = await loadRolePermissions(user.role);

    return {
      userId: user.userId,
      role: user.role,
      permissions,
      storeId: user.storeId,
    };
  }
}
