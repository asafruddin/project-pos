import { pbkdf2Async } from "@noble/hashes/pbkdf2.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { base64ToBytes, bytesToBase64 } from "@/utils/base64";
import type { PinHasher } from "../domain/pin-service";

/** `PosCrypto.pbkdf2` from `modules/pos-crypto` (JVM HMAC-SHA256, off the JS thread). Returns base64. */
export type NativePbkdf2 = (password: string, saltB64: string, iterations: number, dkLen: number) => Promise<string>;

/** The native PBKDF2 when the dev build includes the module; null in tests and in older APKs. */
export function loadNativePbkdf2(): NativePbkdf2 | null {
  try {
    // `require("expo")` pulls the Expo barrel and can recurse on Hermes at boot.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const core = require("expo-modules-core") as {
      requireOptionalNativeModule?: (name: string) => { pbkdf2?: NativePbkdf2 } | null;
    };
    const native = core.requireOptionalNativeModule?.("PosCrypto");
    if (typeof native?.pbkdf2 === "function") return native.pbkdf2.bind(native);
    if (__DEV__) console.warn("[pin] PosCrypto native module not found: PIN hashing falls back to slow JS. Rebuild the dev client.");
    return null;
  } catch (e) {
    if (__DEV__) console.warn("[pin] could not load expo-modules-core: PIN hashing falls back to slow JS.", e);
    return null;
  }
}

/**
 * PBKDF2-HMAC-SHA256 (Hermes has no WebCrypto). Native when available: pure JS on Hermes needs
 * minutes for 50k-100k iterations, the JVM needs milliseconds. The `@noble/hashes` fallback gives the
 * same output, so hashes made by either path verify on the other. The count is stored with each
 * hash, so it can be raised later.
 */
export class NoblePinHasher implements PinHasher {
  constructor(
    private readonly randomBytes: (length: number) => Uint8Array,
    readonly defaultIterations = 50_000,
    private readonly native: NativePbkdf2 | null = null,
  ) {}

  salt(): string {
    return bytesToBase64(this.randomBytes(16));
  }

  async hash(pin: string, saltB64: string, iterations: number): Promise<string> {
    const started = Date.now();
    if (this.native) {
      try {
        const out = await this.native(pin, saltB64, iterations, 32);
        if (__DEV__) console.log(`[pin] hash native ${Date.now() - started} ms (${iterations} iterations)`);
        return out;
      } catch (e) {
        if (__DEV__) console.warn("[pin] native PBKDF2 failed, using slow JS fallback", e);
      }
    }
    const out = await pbkdf2Async(sha256, new TextEncoder().encode(pin), base64ToBytes(saltB64), {
      c: iterations,
      dkLen: 32,
      asyncTick: 8,
    });
    if (__DEV__) console.log(`[pin] hash js ${Date.now() - started} ms (${iterations} iterations)`);
    return bytesToBase64(out);
  }
}
