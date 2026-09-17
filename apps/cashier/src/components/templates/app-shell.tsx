"use client";

import { Button } from "@pos-apps/ui/atoms";
import {
  CalendarCheckIcon,
  HouseIcon,
  ReceiptIcon,
  ShoppingCartIcon,
  SignOutIcon,
  UserCircleIcon,
} from "@phosphor-icons/react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BottomNav, SideNav, type NavSection } from "@/components/organisms/pos-nav";
import { OpenShiftDialog } from "@/components/organisms/open-shift-dialog";
import { PrefControls } from "@/components/molecules/settings-menu";
import { getSession, getStoreIdentity } from "@/lib/auth-token";
import { useStoreLogoSrc } from "@/lib/use-store-logo";
import { requestLogout } from "@/lib/logout";
import { toggleCashierCart } from "@/lib/cart-events";
import { copy, getLang, type LangPref } from "@/lib/preferences";
import { SHIFT_CHANGED_EVENT } from "@/lib/shift-events";
import { cn } from "@/lib/utils";
import { ROLE_LABELS, type Role } from "@pos-apps/types";
import { getOpenShift } from "@pos-apps/local-db";
import { StoreLogo } from "@pos-apps/ui/molecules";
import { useCart } from "@/components/providers/cart-context";

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
}: AppShellProps) {
  const t = copy(lang);
  const router = useRouter();
  const pathname = usePathname();
  const { lines } = useCart();
  const cartCount = lines.reduce((sum, line) => sum + line.qty, 0);
  const [storeName, setStoreName] = useState("POS Apps");
  const [storeLogoUrl, setStoreLogoUrl] = useState<string | null>(null);
  const storeLogoSrc = useStoreLogoSrc(storeLogoUrl);
  const [roleLabel, setRoleLabel] = useState(t.brand);
  const [needsOpenShift, setNeedsOpenShift] = useState(false);

  useEffect(() => {
    const identity = getStoreIdentity();
    setStoreName(identity.storeName);
    setStoreLogoUrl(identity.storeLogoUrl);
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
      <StoreLogo src={storeLogoSrc} alt={storeName} />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">{storeName}</p>
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
                className="relative lg:hidden"
                aria-label={t.cart}
                onClick={() => {
                  if (pathname !== "/menu") {
                    router.push("/menu");
                    return;
                  }
                  toggleCashierCart();
                }}
              >
                <ShoppingCartIcon size={18} weight="bold" />
                {cartCount > 0 ? (
                  <span className="absolute -top-1 -right-1 min-w-4 rounded-full bg-primary px-1 text-center text-[10px] font-bold leading-4 text-primary-foreground">
                    {cartCount > 99 ? "99+" : cartCount}
                  </span>
                ) : null}
              </Button>
            ) : null}
            <div className="flex items-center gap-1 lg:hidden">
              <PrefControls onLangChange={onLangChange} tooltipSide="bottom" />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={logout}
                aria-label={t.logout}
                title={t.logout}
              >
                <SignOutIcon size={18} weight="bold" />
              </Button>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/50 py-1 pr-3 pl-1">
              {storeLogoSrc ? (
                <StoreLogo src={storeLogoSrc} alt={storeName} size="sm" />
              ) : (
                <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-xs font-semibold text-primary-foreground">
                  {initials || "POS"}
                </div>
              )}
              <div className="hidden min-w-0 sm:block">
                <p className="truncate text-sm leading-tight font-medium">{storeName}</p>
                <p className="truncate text-xs text-muted-foreground">{roleLabel}</p>
              </div>
            </div>
          </div>
        </header>

        <section
          className={cn(
            "min-h-0 flex-1 p-3 pb-[calc(5.25rem+env(safe-area-inset-bottom))] sm:p-5 sm:pb-[calc(5.25rem+env(safe-area-inset-bottom))] lg:p-6",
            aside &&
              "max-md:pb-[calc(9.5rem+env(safe-area-inset-bottom))] md:pb-5 lg:pb-6",
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
                "flex min-w-0 flex-col rounded-xl border border-border bg-card p-3 shadow-[var(--shadow-card)] sm:p-5",
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
      <BottomNav items={sections.flatMap((section) => section.items)} />
      {needsOpenShift ? (
        <OpenShiftDialog lang={lang} onOpened={() => setNeedsOpenShift(false)} />
      ) : null}
    </div>
  );
}
