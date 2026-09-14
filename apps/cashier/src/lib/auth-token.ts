const TOKEN_KEY = "pos_cashier_access_token";
const ROLE_KEY = "pos_cashier_role";
const USER_ID_KEY = "pos_cashier_user_id";
/** Set on Account Login; cleared on Day Close / logout so FR4 requires login again. */
const SHIFT_KEY = "pos_cashier_shift_ok";

/** Clock skew tolerance when checking JWT `exp` (ms). */
const EXPIRY_SKEW_MS = 5_000;

const PERMS_KEY = "pos_cashier_permissions";
const STORE_ID_KEY = "pos_cashier_store_id";
const STORE_NAME_KEY = "pos_cashier_store_name";
const STORE_LOGO_URL_KEY = "pos_cashier_store_logo_url";
const STORE_LOGO_DATA_KEY = "pos_cashier_store_logo_data";

export type CashierSession = {
  accessToken: string;
  role: string;
  userId: string;
  permissions?: string[];
  storeId?: string | null;
  storeName?: string | null;
  storeLogoUrl?: string | null;
};

export type StoreIdentity = {
  storeId: string | null;
  storeName: string;
  storeLogoUrl: string | null;
  storeLogoDataUrl: string | null;
};

function readStoreIdentity(): StoreIdentity {
  if (typeof window === "undefined") {
    return {
      storeId: null,
      storeName: "POS Apps",
      storeLogoUrl: null,
      storeLogoDataUrl: null,
    };
  }
  return {
    storeId: localStorage.getItem(STORE_ID_KEY),
    storeName: localStorage.getItem(STORE_NAME_KEY) || "POS Apps",
    storeLogoUrl: localStorage.getItem(STORE_LOGO_URL_KEY),
    storeLogoDataUrl: localStorage.getItem(STORE_LOGO_DATA_KEY),
  };
}

export function getStoreIdentity(): StoreIdentity {
  return readStoreIdentity();
}

function writeStoreIdentity(input: {
  storeId?: string | null;
  storeName?: string | null;
  storeLogoUrl?: string | null;
}): void {
  if (input.storeId) localStorage.setItem(STORE_ID_KEY, input.storeId);
  if (input.storeName) localStorage.setItem(STORE_NAME_KEY, input.storeName);
  if (input.storeLogoUrl) {
    localStorage.setItem(STORE_LOGO_URL_KEY, input.storeLogoUrl);
  } else if (input.storeLogoUrl === null) {
    localStorage.removeItem(STORE_LOGO_URL_KEY);
    localStorage.removeItem(STORE_LOGO_DATA_KEY);
  }
}

export function saveSession(session: CashierSession): void {
  localStorage.setItem(TOKEN_KEY, session.accessToken);
  localStorage.setItem(ROLE_KEY, session.role);
  localStorage.setItem(USER_ID_KEY, session.userId);
  localStorage.setItem(SHIFT_KEY, "1");
  localStorage.setItem(PERMS_KEY, JSON.stringify(session.permissions ?? []));
  writeStoreIdentity({
    storeId: session.storeId,
    storeName: session.storeName,
    storeLogoUrl: session.storeLogoUrl ?? null,
  });
}

export function patchStoreIdentity(input: {
  storeId?: string | null;
  storeName?: string | null;
  storeLogoUrl?: string | null;
}): void {
  if (typeof window === "undefined") return;
  writeStoreIdentity(input);
}

export function cacheStoreLogoDataUrl(dataUrl: string | null): void {
  if (typeof window === "undefined") return;
  if (!dataUrl) {
    localStorage.removeItem(STORE_LOGO_DATA_KEY);
    return;
  }
  try {
    localStorage.setItem(STORE_LOGO_DATA_KEY, dataUrl);
  } catch {
    /* quota — receipt can still use a live blob URL */
  }
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ROLE_KEY);
  localStorage.removeItem(USER_ID_KEY);
  localStorage.removeItem(SHIFT_KEY);
  localStorage.removeItem(PERMS_KEY);
  localStorage.removeItem(STORE_ID_KEY);
  localStorage.removeItem(STORE_NAME_KEY);
  localStorage.removeItem(STORE_LOGO_URL_KEY);
  localStorage.removeItem(STORE_LOGO_DATA_KEY);
  // PIN unlock is tab-scoped; clear so Menu stays gated after Sign out / Day Close.
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.removeItem("pos_cashier_pin_unlocked");
  }
}

/** Drop Bearer token only — keeps shift flag for offline PIN unlock (FR5). */
export function clearAccessToken(): void {
  localStorage.removeItem(TOKEN_KEY);
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
  const permissionsRaw = localStorage.getItem(PERMS_KEY);
  let permissions: string[] = [];
  if (permissionsRaw) {
    try {
      const parsed = JSON.parse(permissionsRaw) as unknown;
      if (Array.isArray(parsed)) {
        permissions = parsed.filter((p): p is string => typeof p === "string");
      }
    } catch {
      permissions = [];
    }
  }
  const store = readStoreIdentity();
  return {
    accessToken,
    role,
    userId,
    permissions,
    storeId: store.storeId,
    storeName: store.storeName,
    storeLogoUrl: store.storeLogoUrl,
  };
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

function onLoginPath(): boolean {
  return window.location.pathname === "/login";
}

/**
 * Full logout + redirect to login (invalid/expired session while online or on 401).
 */
export function logoutToLogin(): void {
  if (typeof window === "undefined") return;
  clearSession();
  if (!onLoginPath()) {
    window.location.replace("/login");
  }
}

/**
 * Handle expired/invalid local JWT.
 * Offline mid-shift: strip token but keep shift so PIN unlock still works.
 * Online: full logout to Account Login.
 */
export function handleExpiredAccessToken(): void {
  if (typeof window === "undefined") return;
  if (!navigator.onLine) {
    clearAccessToken();
    return;
  }
  logoutToLogin();
}
