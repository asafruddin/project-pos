"use client";

import { CoffeeIcon } from "@phosphor-icons/react";
import { cn } from "@pos-apps/ui/lib/utils";

export function StoreLogo({
  src,
  alt,
  size = "md",
  className,
}: {
  src?: string | null;
  alt: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const box =
    size === "lg" ? "h-16 w-16" : size === "sm" ? "h-8 w-8" : "h-10 w-10";
  const iconSize = size === "lg" ? 28 : size === "sm" ? 16 : 22;

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        className={cn("rounded-xl object-cover", box, className)}
      />
    );
  }

  return (
    <div
      className={cn(
        "inline-flex items-center justify-center rounded-xl bg-primary text-primary-foreground",
        box,
        className,
      )}
      aria-hidden
    >
      <CoffeeIcon size={iconSize} weight="fill" />
    </div>
  );
}
