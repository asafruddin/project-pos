"use client";

import { Button } from "@pos-apps/ui/atoms";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  match?: (pathname: string) => boolean;
};

export function SideNav({
  items,
  brand,
  footer,
  className,
}: {
  items: NavItem[];
  brand?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "flex h-full w-64 shrink-0 flex-col gap-6 rounded-3xl border border-border bg-card p-5 shadow-sm",
        className,
      )}
    >
      {brand}
      <nav className="flex flex-col gap-1" aria-label="Main">
        {items.map((item) => {
          const active = item.match
            ? item.match(pathname)
            : pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition-colors",
                active
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground",
              )}
            >
              <span className="inline-flex shrink-0 items-center justify-center" aria-hidden>
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      {footer ? <div className="mt-auto space-y-3">{footer}</div> : null}
    </aside>
  );
}

/**
 * Mobile/tablet floating bottom navigation with optional center FAB.
 * Hidden on large screens when sidebar is used.
 */
export function BottomNav({
  items,
  fab,
  className,
}: {
  items: NavItem[];
  fab?: {
    label: string;
    href?: string;
    onClick?: () => void;
    icon?: React.ReactNode;
  };
  className?: string;
}) {
  const pathname = usePathname();
  const left = items.slice(0, Math.ceil(items.length / 2));
  const right = items.slice(Math.ceil(items.length / 2));

  function Item({ item }: { item: NavItem }) {
    const active = item.match
      ? item.match(pathname)
      : pathname === item.href;
    return (
      <Link
        href={item.href}
        className={cn(
          "flex min-w-[3.5rem] flex-col items-center gap-1 rounded-xl px-2 py-1 text-[11px] font-medium transition-colors",
          active ? "text-foreground" : "text-muted-foreground",
        )}
      >
        <span
          className={cn(
            "inline-flex h-9 w-9 items-center justify-center rounded-xl",
            active ? "bg-secondary" : "",
          )}
          aria-hidden
        >
          {item.icon}
        </span>
        {item.label}
      </Link>
    );
  }

  return (
    <nav
      className={cn(
        "fixed inset-x-3 bottom-3 z-40 flex items-end justify-between gap-1 rounded-[1.75rem] border border-border bg-card/95 px-2 py-2 shadow-lg backdrop-blur-md lg:hidden",
        className,
      )}
      aria-label="Main"
    >
      <div className="flex flex-1 items-end justify-around">
        {left.map((item) => (
          <Item key={item.href} item={item} />
        ))}
      </div>

      {fab ? (
        <div className="relative -mt-8 px-1">
          {fab.href ? (
            <Link
              href={fab.href}
              className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-accent text-lg font-semibold text-accent-foreground shadow-lg shadow-accent/25"
              aria-label={fab.label}
            >
              {fab.icon ?? "+"}
            </Link>
          ) : (
            <Button
              type="button"
              onClick={fab.onClick}
              className="h-14 w-14 rounded-full bg-accent text-lg font-semibold text-accent-foreground shadow-lg shadow-accent/25 hover:bg-accent/90"
              aria-label={fab.label}
            >
              {fab.icon ?? "+"}
            </Button>
          )}
        </div>
      ) : null}

      <div className="flex flex-1 items-end justify-around">
        {right.map((item) => (
          <Item key={item.href} item={item} />
        ))}
      </div>
    </nav>
  );
}
