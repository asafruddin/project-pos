"use client";

import { ImageSquareIcon } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { getCatalogImageRecord } from "@pos-apps/local-db";
import { cn } from "@/lib/utils";

export function CatalogProductThumb({
  productId,
  alt,
  className,
}: {
  productId: string;
  alt: string;
  className?: string;
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

  const frame = cn("aspect-[4/3] w-full overflow-hidden bg-muted", className);

  if (!src) {
    return (
      <span
        className={cn(
          frame,
          "flex items-center justify-center bg-gradient-to-br from-muted to-secondary",
        )}
        aria-hidden
      >
        <ImageSquareIcon
          size={40}
          weight="duotone"
          className="text-muted-foreground/55"
        />
      </span>
    );
  }

  return (
    // Cached IndexedDB bytes — never a Cloudinary URL (FR-41).
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={cn(frame, "object-cover")} />
  );
}
