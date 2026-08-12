import {
  getAccessToken,
  handleExpiredAccessToken,
  isAccessTokenExpired,
  logoutToLogin,
} from "@/lib/auth-token";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export { API_URL };

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

  const res = await fetch(`${API_URL}${path}`, {
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
