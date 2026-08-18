import { getOpenShift } from "@pos-apps/local-db";
import { clearSession } from "@/lib/auth-token";
import { clearPinUnlock } from "@/lib/pin-session";

type AppRouter = {
  replace: (href: string) => void;
};

/**
 * Explicit Sign out: if a local shift is open, go close it first.
 * Token-expiry logout must keep using logoutToLogin() instead.
 */
export async function requestLogout(router: AppRouter): Promise<void> {
  const open = await getOpenShift();
  if (open) {
    router.replace("/shift?intent=logout");
    return;
  }
  clearSession();
  clearPinUnlock();
  router.replace("/login");
}
