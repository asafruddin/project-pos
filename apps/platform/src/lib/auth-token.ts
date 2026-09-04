const TOKEN_KEY = "pos_platform_access_token";
const ROLE_KEY = "pos_platform_role";
const USER_ID_KEY = "pos_platform_user_id";

/** Clock skew tolerance when checking JWT `exp` (ms). */
const EXPIRY_SKEW_MS = 5_000;

export type StoredSession = {
  accessToken: string;
  role: string;
  userId: string;
};

export function saveSession(session: StoredSession): void {
  localStorage.setItem(TOKEN_KEY, session.accessToken);
  localStorage.setItem(ROLE_KEY, session.role);
  localStorage.setItem(USER_ID_KEY, session.userId);
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ROLE_KEY);
  localStorage.removeItem(USER_ID_KEY);
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getSession(): StoredSession | null {
  if (typeof window === "undefined") return null;
  const accessToken = localStorage.getItem(TOKEN_KEY);
  const role = localStorage.getItem(ROLE_KEY);
  const userId = localStorage.getItem(USER_ID_KEY);
  if (!accessToken || !role || !userId) return null;
  return { accessToken, role, userId };
}

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

/** True when token is missing, malformed, or past JWT `exp`. */
export function isAccessTokenExpired(
  token: string | null = getAccessToken(),
): boolean {
  if (!token) return true;
  const exp = readJwtExp(token);
  if (exp == null) return true;
  return Date.now() >= exp * 1000 - EXPIRY_SKEW_MS;
}

/**
 * Full logout + redirect to login when session is invalid/expired.
 */
export function logoutToLogin(): void {
  if (typeof window === "undefined") return;
  clearSession();
  if (window.location.pathname !== "/login") {
    window.location.replace("/login");
  }
}
