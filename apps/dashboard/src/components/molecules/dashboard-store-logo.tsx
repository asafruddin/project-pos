"use client";

import type { StoreRecord } from "@pos-apps/types";
import { storeLogoFilePath } from "@pos-apps/types";
import { StoreLogo } from "@pos-apps/ui/molecules";
import { useAuthorizedImage } from "@/lib/use-authorized-image";

export function DashboardStoreLogo({
  store,
  logoPath,
  size = "sm",
}: {
  store?: Pick<
    StoreRecord,
    "store_id" | "name" | "logo_public_id" | "logo_secure_url"
  > | null;
  logoPath?: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const filePath = store?.logo_secure_url
    ? null
    : store?.logo_public_id
      ? `${storeLogoFilePath(store.store_id)}?v=${encodeURIComponent(store.logo_public_id)}`
      : (logoPath ?? null);
  const proxied = useAuthorizedImage(filePath);
  const src = store?.logo_secure_url || proxied;
  return <StoreLogo src={src} alt={store?.name ?? ""} size={size} />;
}
