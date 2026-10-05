import * as SecureStore from "expo-secure-store";
import type { KvStore } from "@/infrastructure/db/kv-store";
import { MANAGER_SCOPE, type LockoutState, type LockoutStore, type PinMaterial, type PinMaterialStore } from "../domain/pin-service";

const key = (scope: string) => `pos_pin_${scope}`;
const INDEX_KEY = "pin.users";

/**
 * PIN hashes in Keystore-backed SecureStore (not SQLite). SecureStore cannot list keys, so the
 * set of enrolled user ids is mirrored in the kv table to support "unlock without knowing the user".
 */
export class SecurePinMaterialStore implements PinMaterialStore {
  constructor(private readonly kv: KvStore) {}

  async get(scope: string): Promise<PinMaterial | null> {
    const raw = await SecureStore.getItemAsync(key(scope));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as PinMaterial;
    } catch {
      return null;
    }
  }

  async set(scope: string, material: PinMaterial): Promise<void> {
    await SecureStore.setItemAsync(key(scope), JSON.stringify(material));
    if (scope !== MANAGER_SCOPE) {
      const ids = this.userIds();
      if (!ids.includes(scope)) this.kv.set(INDEX_KEY, JSON.stringify([...ids, scope]));
    }
  }

  async anyUser(): Promise<PinMaterial | null> {
    for (const id of this.userIds()) {
      const material = await this.get(id);
      if (material) return material;
    }
    return null;
  }

  async remove(scope: string): Promise<void> {
    await SecureStore.deleteItemAsync(key(scope));
    this.kv.set(INDEX_KEY, JSON.stringify(this.userIds().filter((id) => id !== scope)));
  }

  private userIds(): string[] {
    try {
      const parsed = JSON.parse(this.kv.get(INDEX_KEY) ?? "[]") as unknown;
      return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
    } catch {
      return [];
    }
  }
}

export class KvLockoutStore implements LockoutStore {
  constructor(private readonly kv: KvStore) {}

  get(scope: string): LockoutState {
    try {
      const parsed = JSON.parse(this.kv.get(`pin.lock.${scope}`) ?? "null") as LockoutState | null;
      if (parsed && Number.isFinite(parsed.failures) && Number.isFinite(parsed.lockedUntil)) return parsed;
    } catch {
      /* fall through */
    }
    return { failures: 0, lockedUntil: 0 };
  }

  set(scope: string, state: LockoutState): void {
    this.kv.set(`pin.lock.${scope}`, JSON.stringify(state));
  }
}
