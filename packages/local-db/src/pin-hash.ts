/** PIN hashing helpers — never log or persist plaintext PIN. */

const PBKDF2_ITERATIONS = 100_000;

function bytesToB64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function b64ToBytes(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export function createSalt(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return bytesToB64(bytes);
}

export async function hashPin(pin: string, saltB64: string): Promise<string> {
  if (!/^\d{6}$/.test(pin)) {
    throw new Error("PIN_INVALID_FORMAT");
  }
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(pin),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const salt = b64ToBytes(saltB64);
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    256,
  );
  return bytesToB64(new Uint8Array(bits));
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}

export function isSixDigitPin(value: string): boolean {
  return /^\d{6}$/.test(value);
}
