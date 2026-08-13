import type { ApiErrorBody } from "@pos-apps/types";
import { authorizedFetch } from "@/lib/api-client";
import { getAccessToken, isAccessTokenExpired, logoutToLogin } from "@/lib/auth-token";

export async function catalogRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<{ ok: true; data: T } | { ok: false; message: string }> {
  const token = getAccessToken();
  if (!token || isAccessTokenExpired(token)) {
    logoutToLogin();
    return { ok: false, message: "Sesi berakhir. Masuk lagi." };
  }
  try {
    const res = await authorizedFetch(path, {
      ...init,
      headers: {
        ...(init?.body instanceof FormData
          ? {}
          : { "Content-Type": "application/json" }),
        ...(init?.headers ?? {}),
      },
    });
    const data = (await res.json()) as T | ApiErrorBody;
    if (!res.ok) {
      const err = data as ApiErrorBody;
      return { ok: false, message: err.message ?? "Permintaan gagal." };
    }
    return { ok: true, data: data as T };
  } catch (err) {
    if (
      err instanceof Error &&
      (err.message === "AUTH_UNAUTHORIZED" ||
        err.message === "AUTH_SESSION_EXPIRED")
    ) {
      return { ok: false, message: "Sesi berakhir. Masuk lagi." };
    }
    return { ok: false, message: "Tidak dapat menghubungi API." };
  }
}
