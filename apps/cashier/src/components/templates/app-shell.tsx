"use client";

import { Button } from "@pos-apps/ui/atoms";
import {
  CalendarCheckIcon,
  CoffeeIcon,
  HouseIcon,
  ReceiptIcon,
  ShoppingCartIcon,
  SignOutIcon,
  UserCircleIcon,
} from "@phosphor-icons/react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SideNav, type NavSection } from "@/components/organisms/pos-nav";
import { OpenShiftDialog } from "@/components/organisms/open-shift-dialog";
import { PrefControls } from "@/components/molecules/settings-menu";
import { getSession } from "@/lib/auth-token";
import { requestLogout } from "@/lib/logout";
import { copy, getLang, type LangPref } from "@/lib/preferences";
import { SHIFT_CHANGED_EVENT } from "@/lib/shift-events";
import { cn } from "@/lib/utils";
import { ROLE_LABELS, type Role } from "@pos-apps/types";
import { getOpenShift } from "@pos-apps/local-db";

type AppShellProps = {
  title: string;
  subtitle?: React.ReactNode;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** Extra right column (e.g. cart on desktop). */
  aside?: React.ReactNode;
  lang?: LangPref;
  onLangChange?: () => void;
  /** Scroll target for mobile cart FAB. */
  cartAnchorId?: string;
};

export function AppShell({
  title,
  subtitle,
  headerActions,
  children,
  className,
  aside,
  lang = getLang(),
  onLangChange,
  cartAnchorId = "cart-panel",
}: AppShellProps) {
  const t = copy(lang);
  const router = useRouter();
  const pathname = usePathname();
  const [roleLabel, setRoleLabel] = useState(t.brand);
  const [needsOpenShift, setNeedsOpenShift] = useState(false);

  useEffect(() => {
    const session = getSession();
    if (session && session.role in ROLE_LABELS) {
      setRoleLabel(ROLE_LABELS[session.role as Role]);
    }
  }, [t.brand]);

  useEffect(() => {
    const skip =
      pathname.startsWith("/shift") || pathname.startsWith("/day-close");
    if (skip) {
      setNeedsOpenShift(false);
      return;
    }
    let cancelled = false;
    async function check() {
      const open = await getOpenShift();
      if (!cancelled) setNeedsOpenShift(!open);
    }
    void check();
    function onChanged() {
      void check();
    }
    window.addEventListener(SHIFT_CHANGED_EVENT, onChanged);
    return () => {
      cancelled = true;
      window.removeEventListener(SHIFT_CHANGED_EVENT, onChanged);
    };
  }, [pathname]);
  const initials = roleLabel
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  function logout() {
    void requestLogout(router);
  }

  const groups =
    lang === "en"
      ? { cashier: "Cashier", sales: "Sales", store: "Store" }
      : { cashier: "Kasir", sales: "Transaksi", store: "Toko" };

  const sections: NavSection[] = [
    {
      label: groups.cashier,
      items: [
        {
          href: "/menu",
          label: t.menuTitle,
          icon: <HouseIcon size={20} weight="duotone" />,
          match: (p) => p === "/menu" || p === "/",
        },
      ],
    },
    {
      label: groups.sales,
      items: [
        {
          href: "/transactions",
          label: t.txTitle,
          icon: <ReceiptIcon size={20} weight="duotone" />,
          match: (p) =>
            p.startsWith("/transactions") ||
            p.startsWith("/void") ||
            p.startsWith("/returns"),
        },
      ],
    },
    {
      label: groups.store,
      items: [
        {
          href: "/customers",
          label: t.customerTitle,
          icon: <UserCircleIcon size={20} weight="duotone" />,
          match: (p) => p.startsWith("/customers"),
        },
        {
          href: "/day-close",
          label: t.dayClose,
          icon: <CalendarCheckIcon size={20} weight="duotone" />,
          match: (p) => p.startsWith("/day-close"),
        },
      ],
    },
  ];

  const brand = (
    <div className="flex items-center gap-3">
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <CoffeeIcon size={22} weight="fill" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">POS Apps</p>
        <p className="truncate text-xs text-muted-foreground">{t.brand}</p>
      </div>
    </div>
  );

  return (
    <div className={cn("flex h-dvh overflow-hidden bg-background", className)}>
      <SideNav
        className="hidden h-full lg:flex"
        sections={sections}
        brand={brand}
        footer={
          <div className="space-y-2">
            <PrefControls onLangChange={onLangChange} className="w-full justify-between px-1" />
            <Button
              type="button"
              variant="ghost"
              className="h-auto w-full justify-start gap-3 rounded-xl px-3 py-2.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={logout}
            >
              <SignOutIcon size={18} weight="bold" />
              {t.logout}
            </Button>
          </div>
        }
      />

      <SideNav
        compact
        className="flex h-full lg:hidden"
        sections={sections}
        brand={
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <CoffeeIcon size={22} weight="fill" />
          </div>
        }
        footer={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="mx-auto h-10 w-10 rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={logout}
            aria-label={t.logout}
            title={t.logout}
          >
            <SignOutIcon size={18} weight="bold" />
          </Button>
        }
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex shrink-0 flex-col gap-3 border-b border-border bg-card px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:gap-6">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-semibold tracking-tight text-foreground sm:text-xl">
              {title}
            </h1>
            {subtitle ? (
              <div className="mt-0.5 hidden max-w-2xl text-sm text-muted-foreground md:block">
                {subtitle}
              </div>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            {headerActions}
            {aside ? (
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="lg:hidden"
                aria-label={t.cart}
                onClick={() => {
                  if (pathname !== "/menu") {
                    router.push("/menu");
                    return;
                  }
                  document
                    .getElementById(cartAnchorId)
                    ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                }}
              >
                <ShoppingCartIcon size={18} weight="bold" />
              </Button>
            ) : null}
            <div className="lg:hidden">
              <PrefControls onLangChange={onLangChange} tooltipSide="bottom" />
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/50 py-1 pr-3 pl-1">
              <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-xs font-semibold text-primary-foreground">
                {initials || "POS"}
              </div>
              <div className="hidden min-w-0 sm:block">
                <p className="truncate text-sm leading-tight font-medium">POS Apps</p>
                <p className="truncate text-xs text-muted-foreground">{roleLabel}</p>
              </div>
            </div>
          </div>
        </header>

        <section
          className={cn(
            "min-h-0 flex-1 p-4 sm:p-6",
            aside ? "overflow-hidden" : "overflow-y-auto",
          )}
        >
          <div
            className={cn(
              "mx-auto grid w-full max-w-[90rem] gap-5 sm:gap-6",
              aside
                ? "h-full min-h-0 md:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)] lg:grid-cols-[minmax(0,1fr)_minmax(20rem,24rem)]"
                : "",
            )}
          >
            <div
              className={cn(
                "flex min-w-0 flex-col rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)] sm:p-5",
                aside && "min-h-0 overflow-hidden",
              )}
            >
              {children}
            </div>
            {aside ? (
              <aside className="min-h-0 min-w-0 max-md:contents md:flex md:h-full md:flex-col">
                {aside}
              </aside>
            ) : null}
          </div>
        </section>
      </div>
      {needsOpenShift ? (
        <OpenShiftDialog lang={lang} onOpened={() => setNeedsOpenShift(false)} />
      ) : null}
    </div>
  );
}
