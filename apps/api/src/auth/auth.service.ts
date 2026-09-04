import {
  Injectable,
  UnauthorizedException,
  Logger,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { compare } from "bcryptjs";
import { eq } from "drizzle-orm";
import type { AuthMeResponse, LoginResponse } from "@pos-apps/types";
import { JWT_AUD_STORE, STORE_1_ID } from "@pos-apps/types";
import { getDb } from "../db/client";
import { users } from "../db/schema";
import { loadRolePermissions } from "./load-permissions";
import { isRole } from "./roles";

export type JwtPayload = {
  sub: string;
  role: string;
  aud?: "store" | "platform";
};

/** Precomputed bcrypt hash so unknown-user path still runs compare (timing). */
const DUMMY_PASSWORD_HASH =
  "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private readonly jwt: JwtService) {}

  async login(login: string, password: string): Promise<LoginResponse> {
    const db = getDb();
    const rows = await db
      .select()
      .from(users)
      .where(eq(users.username, login.trim()))
      .limit(1);

    const user = rows[0];
    const hashToCompare = user?.passwordHash ?? DUMMY_PASSWORD_HASH;

    let ok = false;
    try {
      ok = await compare(password, hashToCompare);
    } catch {
      ok = false;
    }

    if (!user || !user.active || !ok || !isRole(user.role)) {
      this.logger.warn("login failed");
      throw new UnauthorizedException({
        code: "AUTH_INVALID_CREDENTIALS",
        message: "Username atau password salah.",
      });
    }

    const payload: JwtPayload = {
      sub: user.userId,
      role: user.role,
      aud: JWT_AUD_STORE,
    };

    const access_token = await this.jwt.signAsync(payload);
    const permissions = await loadRolePermissions(user.role);

    return {
      access_token,
      token_type: "Bearer",
      user_id: user.userId,
      role: user.role,
      permissions,
      store_id: user.storeId ?? STORE_1_ID,
    };
  }

  async me(userId: string): Promise<AuthMeResponse> {
    const db = getDb();
    const rows = await db
      .select()
      .from(users)
      .where(eq(users.userId, userId))
      .limit(1);
    const user = rows[0];
    if (!user || !user.active || !isRole(user.role)) {
      throw new UnauthorizedException({
        code: "AUTH_INVALID_TOKEN",
        message: "Sesi tidak valid.",
      });
    }
    return {
      user_id: user.userId,
      role: user.role,
      permissions: await loadRolePermissions(user.role),
      store_id: user.storeId ?? STORE_1_ID,
      active: user.active,
    };
  }
}
