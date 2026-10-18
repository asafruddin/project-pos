function statusOf(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const e = error as { statusCode?: unknown; lastError?: unknown; cause?: unknown };
  if (typeof e.statusCode === "number") return e.statusCode;
  return statusOf(e.lastError) ?? statusOf(e.cause);
}

/** Message streamed to the Dashboard when the provider call fails mid-response. */
export function assistantStreamErrorMessage(error: unknown): string {
  const status = statusOf(error);
  if (status === 429) {
    return "Asisten sedang sibuk (batas kuota model tercapai). Coba lagi sebentar.";
  }
  const message = error instanceof Error ? error.message : "";
  if (status === 401 || status === 403 || /api key/i.test(message)) {
    return "Kunci API asisten tidak valid. Hubungi admin.";
  }
  return "Asisten tidak dapat menjawab saat ini. Coba lagi.";
}
