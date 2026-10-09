import { AppError } from "@/core/errors/app-error";
import type { Clock } from "@/core/ports/clock";
import { DEFAULT_MANAGER_PIN, type ManagerPinMaterial } from "@pos-apps/types";

export type PinMaterial = {
  /** base64 salt */
  salt: string;
  /** base64 PBKDF2 output */
  hash: string;
  iterations: number;
  enrolledAt: string;
};

/** Where hashes live (Android Keystore-backed SecureStore in the app). */
export interface PinMaterialStore {
  get(scope: string): Promise<PinMaterial | null>;
  set(scope: string, material: PinMaterial): Promise<void>;
  /** Any non-manager material (offline unlock when the user id is unknown). */
  anyUser(): Promise<PinMaterial | null>;
  remove(scope: string): Promise<void>;
}

export interface PinHasher {
  salt(): string;
  hash(pin: string, saltB64: string, iterations: number): Promise<string>;
  readonly defaultIterations: number;
}

export type LockoutState = { failures: number; lockedUntil: number };

export interface LockoutStore {
  get(scope: string): LockoutState;
  set(scope: string, state: LockoutState): void;
}

export const MANAGER_SCOPE = "__manager__";
export const MAX_FREE_ATTEMPTS = 5;
const BASE_LOCK_MS = 30_000;
const MAX_LOCK_MS = 15 * 60_000;

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: "wrong"; attemptsLeft: number }
  | { ok: false; reason: "locked"; retryAfterMs: number }
  | { ok: false; reason: "no_material" };

export function isSixDigitPin(value: string): boolean {
  return /^\d{6}$/.test(value);
}

/** Constant-time string compare (hashes are equal length). */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i += 1) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

/** After 5 wrong PINs lock for 30 s, doubling each further failure up to 15 min. */
export function lockDurationMs(failures: number): number {
  if (failures < MAX_FREE_ATTEMPTS) return 0;
  return Math.min(MAX_LOCK_MS, BASE_LOCK_MS * 2 ** (failures - MAX_FREE_ATTEMPTS));
}

/**
 * Offline PIN unlock + manager PIN. Hashes never leave the device. Wrong guesses are
 * rate-limited because a 6-digit PIN is otherwise trivially brute-forceable offline.
 */
export class PinService {
  constructor(
    private readonly store: PinMaterialStore,
    private readonly hasher: PinHasher,
    private readonly lockouts: LockoutStore,
    private readonly clock: Clock,
  ) {}

  async hasMaterial(userId?: string | null): Promise<boolean> {
    return (userId ? await this.store.get(userId) : await this.store.anyUser()) !== null;
  }

  async hasManagerPin(): Promise<boolean> {
    return (await this.store.get(MANAGER_SCOPE)) !== null;
  }

  async enroll(userId: string, pin: string): Promise<void> {
    await this.enrollScope(userId, pin);
  }

  async enrollManager(pin: string): Promise<void> {
    await this.enrollScope(MANAGER_SCOPE, pin);
  }

  /**
   * Cache the store's manager PIN (set by the owner in the dashboard; from login / `/auth/me`).
   * `null` = no custom PIN: drop any old one so the default applies.
   */
  async syncManager(material: ManagerPinMaterial | null | undefined): Promise<void> {
    if (material === undefined) return;
    if (!material) {
      await this.store.remove(MANAGER_SCOPE);
      return;
    }
    const current = await this.store.get(MANAGER_SCOPE);
    if (current && current.hash === material.hash && current.salt === material.salt) return; // unchanged: keep the lockout
    await this.store.set(MANAGER_SCOPE, { salt: material.salt, hash: material.hash, iterations: material.iterations, enrolledAt: this.clock.nowIso() });
    this.lockouts.set(MANAGER_SCOPE, { failures: 0, lockedUntil: 0 });
  }

  verify(userId: string | null, pin: string): Promise<VerifyResult> {
    return this.verifyScope(userId, pin);
  }

  /** The owner's PIN, or the default (000000) until they set one. */
  verifyManager(pin: string): Promise<VerifyResult> {
    return this.verifyScope(MANAGER_SCOPE, pin, DEFAULT_MANAGER_PIN);
  }

  /** Seconds the scope is still locked for (0 when free). */
  lockedForMs(scope: string): number {
    return Math.max(0, this.lockouts.get(scope).lockedUntil - this.clock.nowMs());
  }

  private async enrollScope(scope: string, pin: string): Promise<void> {
    if (!scope) throw new AppError("VALIDATION", "PIN_USER_REQUIRED");
    if (!isSixDigitPin(pin)) throw new AppError("VALIDATION", "PIN_INVALID_FORMAT");
    const salt = this.hasher.salt();
    const iterations = this.hasher.defaultIterations;
    const hash = await this.hasher.hash(pin, salt, iterations);
    await this.store.set(scope, { salt, hash, iterations, enrolledAt: this.clock.nowIso() });
    this.lockouts.set(scope, { failures: 0, lockedUntil: 0 });
  }

  private async verifyScope(userId: string | null, pin: string, defaultPin?: string): Promise<VerifyResult> {
    const scope = userId ?? "__user__";
    const lockedFor = this.lockedForMs(scope);
    if (lockedFor > 0) return { ok: false, reason: "locked", retryAfterMs: lockedFor };

    const material = userId ? await this.store.get(userId) : await this.store.anyUser();
    if (!material && defaultPin === undefined) return { ok: false, reason: "no_material" };

    const matches = !isSixDigitPin(pin)
      ? false
      : material
        ? timingSafeEqual(await this.hasher.hash(pin, material.salt, material.iterations), material.hash)
        : pin === defaultPin;
    if (matches) {
      this.lockouts.set(scope, { failures: 0, lockedUntil: 0 });
      return { ok: true };
    }

    const failures = this.lockouts.get(scope).failures + 1;
    const lock = lockDurationMs(failures);
    this.lockouts.set(scope, { failures, lockedUntil: lock > 0 ? this.clock.nowMs() + lock : 0 });
    if (lock > 0) return { ok: false, reason: "locked", retryAfterMs: lock };
    return { ok: false, reason: "wrong", attemptsLeft: MAX_FREE_ATTEMPTS - failures };
  }
}
