/** Clock skew tolerance when checking JWT `exp` (ms). */
const EXPIRY_SKEW_MS = 5_000;

function readJwtExp(token: string): number | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      "=",
    );
    const json = JSON.parse(atob(padded)) as { exp?: unknown };
    return typeof json.exp === "number" ? json.exp : null;
  } catch {
    return null;
  }
}

/** True when the token is missing, malformed, or past its `exp`. */
export function isJwtExpired(token: string | null, nowMs = Date.now()): boolean {
  if (!token) return true;
  const exp = readJwtExp(token);
  if (exp == null) return true;
  return nowMs >= exp * 1000 - EXPIRY_SKEW_MS;
}
