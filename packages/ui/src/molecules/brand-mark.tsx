"use client";

import { CoffeeIcon } from "@phosphor-icons/react";
import { cn } from "@pos-apps/ui/lib/utils";

export function BrandMark({
  title = "POS Apps",
  subtitle,
  className,
  size = "md",
}: {
  title?: string;
  subtitle?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const mark =
    size === "lg" ? "h-16 w-16" : size === "sm" ? "h-9 w-9" : "h-12 w-12";
  const iconSize = size === "lg" ? 28 : size === "sm" ? 18 : 22;

  return (
    <div className={cn("flex flex-col items-center gap-2 text-center", className)}>
      <div
        className={cn(
          "inline-flex items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm",
          mark,
        )}
        aria-hidden
      >
        <CoffeeIcon size={iconSize} weight="fill" />
      </div>
      <div>
        <p
          className={cn(
            "font-semibold tracking-tight text-foreground",
            size === "lg" ? "text-base" : "text-sm",
          )}
        >
          {title}
        </p>
        {subtitle ? (
          <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
    </div>
  );
}
