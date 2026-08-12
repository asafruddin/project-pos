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
        "flex shrink-0 flex-col gap-4 rounded-3xl border border-border bg-card p-3 shadow-sm sm:gap-6 sm:p-5",
        compact ? "w-[4.5rem] items-center" : "w-56 sm:w-64",
        className,
      )}
    >
      {brand}
      <nav
        className={cn("flex flex-col gap-1", compact && "items-center")}
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
              title={item.label}
              className={cn(
                "flex items-center gap-3 rounded-2xl text-sm font-medium transition-colors",
                compact ? "h-11 w-11 justify-center px-0" : "px-3 py-3",
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
        <div className={cn("mt-auto space-y-3", compact && "w-full")}>
          {footer}
        </div>
      ) : null}
    </aside>
  );
}
