"use client";

import { Button, Input } from "@pos-apps/ui/atoms";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { MagnifyingGlassIcon } from "@phosphor-icons/react";
import { ThemeToggle } from "@/components/molecules/theme-toggle";
import { cn } from "@/lib/utils";

export type HeaderSearchItem = {
  href: string;
  label: string;
};

export function DashboardHeader({
  title,
  subtitle,
  roleLabel,
  searchItems,
}: {
  title: string;
  subtitle?: string;
  roleLabel: string;
  searchItems: HeaderSearchItem[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return searchItems
      .filter((item) => item.label.toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, searchItems]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (e.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    setQuery("");
    setOpen(false);
  }, [pathname]);

  function go(href: string) {
    setQuery("");
    setOpen(false);
    router.push(href, { scroll: false });
  }

  const initials = roleLabel
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <header className="flex shrink-0 flex-col gap-3 border-b border-border bg-card px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:gap-6">
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-lg font-semibold tracking-tight text-foreground sm:text-xl">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-0.5 hidden max-w-2xl truncate text-sm text-muted-foreground md:block">
            {subtitle}
          </p>
        ) : null}
      </div>

      <div className="relative min-w-0 flex-1 lg:max-w-md">
        <MagnifyingGlassIcon
          size={16}
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && matches[0]) go(matches[0].href);
          }}
          placeholder="Cari menu…"
          className="h-10 min-h-10 rounded-xl border-border bg-muted/70 pl-9 pr-16"
          aria-label="Cari menu"
        />
        <kbd className="pointer-events-none absolute top-1/2 right-2 hidden -translate-y-1/2 rounded-md border border-border bg-card px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-flex">
          ⌘K
        </kbd>
        {open && matches.length > 0 ? (
          <ul className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-border bg-popover py-1 shadow-[var(--shadow-card)]">
            {matches.map((item) => (
              <li key={item.href}>
                <Button
                  type="button"
                  variant="ghost"
                  className={cn(
                    "h-auto w-full justify-start rounded-none px-3 py-2 text-sm",
                    pathname === item.href && "text-primary",
                  )}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => go(item.href)}
                >
                  {item.label}
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="flex items-center justify-end gap-2">
        <ThemeToggle />
        <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/50 py-1 pr-3 pl-1">
          <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-xs font-semibold text-primary-foreground">
            {initials || "POS"}
          </div>
          <div className="hidden min-w-0 sm:block">
            <p className="truncate text-sm font-medium leading-tight">POS Apps</p>
            <p className="truncate text-xs text-muted-foreground">{roleLabel}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
