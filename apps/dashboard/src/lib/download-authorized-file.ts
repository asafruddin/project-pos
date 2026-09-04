import type { ApiErrorBody } from "@pos-apps/types";
import { authorizedFetch } from "@/lib/api-client";
import { getAccessToken, isAccessTokenExpired, logoutToLogin } from "@/lib/auth-token";

function filenameFromDisposition(header: string | null, fallback: string): string {
  if (!header) return fallback;
  const utf = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (utf?.[1]) {
    try {
      return decodeURIComponent(utf[1].trim());
    } catch {
      return utf[1].trim();
    }
  }
  const quoted = /filename="([^"]+)"/i.exec(header);
  if (quoted?.[1]) return quoted[1];
  const plain = /filename=([^;]+)/i.exec(header);
  return plain?.[1]?.trim() ?? fallback;
}

export async function downloadAuthorizedFile(
  path: string,
  fallbackName: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const token = getAccessToken();
  if (!token || isAccessTokenExpired(token)) {
    logoutToLogin();
    return { ok: false, message: "Sesi berakhir. Masuk lagi." };
  }
  try {
    const res = await authorizedFetch(path);
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as ApiErrorBody | null;
      return { ok: false, message: data?.message ?? "Gagal mengunduh file." };
    }
    const blob = await res.blob();
    const filename = filenameFromDisposition(
      res.headers.get("content-disposition"),
      fallbackName,
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    return { ok: true };
  } catch (err) {
    if (
      err instanceof Error &&
      (err.message === "AUTH_UNAUTHORIZED" || err.message === "AUTH_SESSION_EXPIRED")
    ) {
      return { ok: false, message: "Sesi berakhir. Masuk lagi." };
    }
    return { ok: false, message: "Tidak dapat menghubungi API." };
  }
}
