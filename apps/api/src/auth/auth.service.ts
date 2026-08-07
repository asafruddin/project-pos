import {
  Injectable,
  UnauthorizedException,
  Logger,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { compare } from "bcryptjs";
import { eq } from "drizzle-orm";
import type { LoginResponse, Role } from "@pos-apps/types";
import { getDb } from "../db/client";
import { users } from "../db/schema";

export type JwtPayload = {
  sub: string;
  role: Role;
};

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
    if (!user) {
      this.logger.warn("login failed: unknown user");
      throw new UnauthorizedException({
        code: "AUTH_INVALID_CREDENTIALS",
        message: "Username atau password salah.",
      });
    }

    const ok = await compare(password, user.passwordHash);
    if (!ok) {
      this.logger.warn("login failed: bad password");
      throw new UnauthorizedException({
        code: "AUTH_INVALID_CREDENTIALS",
        message: "Username atau password salah.",
      });
    }

    const payload: JwtPayload = {
      sub: user.userId,
      role: user.role,
    };

    const access_token = await this.jwt.signAsync(payload);

    return {
      access_token,
      token_type: "Bearer",
      user_id: user.userId,
      role: user.role,
    };
  }

  async me(userId: string): Promise<{ user_id: string; role: Role }> {
    const db = getDb();
    const rows = await db
      .select()
      .from(users)
      .where(eq(users.userId, userId))
      .limit(1);
    const user = rows[0];
    if (!user) {
      throw new UnauthorizedException({
        code: "AUTH_INVALID_TOKEN",
        message: "Sesi tidak valid.",
      });
    }
    return { user_id: user.userId, role: user.role };
  }
}
