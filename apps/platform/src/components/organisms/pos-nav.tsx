"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Button } from "@pos-apps/ui/atoms";
import { CaretDownIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

export type NavChild = {
  href: string;
  label: string;
};

export type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  match?: (pathname: string) => boolean;
  children?: NavChild[];
};

export type NavSection = {
  label: string;
  items: NavItem[];
};

/** Dashboard always uses sidebar (desktop + tablet + mobile). */
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
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  function isOpen(href: string, fallback: boolean) {
    return href in expanded ? expanded[href] : fallback;
  }

  function toggleOpen(href: string, fallback: boolean) {
    setExpanded((prev) => ({
      ...prev,
      [href]: !(href in prev ? prev[href] : fallback),
    }));
  }

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
              const active = item.match
                ? item.match(pathname)
                : pathname === item.href;
              const childActive = item.children?.some(
                (child) =>
                  pathname === child.href || pathname.startsWith(`${child.href}/`),
              );
              const hasChildren = Boolean(!compact && item.children?.length);
              const open = hasChildren && isOpen(item.href, Boolean(childActive));
              const current = active || childActive;
              const submenuId = `nav-sub-${item.href.replace(/\W+/g, "-")}`;
              return (
                <div
                  key={item.href}
                  className={cn("flex flex-col", compact && "items-center")}
                >
                  <div
                    className={cn(
                      "flex items-center",
                      compact ? "justify-center" : "rounded-xl",
                      !compact && current && "bg-primary text-primary-foreground shadow-sm",
                      !compact &&
                        !current &&
                        "text-muted-foreground hover:bg-secondary hover:text-foreground",
                    )}
                  >
                    <Link
                      href={item.href}
                      scroll={false}
                      prefetch
                      title={item.label}
                      onClick={() => {
                        if (hasChildren) {
                          setExpanded((prev) => ({ ...prev, [item.href]: true }));
                        }
                      }}
                      className={cn(
                        "flex min-w-0 flex-1 items-center gap-3 text-sm font-medium transition-colors",
                        compact
                          ? cn(
                              "h-10 w-10 justify-center rounded-xl px-0",
                              current
                                ? "bg-primary text-primary-foreground shadow-sm"
                                : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                            )
                          : "rounded-xl px-3 py-2.5",
                      )}
                    >
                      <span className="inline-flex shrink-0 items-center justify-center" aria-hidden>
                        {item.icon}
                      </span>
                      {!compact ? (
                        <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      ) : null}
                    </Link>
                    {hasChildren ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className={cn(
                          "mr-1 h-8 w-8 shrink-0 rounded-lg",
                          current
                            ? "hover:bg-primary-foreground/15"
                            : "hover:bg-foreground/5",
                        )}
                        aria-expanded={open}
                        aria-controls={submenuId}
                        aria-label={open ? `Sembunyikan ${item.label}` : `Tampilkan ${item.label}`}
                        onClick={() => toggleOpen(item.href, Boolean(childActive))}
                      >
                        <CaretDownIcon
                          size={14}
                          weight="bold"
                          className={cn(
                            "transition-transform duration-200",
                            open && "rotate-180",
                          )}
                        />
                      </Button>
                    ) : null}
                  </div>
                  {hasChildren ? (
                    <div
                      id={submenuId}
                      className={cn(
                        "grid transition-[grid-template-rows] duration-200 ease-out",
                        open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                      )}
                    >
                      <div className="overflow-hidden">
                        <div className="mt-1 mb-1 ml-5 flex flex-col border-l border-border pl-2">
                          {item.children?.map((child) => {
                            const childIsActive =
                              pathname === child.href ||
                              pathname.startsWith(`${child.href}/`);
                            return (
                              <Link
                                key={child.href}
                                href={child.href}
                                scroll={false}
                                prefetch
                                className={cn(
                                  "rounded-lg px-2 py-1.5 text-xs font-medium transition-colors",
                                  childIsActive
                                    ? "bg-accent text-accent-foreground"
                                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                                )}
                              >
                                {child.label}
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
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
