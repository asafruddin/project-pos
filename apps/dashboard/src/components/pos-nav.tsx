"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  match?: (pathname: string) => boolean;
};

/** Dashboard always uses sidebar (desktop + tablet + mobile). */
export function SideNav({
  items,
  brand,
  footer,
  className,
  compact = false,
}: {
  items: NavItem[];
  brand?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  compact?: boolean;
}) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "flex shrink-0 flex-col gap-4 overflow-hidden rounded-lg border border-border bg-card p-3 shadow-sm sm:gap-5 sm:p-5",
        compact ? "w-[4.5rem] items-center" : "w-56 sm:w-64",
        className,
      )}
    >
      <div className="shrink-0">{brand}</div>
      <nav
        className={cn(
          "flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overflow-x-hidden overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          compact && "items-center",
        )}
        aria-label="Main"
      >
        {items.map((item) => {
          const active = item.match
            ? item.match(pathname)
            : pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              scroll={false}
              prefetch
              title={item.label}
              className={cn(
                "flex shrink-0 items-center gap-3 rounded-md text-sm font-medium transition-colors",
                compact ? "h-10 w-10 justify-center px-0" : "px-3 py-2.5",
                active
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground",
              )}
            >
              <span className="inline-flex shrink-0 items-center justify-center" aria-hidden>
                {item.icon}
              </span>
              {!compact ? <span>{item.label}</span> : null}
            </Link>
          );
        })}
      </nav>
      {footer ? (
        <div className={cn("shrink-0 space-y-3", compact && "w-full")}>
          {footer}
        </div>
      ) : null}
    </aside>
  );
}
