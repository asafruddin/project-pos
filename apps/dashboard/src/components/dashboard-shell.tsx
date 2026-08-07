"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { clearSession } from "@/lib/auth-token";
import { cn } from "@/lib/utils";

export function DashboardShell({
  role,
  children,
}: {
  role: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  function logout() {
    clearSession();
    router.replace("/login");
  }

  const nav = [
    { href: "/", label: "Stok / Produk" },
    { href: "/sales", label: "Penjualan" },
  ];

  return (
    <div className="flex min-h-full flex-1">
      <aside className="hidden w-56 shrink-0 flex-col gap-4 border-r border-border bg-muted/30 p-6 md:flex">
        <p className="text-sm font-medium text-accent">Dashboard</p>
        <nav className="flex flex-col gap-1">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                pathname === item.href
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground hover:bg-muted",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <p className="text-xs text-muted-foreground">{role}</p>
        <Button type="button" className="mt-auto" onClick={logout}>
          Keluar
        </Button>
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-border p-4 md:hidden">
          <nav className="flex gap-2 text-sm">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-md px-2 py-1",
                  pathname === item.href
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <Button type="button" onClick={logout}>
            Keluar
          </Button>
        </header>
        <main className="flex flex-1 flex-col gap-6 p-8">{children}</main>
      </div>
    </div>
  );
}
