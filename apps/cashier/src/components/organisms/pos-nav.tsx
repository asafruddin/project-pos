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

export type NavSection = {
  label: string;
  items: NavItem[];
};

export function SideNav({
  sections,
  brand,
  footer,
  className,
  compact = false,
}: {
  sections: NavSection[];
  brand?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  compact?: boolean;
}) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "flex shrink-0 flex-col overflow-hidden border-r border-border bg-card",
        compact ? "w-[4.5rem] items-center px-2 py-3" : "w-60 px-3 py-4 sm:w-64 sm:px-4",
        className,
      )}
    >
      <div className={cn("shrink-0", compact ? "mb-3" : "mb-5 px-1")}>{brand}</div>
      <nav
        className={cn(
          "flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          compact ? "items-center gap-3" : "gap-4",
        )}
        aria-label="Main"
      >
        {sections.map((section) => (
          <div
            key={section.label}
            className={cn("flex flex-col", compact ? "items-center gap-1" : "gap-1")}
          >
            {!compact ? (
              <p className="px-3 pb-1 text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                {section.label}
              </p>
            ) : null}
            {section.items.map((item) => {
              const current = item.match
                ? item.match(pathname)
                : pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.label}
                  className={cn(
                    "flex items-center gap-3 text-sm font-medium transition-colors",
                    compact
                      ? cn(
                          "h-10 w-10 justify-center rounded-xl px-0",
                          current
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                        )
                      : cn(
                          "rounded-xl px-3 py-2.5",
                          current
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                        ),
                  )}
                >
                  <span className="inline-flex shrink-0 items-center justify-center" aria-hidden>
                    {item.icon}
                  </span>
                  {!compact ? <span className="min-w-0 truncate">{item.label}</span> : null}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      {footer ? (
        <div className={cn("mt-3 shrink-0", compact && "w-full")}>{footer}</div>
      ) : null}
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
    const active = item.match ? item.match(pathname) : pathname === item.href;
    return (
      <Link
        href={item.href}
        className={cn(
          "flex min-w-[3.5rem] flex-col items-center gap-1 rounded-xl px-2 py-1 text-[11px] font-medium transition-colors",
          active ? "text-primary" : "text-muted-foreground",
        )}
      >
        <span
          className={cn(
            "inline-flex h-9 w-9 items-center justify-center rounded-xl",
            active ? "bg-primary text-primary-foreground" : "",
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
        "fixed inset-x-3 bottom-3 z-40 flex items-end justify-between gap-1 rounded-2xl border border-border bg-card/95 px-2 py-2 shadow-[var(--shadow-card)] backdrop-blur-md lg:hidden",
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
              className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary text-lg font-semibold text-primary-foreground shadow-lg shadow-primary/25"
              aria-label={fab.label}
            >
              {fab.icon ?? "+"}
            </Link>
          ) : (
            <Button
              type="button"
              onClick={fab.onClick}
              className="h-14 w-14 rounded-full shadow-lg shadow-primary/25"
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
