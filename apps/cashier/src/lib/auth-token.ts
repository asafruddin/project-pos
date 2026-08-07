const TOKEN_KEY = "pos_cashier_access_token";
const ROLE_KEY = "pos_cashier_role";
const USER_ID_KEY = "pos_cashier_user_id";
/** Set on Account Login; cleared on Day Close / logout so FR4 requires login again. */
const SHIFT_KEY = "pos_cashier_shift_ok";

export type CashierSession = {
  accessToken: string;
  role: string;
  userId: string;
};

export function saveSession(session: CashierSession): void {
  localStorage.setItem(TOKEN_KEY, session.accessToken);
  localStorage.setItem(ROLE_KEY, session.role);
  localStorage.setItem(USER_ID_KEY, session.userId);
  localStorage.setItem(SHIFT_KEY, "1");
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ROLE_KEY);
  localStorage.removeItem(USER_ID_KEY);
  localStorage.removeItem(SHIFT_KEY);
  // PIN unlock is tab-scoped; clear so Menu stays gated after Sign out / Day Close.
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.removeItem("pos_cashier_pin_unlocked");
  }
}

/** True after Account Login until Day Close or logout (AD-8 / FR4). */
export function isShiftAuthorized(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(SHIFT_KEY) === "1";
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getSession(): CashierSession | null {
  if (typeof window === "undefined") return null;
  const accessToken = localStorage.getItem(TOKEN_KEY);
  const role = localStorage.getItem(ROLE_KEY);
  const userId = localStorage.getItem(USER_ID_KEY);
  if (!accessToken || !role || !userId) return null;
  return { accessToken, role, userId };
}
