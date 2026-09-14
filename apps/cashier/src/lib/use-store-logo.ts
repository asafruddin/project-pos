"use client";

import { useEffect, useState } from "react";
import { authorizedFetch } from "@/lib/api-client";
import {
  cacheStoreLogoDataUrl,
  getAccessToken,
  getStoreIdentity,
} from "@/lib/auth-token";

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export async function prefetchStoreLogo(
  path: string | null | undefined,
): Promise<void> {
  if (!path || typeof window === "undefined") return;
  if (!navigator.onLine || !getAccessToken()) return;
  try {
    const res = await authorizedFetch(path);
    if (!res.ok) return;
    const dataUrl = await blobToDataUrl(await res.blob());
    cacheStoreLogoDataUrl(dataUrl);
  } catch {
    /* receipt/chrome can fetch again */
  }
}

/**
 * Store logo for affiliated chrome: live byte proxy when online, last data URL offline.
 */
export function useStoreLogoSrc(path: string | null | undefined): string | null {
  const cached = getStoreIdentity().storeLogoDataUrl;
  const [src, setSrc] = useState<string | null>(cached);

  useEffect(() => {
    if (!path) {
      setSrc(getStoreIdentity().storeLogoDataUrl);
      return;
    }
    const fallback = getStoreIdentity().storeLogoDataUrl;
    if (fallback) setSrc(fallback);
    if (!navigator.onLine || !getAccessToken()) return;

    let cancelled = false;
    let objectUrl: string | null = null;
    void (async () => {
      try {
        const res = await authorizedFetch(path);
        if (!res.ok || cancelled) return;
        const blob = await res.blob();
        try {
          const dataUrl = await blobToDataUrl(blob);
          cacheStoreLogoDataUrl(dataUrl);
          if (!cancelled) setSrc(dataUrl);
        } catch {
          objectUrl = URL.createObjectURL(blob);
          if (!cancelled) setSrc(objectUrl);
        }
      } catch {
        if (!cancelled && fallback) setSrc(fallback);
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path]);

  return src;
}
