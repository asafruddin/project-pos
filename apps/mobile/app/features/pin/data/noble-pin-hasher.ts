import { pbkdf2Async } from "@noble/hashes/pbkdf2.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { base64ToBytes, bytesToBase64 } from "@/utils/base64";
import type { PinHasher } from "../domain/pin-service";

/**
 * PBKDF2-HMAC-SHA256 in pure JS (Hermes has no WebCrypto). `pbkdf2Async` yields to the event
 * loop so the PIN pad stays responsive. The count is stored with each hash, so it can be raised later.
 */
export class NoblePinHasher implements PinHasher {
  constructor(
    private readonly randomBytes: (length: number) => Uint8Array,
    readonly defaultIterations = 50_000,
  ) {}

  salt(): string {
    return bytesToBase64(this.randomBytes(16));
  }

  async hash(pin: string, saltB64: string, iterations: number): Promise<string> {
    const out = await pbkdf2Async(sha256, new TextEncoder().encode(pin), base64ToBytes(saltB64), {
      c: iterations,
      dkLen: 32,
      asyncTick: 8,
    });
    return bytesToBase64(out);
  }
}
