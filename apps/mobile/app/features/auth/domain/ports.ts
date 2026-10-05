import type { AuthMeResponse } from "@pos-apps/types";
import type { Session, StoreIdentity } from "./session";

export type Credentials = { login: string; password: string };

export interface AuthGateway {
  /** Throws `AppError` (NETWORK, API 4xx, ...). Login needs the network. */
  login(credentials: Credentials): Promise<Session>;
  /** Validate the token and refresh store identity. */
  me(): Promise<AuthMeResponse>;
}

export interface SessionStore {
  /** Load the persisted session into memory (call once at boot). */
  hydrate(): Promise<Session | null>;
  /** Sync accessor so the HTTP client can read the token on every request. */
  current(): Session | null;
  /** True after an account login until day close / sign-out. Survives token expiry. */
  shiftAuthorized(): boolean;
  save(session: Session): Promise<void>;
  patchIdentity(identity: StoreIdentity): Promise<void>;
  /** Forget the token only (expired offline): shift, data and PIN keep working. */
  dropToken(): Promise<void>;
  /** End the account session. Never touches sales, the outbox or PIN material. */
  clear(): Promise<void>;
}
