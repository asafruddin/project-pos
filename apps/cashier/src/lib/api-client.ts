import {
  getAccessToken,
  handleExpiredAccessToken,
  isAccessTokenExpired,
  logoutToLogin,
} from "@/lib/auth-token";

const DEFAULT_API_PORT = "3001";

/**
 * Tablets opening cashier via LAN IP must call the API on that same host.
 * `localhost` in the bundle would point at the phone, not the till.
 */
export function getApiUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  if (typeof window === "undefined") {
    return `http://localhost:${DEFAULT_API_PORT}`;
  }
  const { protocol, hostname } = window.location;
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return `http://localhost:${DEFAULT_API_PORT}`;
  }
  return `${protocol}//${hostname}:${DEFAULT_API_PORT}`;
}

/** Resolved at module load; prefer getApiUrl() for LAN tablets. */
export const API_URL = getApiUrl();

type AuthorizedFetchOptions = RequestInit & {
  /** Skip Authorization header (default false). */
  skipAuth?: boolean;
};

/**
 * Fetch against the API with Bearer token.
 * On 401 or locally expired JWT → logout / redirect to login (online).
 */
export async function authorizedFetch(
  path: string,
  init: AuthorizedFetchOptions = {},
): Promise<Response> {
  const { skipAuth, headers, ...rest } = init;
  const token = getAccessToken();

  if (!skipAuth) {
    if (!token || isAccessTokenExpired(token)) {
      handleExpiredAccessToken();
      throw new Error("AUTH_SESSION_EXPIRED");
    }
  }

  const res = await fetch(`${getApiUrl()}${path}`, {
    ...rest,
    headers: {
      ...(headers ?? {}),
      ...(skipAuth || !token
        ? {}
        : { Authorization: `Bearer ${token}` }),
    },
  });

  if (res.status === 401) {
    logoutToLogin();
    throw new Error("AUTH_UNAUTHORIZED");
  }

  return res;
}
