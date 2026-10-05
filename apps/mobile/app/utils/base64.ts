const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const LOOKUP = new Map([...ALPHABET].map((c, i) => [c, i]));

/** Hermes has no Buffer; print payloads are stored as base64 text. */
export function bytesToBase64(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    out += ALPHABET[b0 >> 2];
    out += ALPHABET[((b0 & 3) << 4) | ((b1 ?? 0) >> 4)];
    out += b1 === undefined ? "=" : ALPHABET[((b1 & 15) << 2) | ((b2 ?? 0) >> 6)];
    out += b2 === undefined ? "=" : ALPHABET[b2 & 63];
  }
  return out;
}

export function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/=+$/, "");
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const c0 = LOOKUP.get(clean[i]) ?? 0;
    const c1 = LOOKUP.get(clean[i + 1]) ?? 0;
    const c2 = clean[i + 2] === undefined ? undefined : (LOOKUP.get(clean[i + 2]) ?? 0);
    const c3 = clean[i + 3] === undefined ? undefined : (LOOKUP.get(clean[i + 3]) ?? 0);
    out[o++] = (c0 << 2) | (c1 >> 4);
    if (c2 !== undefined) out[o++] = ((c1 & 15) << 4) | (c2 >> 2);
    if (c3 !== undefined) out[o++] = ((c2 ?? 0) & 3) << 6 | c3;
  }
  return out;
}
