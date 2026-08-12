"use client";

import {
  ChartLineUpIcon,
  CoffeeIcon,
  PackageIcon,
  SignOutIcon,
} from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { AuthLoadingShell } from "@/components/auth-shell";
import { SideNav } from "@/components/pos-nav";
import { Button } from "@/components/ui/button";
import { clearSession } from "@/lib/auth-token";

function roleLabel(role: string) {
  if (role === "catalog_admin") return "Admin katalog";
  if (role === "cashier") return "Kasir";
  return role;
}

/**
 * Dashboard keeps a sidebar at all breakpoints (compact icons on narrow screens).
 */
export function DashboardShell({
  role,
  title,
  subtitle,
  children,
}: {
  role: string;
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
}) {
  const router = useRouter();

  function logout() {
    clearSession();
    router.replace("/login");
  }

  const nav = [
    {
      href: "/",
      label: "Stok / Produk",
      icon: <PackageIcon size={20} weight="duotone" />,
    },
    {
      href: "/sales",
      label: "Penjualan",
      icon: <ChartLineUpIcon size={20} weight="duotone" />,
    },
  ];

  return (
    <div className="relative flex min-h-dvh flex-1 bg-background">
      <div className="mx-auto flex w-full max-w-[90rem] flex-1 gap-3 p-3 sm:gap-4 sm:p-4 lg:gap-5 lg:p-6">
        <SideNav
          className="hidden md:flex"
          items={nav}
          brand={
            <div className="flex items-center gap-3">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-secondary text-accent">
                <CoffeeIcon size={22} weight="fill" />
              </div>
              <div>
                <p className="text-xs font-semibold tracking-[0.16em] text-foreground uppercase">
                  POS Apps
                </p>
                <p className="text-sm text-muted-foreground">Dashboard</p>
              </div>
            </div>
          }
          footer={
            <>
              <p className="rounded-2xl border border-border bg-background/70 px-3 py-2 text-xs text-muted-foreground">
                Peran:{" "}
                <span className="font-medium text-foreground">
                  {roleLabel(role)}
                </span>
              </p>
              <Button
                type="button"
                className="w-full rounded-2xl bg-secondary text-secondary-foreground hover:opacity-90"
                onClick={logout}
              >
                Keluar
              </Button>
            </>
          }
        />

        <SideNav
          compact
          className="flex md:hidden"
          items={nav}
          brand={
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-secondary text-accent">
              <CoffeeIcon size={22} weight="fill" />
            </div>
          }
          footer={
            <Button
              type="button"
              className="h-11 w-11 rounded-2xl bg-secondary p-0 text-secondary-foreground hover:opacity-90"
              onClick={logout}
              aria-label="Keluar"
              title="Keluar"
            >
              <SignOutIcon size={20} weight="bold" />
            </Button>
          }
        />

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <header className="rounded-3xl border border-border bg-card px-4 py-4 shadow-sm sm:px-5">
            <p className="text-sm text-muted-foreground md:hidden">
              {roleLabel(role)}
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {title}
            </h1>
            {subtitle ? (
              <div className="mt-1 max-w-2xl text-sm text-muted-foreground">
                {subtitle}
              </div>
            ) : null}
          </header>

          <section className="flex flex-1 flex-col gap-5 rounded-3xl border border-border bg-card p-4 shadow-sm sm:gap-6 sm:p-6">
            {children}
          </section>
        </div>
      </div>
    </div>
  );
}

export function DashboardLoading({ message = "Memuat…" }: { message?: string }) {
  return <AuthLoadingShell message={message} />;
}
