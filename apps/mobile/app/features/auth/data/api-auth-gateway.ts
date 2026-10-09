import type { AuthMeResponse, LoginResponse } from "@pos-apps/types";
import type { HttpClient } from "@/core/ports/http";
import type { AuthGateway, Credentials } from "../domain/ports";
import type { Session } from "../domain/session";

export class ApiAuthGateway implements AuthGateway {
  constructor(private readonly http: HttpClient) {}

  async login(credentials: Credentials): Promise<Session> {
    const res = await this.http.request<LoginResponse>({
      method: "POST",
      path: "/auth/login",
      body: credentials,
      skipAuth: true,
    });
    if (typeof res.access_token !== "string" || !res.access_token || typeof res.user_id !== "string" || !res.user_id) {
      throw new Error("INVALID_LOGIN_RESPONSE");
    }
    return {
      accessToken: res.access_token,
      userId: res.user_id,
      role: res.role,
      permissions: res.permissions ?? [],
      storeId: res.store_id,
      storeName: res.store_name,
      storeLogoUrl: res.store_logo_url ?? null,
      registerId: res.register_id ?? null,
      queueResetMode: res.queue_reset_mode,
      queueResetAt: res.queue_reset_at ?? null,
      managerPin: res.manager_pin ?? null,
    };
  }

  me(): Promise<AuthMeResponse> {
    return this.http.request<AuthMeResponse>({ method: "GET", path: "/auth/me" });
  }
}
