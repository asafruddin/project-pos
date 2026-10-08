import { hasPermission } from "@pos-apps/types";
import { AppError } from "@/core/errors/app-error";
import type { QueueSettingsStore } from "@/features/queue/domain/queue-settings";
import type { AuthGateway, Credentials, SessionStore } from "./ports";
import type { Session } from "./session";

export class LoginUseCase {
  constructor(
    private readonly gateway: AuthGateway,
    private readonly sessions: SessionStore,
    private readonly queue?: QueueSettingsStore,
  ) {}

  async execute(credentials: Credentials): Promise<Session> {
    const login = credentials.login.trim();
    if (!login || !credentials.password) {
      throw new AppError("VALIDATION", "LOGIN_REQUIRED");
    }
    const session = await this.gateway.login({ login, password: credentials.password });
    // Only cashier accounts may use the till (same rule as the PWA login form).
    if (!hasPermission(session.permissions, "sales", "create")) {
      throw new AppError("VALIDATION", "NOT_CASHIER");
    }
    await this.sessions.save(session);
    this.queue?.save({ queue_reset_mode: session.queueResetMode, queue_reset_at: session.queueResetAt });
    return session;
  }
}

/** Validate the stored token against `/auth/me` and refresh the store identity. */
export class RefreshIdentityUseCase {
  constructor(
    private readonly gateway: AuthGateway,
    private readonly sessions: SessionStore,
    private readonly queue?: QueueSettingsStore,
  ) {}

  async execute(): Promise<void> {
    const me = await this.gateway.me();
    await this.sessions.patchIdentity({
      storeId: me.store_id,
      storeName: me.store_name,
      storeLogoUrl: me.store_logo_url,
      registerId: me.register_id,
    });
    this.queue?.save({ queue_reset_mode: me.queue_reset_mode, queue_reset_at: me.queue_reset_at });
  }
}
