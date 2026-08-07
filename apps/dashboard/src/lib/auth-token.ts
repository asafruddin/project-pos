const TOKEN_KEY = "pos_apps_access_token";
const ROLE_KEY = "pos_apps_role";
const USER_ID_KEY = "pos_apps_user_id";

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
