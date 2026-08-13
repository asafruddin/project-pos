"use client";

import { useEffect, useState } from "react";
import { getCatalogImageRecord } from "@pos-apps/local-db";

export function CatalogProductThumb({
  productId,
  alt,
}: {
  productId: string;
  alt: string;
}) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    void getCatalogImageRecord(productId).then((row) => {
      if (cancelled) return;
      if (!row) {
        setSrc(null);
        return;
      }
      const blob = new Blob([row.bytes], { type: row.mimeType });
      objectUrl = URL.createObjectURL(blob);
      setSrc(objectUrl);
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [productId]);

  if (!src) {
    return (
      <span
        className="mb-2 block h-24 w-full rounded-xl bg-secondary/80"
        aria-hidden
      />
    );
  }

  return (
    // Cached IndexedDB bytes — never a Cloudinary URL (FR-41).
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className="mb-2 h-24 w-full rounded-xl object-cover"
    />
  );
}
