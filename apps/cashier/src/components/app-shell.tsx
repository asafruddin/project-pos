"use client";

import {
  ArrowUDownLeftIcon,
  ArrowUUpLeftIcon,
  CalendarCheckIcon,
  ClockCountdownIcon,
  CoffeeIcon,
  HouseIcon,
  ShoppingCartIcon,
  UserCircleIcon,
} from "@phosphor-icons/react";
import { usePathname, useRouter } from "next/navigation";
import { BottomNav, SideNav } from "@/components/pos-nav";
import { PrefControls } from "@/components/settings-menu";
import { Button } from "@/components/ui/button";
import { clearSession } from "@/lib/auth-token";
import { clearPinUnlock } from "@/lib/pin-session";
import { copy, getLang, type LangPref } from "@/lib/preferences";
import { cn } from "@/lib/utils";

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

  function logout() {
    clearSession();
    clearPinUnlock();
    router.replace("/login");
  }

  const navItems = [
    {
      href: "/menu",
      label: t.menuTitle,
      icon: <HouseIcon size={20} weight="duotone" />,
      match: (p: string) => p === "/menu" || p === "/",
    },
    {
      href: "/shift",
      label: t.shiftTitle,
      icon: <ClockCountdownIcon size={20} weight="duotone" />,
      match: (p: string) => p.startsWith("/shift"),
    },
    {
      href: "/void",
      label: t.voidTitle,
      icon: <ArrowUUpLeftIcon size={20} weight="duotone" />,
      match: (p: string) => p.startsWith("/void"),
    },
    {
      href: "/returns",
      label: t.returnTitle,
      icon: <ArrowUDownLeftIcon size={20} weight="duotone" />,
      match: (p: string) => p.startsWith("/returns"),
    },
    {
      href: "/customers",
      label: t.customerTitle,
      icon: <UserCircleIcon size={20} weight="duotone" />,
      match: (p: string) => p.startsWith("/customers"),
    },
    {
      href: "/day-close",
      label: t.dayClose,
      icon: <CalendarCheckIcon size={20} weight="duotone" />,
      match: (p: string) => p.startsWith("/day-close"),
    },
  ];

  return (
    <div className={cn("relative flex min-h-dvh flex-1 bg-background", className)}>
      <div className="mx-auto flex w-full max-w-[90rem] flex-1 gap-4 p-3 pb-28 sm:p-4 sm:pb-28 lg:gap-5 lg:p-6 lg:pb-6">
        <div className="hidden lg:flex">
          <SideNav
            items={navItems}
            brand={
              <div className="flex items-center gap-3">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-secondary text-accent">
                  <CoffeeIcon size={22} weight="fill" />
                </div>
                <div>
                  <p className="text-xs font-semibold tracking-[0.16em] text-foreground uppercase">
                    POS Apps
                  </p>
                  <p className="text-sm text-muted-foreground">{t.brand}</p>
                </div>
              </div>
            }
            footer={
              <>
                <PrefControls
                  onLangChange={onLangChange}
                  className="w-full justify-between"
                />
                <Button
                  type="button"
                  className="w-full bg-secondary text-secondary-foreground hover:opacity-90"
                  onClick={logout}
                >
                  {t.logout}
                </Button>
              </>
            }
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <header className="flex items-start justify-between gap-3 rounded-3xl border border-border bg-card px-4 py-4 shadow-sm sm:px-5">
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground lg:hidden">
                {t.brand}
              </p>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                {title}
              </h1>
              {subtitle ? (
                <div className="mt-1 text-sm text-muted-foreground">
                  {subtitle}
                </div>
              ) : null}
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              {headerActions}
              <div className="lg:hidden">
                <PrefControls
                  onLangChange={onLangChange}
                  tooltipSide="bottom"
                />
              </div>
            </div>
          </header>

          <div
            className={cn(
              "grid flex-1 gap-4",
              aside
                ? "md:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)] lg:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)]"
                : "",
            )}
          >
            <section className="min-w-0 rounded-3xl border border-border bg-card p-4 shadow-sm sm:p-5">
              {children}
            </section>
            {aside ? (
              <aside className="min-w-0 max-md:contents md:sticky md:top-4 md:self-start">
                {aside}
              </aside>
            ) : null}
          </div>
        </div>
      </div>

      <BottomNav
        items={navItems}
        fab={{
          label: t.cart,
          icon: <ShoppingCartIcon size={24} weight="fill" />,
          onClick: () => {
            if (pathname !== "/menu") {
              router.push("/menu");
              return;
            }
            document
              .getElementById(cartAnchorId)
              ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
          },
        }}
      />
    </div>
  );
}
