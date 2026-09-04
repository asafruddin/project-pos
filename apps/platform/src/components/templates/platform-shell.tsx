"use client";

import {
  HouseIcon,
  SignOutIcon,
  ShieldCheckIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Button } from "@pos-apps/ui/atoms";
import { PLATFORM_ROLE_LABELS, type PlatformRole } from "@pos-apps/types";
import { DashboardHeader } from "@/components/organisms/dashboard-header";
import { SideNav, type NavSection } from "@/components/organisms/pos-nav";
import { clearSession } from "@/lib/auth-token";

const PAGE_COPY: Record<string, { title: string; subtitle: string }> = {
  "/": {
    title: "Beranda",
    subtitle: "Konsol operator. Kelola akun sistem, bukan toko.",
  },
  "/operators": {
    title: "Operator",
    subtitle: "Akun Super Admin yang masuk ke konsol ini.",
  },
  "/operators/new": {
    title: "Tambah operator",
    subtitle: "Operator baru dapat masuk ke konsol platform.",
  },
  "/accounts": {
    title: "Akun POS",
    subtitle: "Pengguna toko (Owner, Admin, kasir, dan staf) di deployment ini.",
  },
  "/accounts/new": {
    title: "Tambah akun POS",
    subtitle: "Operator dapat menetapkan peran Owner.",
  },
};

function pageCopy(pathname: string): { title: string; subtitle: string } {
  if (PAGE_COPY[pathname]) return PAGE_COPY[pathname];
  if (/^\/operators\/[^/]+\/edit$/.test(pathname)) {
    return {
      title: "Ubah operator",
      subtitle: "Nonaktifkan atau atur ulang password.",
    };
  }
  if (/^\/accounts\/[^/]+\/edit$/.test(pathname)) {
    return {
      title: "Ubah akun POS",
      subtitle: "Peran, toko, status, dan password.",
    };
  }
  return { title: "Platform", subtitle: "" };
}

function navMatches(href: string, pathname: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function roleLabel(role: string) {
  if (role in PLATFORM_ROLE_LABELS) {
    return PLATFORM_ROLE_LABELS[role as PlatformRole];
  }
  return role;
}

export function PlatformShell({
  role,
  children,
}: {
  role: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const copy = pageCopy(pathname);

  function logout() {
    clearSession();
    router.replace("/login");
  }

  const nav = [
    {
      group: "Menu",
      href: "/",
      label: "Beranda",
      icon: <HouseIcon size={20} weight="regular" />,
      match: (path: string) => path === "/",
    },
    {
      group: "Akun",
      href: "/operators",
      label: "Operator",
      icon: <ShieldCheckIcon size={20} weight="regular" />,
    },
    {
      group: "Akun",
      href: "/accounts",
      label: "Akun POS",
      icon: <UsersThreeIcon size={20} weight="regular" />,
    },
  ].map((item) => ({
    ...item,
    match: item.match ?? ((path: string) => navMatches(item.href, path)),
  }));

  const groupOrder = ["Menu", "Akun"];
  const sections: NavSection[] = groupOrder
    .map((label) => ({
      label,
      items: nav.filter((item) => item.group === label),
    }))
    .filter((section) => section.items.length > 0);

  const searchItems = nav.map((item) => ({
    href: item.href,
    label: item.label,
  }));

  const brand = (
    <div className="flex items-center gap-3">
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <ShieldCheckIcon size={22} weight="fill" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">POS Apps</p>
        <p className="truncate text-xs text-muted-foreground">Platform</p>
      </div>
    </div>
  );

  const logoutButton = (
    <Button
      type="button"
      variant="ghost"
      className="h-auto w-full justify-start gap-3 rounded-xl px-3 py-2.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
      onClick={logout}
    >
      <SignOutIcon size={18} weight="bold" />
      Keluar
    </Button>
  );

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <SideNav
        className="hidden h-full md:flex"
        sections={sections}
        brand={brand}
        footer={logoutButton}
      />

      <SideNav
        compact
        className="flex h-full md:hidden"
        sections={sections}
        brand={
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <ShieldCheckIcon size={22} weight="fill" />
          </div>
        }
        footer={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="mx-auto h-10 w-10 rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={logout}
            aria-label="Keluar"
            title="Keluar"
          >
            <SignOutIcon size={18} weight="bold" />
          </Button>
        }
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <DashboardHeader
          title={copy.title}
          subtitle={copy.subtitle}
          roleLabel={roleLabel(role)}
          searchItems={searchItems}
        />
        <section className="flex min-h-0 flex-1 flex-col overflow-hidden p-4 sm:p-6">
          <div className="mx-auto flex h-full min-h-0 w-full max-w-[90rem] flex-col overflow-y-auto overscroll-contain">
            {children}
          </div>
        </section>
      </div>
    </div>
  );
}
