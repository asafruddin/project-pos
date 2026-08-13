"use client";

import {
  ArrowUDownLeftIcon,
  ChartBarIcon,
  ChartLineUpIcon,
  ClipboardTextIcon,
  ClockCountdownIcon,
  CoffeeIcon,
  PackageIcon,
  PercentIcon,
  SignOutIcon,
  StarIcon,
  TruckIcon,
  UserCircleIcon,
  UsersThreeIcon,
  WarehouseIcon,
  BuildingsIcon,
  ArrowsLeftRightIcon,
} from "@phosphor-icons/react";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { hasPermission, ROLE_LABELS, type Role } from "@pos-apps/types";
import { SideNav } from "@/components/pos-nav";
import { Button } from "@/components/ui/button";
import { clearSession } from "@/lib/auth-token";

const PAGE_COPY: Record<string, { title: string; subtitle: string }> = {
  "/": {
    title: "Stok / Produk",
    subtitle:
      "Kelola katalog toko. Harga dalam Rupiah penuh (mis. 15000 = Rp15.000).",
  },
  "/stock": {
    title: "Ikhtisar stok",
    subtitle:
      "Jumlah dijual dan rusak dari buku besar. Kasir tetap bisa menjual meski stok habis.",
  },
  "/stores": {
    title: "Toko",
    subtitle:
      "Store #1 tetap toko awal. Harga toko menimpa harga katalog setelah kasir menyegarkan menu.",
  },
  "/transfers": {
    title: "Transfer stok",
    subtitle:
      "Draft → requested → approved → preparing → shipped → received. Stok baru pindah saat dikirim/diterima. Checkout tidak berubah.",
  },
  "/opname": {
    title: "Opname stok",
    subtitle: "Hitung fisik, lihat selisih, lalu setujui. Draf tidak mengubah stok.",
  },
  "/purchasing": {
    title: "Pembelian",
    subtitle:
      "Pemasok, pesanan, dan penerimaan barang. Faktur tidak wajib lunas untuk menyelesaikan stok.",
  },
  "/sales": {
    title: "Penjualan",
    subtitle:
      "Ringkasan penjualan yang sudah tersinkron dari kasir (bukan data offline lokal).",
  },
  "/reports": {
    title: "Laporan",
    subtitle:
      "Analitik online dari penjualan tersinkron. Kasir hanya melihat ringkasan terbatas dan kinerjanya sendiri. HPP memakai harga modal produk.",
  },
  "/returns": {
    title: "Retur",
    subtitle:
      "Retur online-first. Refund tunai hanya admin katalog (kasir ditolak API).",
  },
  "/customers": {
    title: "Pelanggan",
    subtitle:
      "Profil, grup, kredit toko, dan harga pelanggan. Kasir tidak dapat menghapus atau mengubah kredit/harga. Penjualan tanpa pelanggan tetap sah.",
  },
  "/loyalty": {
    title: "Loyalitas",
    subtitle:
      "Aturan poin bersama. Kasir tidak mengubah aturan. Tukar poin hanya saat online; penjualan tetap selesai jika program mati.",
  },
  "/promotions": {
    title: "Promo",
    subtitle:
      "Persen/nominal, kupon, jam happy hour, dan voucher. Kasir tidak mengubah aturan. Penjualan tetap selesai jika promo mati.",
  },
  "/shifts": {
    title: "Shift",
    subtitle:
      "Tinjau shift tertutup dan selisih kas. Kasir tidak dapat mengubah shift tertutup. Tutup shift tidak mengosongkan Sync.",
  },
  "/employees": {
    title: "Karyawan",
    subtitle:
      "Pengguna, peran, dan matriks izin. Perubahan izin berlaku pada permintaan API berikutnya.",
  },
  "/products/new": {
    title: "Tambah produk",
    subtitle: "Isi detail katalog. Harga dalam Rupiah penuh (mis. 15000 = Rp15.000).",
  },
};

function pageCopy(pathname: string): { title: string; subtitle: string } {
  if (/^\/products\/[^/]+\/edit$/.test(pathname)) {
    return {
      title: "Ubah produk",
      subtitle: "Perbarui nama, harga, stok, atau gambar, lalu simpan.",
    };
  }
  return PAGE_COPY[pathname] ?? { title: "Dashboard", subtitle: "" };
}

function roleLabel(role: string) {
  if (role in ROLE_LABELS) return ROLE_LABELS[role as Role];
  return role;
}

/**
 * Persistent chrome: sidebar stays mounted and does not scroll with page content.
 */
export function DashboardShell({
  role,
  permissions,
  children,
}: {
  role: string;
  permissions?: string[];
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const copy = pageCopy(pathname);

  function logout() {
    clearSession();
    router.replace("/login");
  }

  function can(resource: string, action: string) {
    if (Array.isArray(permissions)) {
      return hasPermission(permissions, resource, action);
    }
    if (resource === "users") return role === "catalog_admin" || role === "owner";
    if (resource === "purchases" || resource === "inventory") {
      return role === "catalog_admin" || role === "owner" || role === "store_manager";
    }
    return true;
  }

  const nav = [
    {
      href: "/",
      label: "Stok / Produk",
      icon: <PackageIcon size={20} weight="duotone" />,
      show: can("products", "view"),
      match: (pathname: string) =>
        pathname === "/" || pathname.startsWith("/products"),
    },
    {
      href: "/stock",
      label: "Ikhtisar stok",
      icon: <WarehouseIcon size={20} weight="duotone" />,
      show: can("inventory", "view"),
    },
    {
      href: "/stores",
      label: "Toko",
      icon: <BuildingsIcon size={20} weight="duotone" />,
      show: can("stores", "view"),
    },
    {
      href: "/transfers",
      label: "Transfer stok",
      icon: <ArrowsLeftRightIcon size={20} weight="duotone" />,
      show: can("transfers", "view"),
    },
    {
      href: "/opname",
      label: "Opname stok",
      icon: <ClipboardTextIcon size={20} weight="duotone" />,
      show: can("inventory", "view"),
    },
    {
      href: "/purchasing",
      label: "Pembelian",
      icon: <TruckIcon size={20} weight="duotone" />,
      show: can("purchases", "view"),
    },
    {
      href: "/sales",
      label: "Penjualan",
      icon: <ChartLineUpIcon size={20} weight="duotone" />,
      show: can("sales", "view") || can("reports", "view"),
    },
    {
      href: "/reports",
      label: "Laporan",
      icon: <ChartBarIcon size={20} weight="duotone" />,
      show: can("reports", "view"),
    },
    {
      href: "/returns",
      label: "Retur",
      icon: <ArrowUDownLeftIcon size={20} weight="duotone" />,
      show: can("returns", "view"),
    },
    {
      href: "/customers",
      label: "Pelanggan",
      icon: <UserCircleIcon size={20} weight="duotone" />,
      show: can("customers", "view"),
    },
    {
      href: "/loyalty",
      label: "Loyalitas",
      icon: <StarIcon size={20} weight="duotone" />,
      show: can("loyalty", "view"),
    },
    {
      href: "/promotions",
      label: "Promo",
      icon: <PercentIcon size={20} weight="duotone" />,
      show: can("promotions", "view"),
    },
    {
      href: "/shifts",
      label: "Shift",
      icon: <ClockCountdownIcon size={20} weight="duotone" />,
      show: can("shifts", "view"),
    },
    {
      href: "/employees",
      label: "Karyawan",
      icon: <UsersThreeIcon size={20} weight="duotone" />,
      show: can("users", "view"),
    },
  ].filter((item) => item.show);

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <div className="mx-auto flex h-full w-full max-w-[90rem] gap-3 p-3 sm:gap-4 sm:p-4 lg:gap-5 lg:p-6">
        <SideNav
          className="hidden h-full md:flex"
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
              <p className="rounded-md border border-border bg-background/70 px-3 py-2 text-xs text-muted-foreground">
                Peran:{" "}
                <span className="font-medium text-foreground">
                  {roleLabel(role)}
                </span>
              </p>
              <Button
                type="button"
                className="w-full rounded-md bg-secondary text-secondary-foreground hover:opacity-90"
                onClick={logout}
              >
                Keluar
              </Button>
            </>
          }
        />

        <SideNav
          compact
          className="flex h-full md:hidden"
          items={nav}
          brand={
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-secondary text-accent">
              <CoffeeIcon size={22} weight="fill" />
            </div>
          }
          footer={
            <Button
              type="button"
              className="h-11 w-11 rounded-md bg-secondary p-0 text-secondary-foreground hover:opacity-90"
              onClick={logout}
              aria-label="Keluar"
              title="Keluar"
            >
              <SignOutIcon size={20} weight="bold" />
            </Button>
          }
        />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-hidden">
          <header className="shrink-0 rounded-lg border border-border bg-card px-4 py-4 shadow-sm sm:px-5">
            <p className="text-sm text-muted-foreground md:hidden">
              {roleLabel(role)}
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {copy.title}
            </h1>
            {copy.subtitle ? (
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                {copy.subtitle}
              </p>
            ) : null}
          </header>

          <section className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-border bg-card p-4 shadow-sm sm:p-6">
            <div className="flex flex-col gap-5 sm:gap-6">{children}</div>
          </section>
        </div>
      </div>
    </div>
  );
}
