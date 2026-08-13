"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReportProductRow } from "@pos-apps/types";
import { formatIdr } from "@/lib/format-money";
import { cn } from "@/lib/utils";

export function Bar({ value, max }: { value: number; max: number }) {
  const pct = max <= 0 ? 0 : Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="h-2 overflow-hidden rounded-sm bg-secondary">
      <div className="h-2 rounded-sm bg-primary" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function ProductTable({
  rows,
  showMargin,
}: {
  rows: ReportProductRow[];
  showMargin: boolean;
}) {
  const maxUnits = Math.max(0, ...rows.map((r) => r.units));
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Tidak ada penjualan di rentang ini.</p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[20rem] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-border text-muted-foreground">
            <th className="px-3 py-2 font-medium">Produk</th>
            <th className="px-3 py-2 font-medium">Unit</th>
            <th className="px-3 py-2 font-medium">Omzet</th>
            {showMargin ? <th className="px-3 py-2 font-medium">Margin</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.product_id} className="border-b border-border/60 last:border-0">
              <td className="px-3 py-2">
                <p className="font-medium text-foreground">{row.name}</p>
                <p className="text-xs text-muted-foreground">
                  {row.status === "inactive" ? "Nonaktif (historis)" : "Aktif"}
                </p>
                <div className="mt-1 max-w-[12rem]">
                  <Bar value={row.units} max={maxUnits} />
                </div>
              </td>
              <td className="px-3 py-2">{row.units}</td>
              <td className="px-3 py-2">{formatIdr(row.revenue_minor)}</td>
              {showMargin ? (
                <td className="px-3 py-2">{formatIdr(row.margin_minor ?? 0)}</td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ReportNote({ isAdmin }: { isAdmin: boolean }) {
  return (
    <p className="text-xs text-muted-foreground">
      Store #1 · data tersinkron (bukan antrian offline kasir). Tidak mengosongkan
      Sync.
      {isAdmin ? null : " Anda hanya melihat penjualan dan refund shift sendiri, tanpa HPP."}
    </p>
  );
}

export function ReportSubnav({ showStock }: { showStock: boolean }) {
  const pathname = usePathname();
  const items = [
    { href: "/reports/ringkasan", label: "Ringkasan" },
    { href: "/reports/produk", label: "Produk" },
    { href: "/reports/kasir", label: "Kasir" },
    ...(showStock ? [{ href: "/reports/stok", label: "Stok" }] : []),
  ];
  return (
    <nav className="flex flex-wrap gap-2 md:hidden" aria-label="Submenu laporan">
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            scroll={false}
            className={cn(
              "inline-flex h-9 items-center rounded-md px-3 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:opacity-90",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
