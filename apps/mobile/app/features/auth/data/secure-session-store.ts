import * as SecureStore from "expo-secure-store";
import type { KvStore } from "@/infrastructure/db/kv-store";
import type { SessionStore } from "../domain/ports";
import type { Session, StoreIdentity } from "../domain/session";

const TOKEN_KEY = "pos_session_token";
const META_KEY = "session.meta";
const SHIFT_KEY = "session.shiftOk";

type SessionMeta = Omit<Session, "accessToken">;

/**
 * Token → Android Keystore-backed SecureStore. Non-secret profile → SQLite kv,
 * so an expired token still leaves the store/user known for offline work.
 */
export class SecureSessionStore implements SessionStore {
  private session: Session | null = null;

  constructor(private readonly kv: KvStore) {}

  async hydrate(): Promise<Session | null> {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    const rawMeta = this.kv.get(META_KEY);
    if (!rawMeta || (!token && !this.shiftAuthorized())) {
      this.session = null;
      return null;
    }
    try {
      this.session = { ...(JSON.parse(rawMeta) as SessionMeta), accessToken: token };
    } catch {
      this.session = null;
    }
    return this.session;
  }

  current(): Session | null {
    return this.session;
  }

  shiftAuthorized(): boolean {
    return this.kv.get(SHIFT_KEY) === "1";
  }

  async save(session: Session): Promise<void> {
    const { accessToken, ...meta } = session;
    if (accessToken) await SecureStore.setItemAsync(TOKEN_KEY, accessToken);
    else await SecureStore.deleteItemAsync(TOKEN_KEY);
    this.kv.set(META_KEY, JSON.stringify(meta));
    this.kv.set(SHIFT_KEY, "1");
    this.session = session;
  }

  async patchIdentity(identity: StoreIdentity): Promise<void> {
    if (!this.session) return;
    const next = { ...this.session, ...identity };
    const { accessToken: _token, ...meta } = next;
    this.kv.set(META_KEY, JSON.stringify(meta));
    this.session = next;
  }

  async dropToken(): Promise<void> {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    if (this.session) this.session = { ...this.session, accessToken: null };
  }

  async clear(): Promise<void> {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    this.kv.delete(META_KEY);
    this.kv.delete(SHIFT_KEY);
    this.session = null;
  }
}
