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
    subtitle: "Isi nama dan harga dulu. Detail lain opsional.",
  },
  "/customers/new": {
    title: "Tambah pelanggan",
    subtitle: "Nama wajib. Telepon, email, dan catatan opsional.",
  },
  "/employees/new": {
    title: "Tambah karyawan",
    subtitle: "Toko mengikuti akun, bukan Checkout.",
  },
  "/employees/roles": {
    title: "Matriks izin",
    subtitle:
      "Satu izin per baris (resource:action). Berlaku pada permintaan API berikutnya.",
  },
  "/loyalty/program": {
    title: "Program loyalitas",
    subtitle: "Aturan poin bersama. Kasir tidak mengubah aturan.",
  },
  "/opname/new": {
    title: "Opname baru",
    subtitle: "Pilih produk. Draf tidak mengubah stok sampai disetujui.",
  },
  "/promotions/new": {
    title: "Tambah promo",
    subtitle: "Persen atau nominal. Kosongkan kupon untuk aturan otomatis.",
  },
  "/promotions/vouchers/new": {
    title: "Tambah voucher",
    subtitle: "Kode dan sisa nilai. Kasir tidak mengubah aturan.",
  },
  "/purchasing/suppliers/new": {
    title: "Tambah pemasok",
    subtitle: "Nama wajib. Produk dipasok opsional.",
  },
  "/purchasing/orders/new": {
    title: "Pesanan pembelian baru",
    subtitle: "Pilih pemasok dan item. Draf belum mengubah stok.",
  },
  "/stores/new": {
    title: "Tambah toko",
    subtitle: "Store #1 tetap toko awal.",
  },
  "/stores/prices": {
    title: "Harga toko",
    subtitle: "Menimpa harga katalog setelah kasir menyegarkan menu.",
  },
  "/transfers/new": {
    title: "Transfer stok baru",
    subtitle: "Stok baru pindah saat dikirim/diterima.",
  },
};

const PAGE_COPY_MATCHERS: Array<{
  test: (pathname: string) => boolean;
  copy: { title: string; subtitle: string };
}> = [
  {
    test: (p) => /^\/products\/[^/]+\/edit$/.test(p),
    copy: {
      title: "Ubah produk",
      subtitle: "Ubah harga, stok, atau gambar. Simpan di bagian bawah.",
    },
  },
  {
    test: (p) => /^\/customers\/[^/]+\/edit$/.test(p),
    copy: {
      title: "Ubah pelanggan",
      subtitle: "Profil, grup, kredit, dan harga pelanggan. Simpan di bagian bawah.",
    },
  },
  {
    test: (p) => /^\/employees\/[^/]+\/edit$/.test(p),
    copy: {
      title: "Ubah karyawan",
      subtitle: "Peran, status, toko, dan sandi. Simpan di bagian bawah.",
    },
  },
  {
    test: (p) => /^\/opname\/[^/]+$/.test(p),
    copy: {
      title: "Hitung opname",
      subtitle: "Isi hitung fisik, lalu setujui. Draf tidak mengubah stok.",
    },
  },
  {
    test: (p) => /^\/purchasing\/suppliers\/[^/]+\/edit$/.test(p),
    copy: {
      title: "Ubah pemasok",
      subtitle: "Kontak dan produk dipasok. Simpan di bagian bawah.",
    },
  },
  {
    test: (p) => /^\/purchasing\/orders\/[^/]+$/.test(p),
    copy: {
      title: "Pesanan pembelian",
      subtitle: "Status, penerimaan, dan faktur. Faktur tidak wajib lunas untuk stok.",
    },
  },
  {
    test: (p) => /^\/stores\/[^/]+\/registers\/new$/.test(p),
    copy: {
      title: "Tambah register",
      subtitle: "Register terikat pada toko, bukan Checkout.",
    },
  },
  {
    test: (p) => /^\/stock\/[^/]+\/damage$/.test(p),
    copy: {
      title: "Stok rusak",
      subtitle: "Jumlah dan alasan. Kasir tetap bisa menjual.",
    },
  },
  {
    test: (p) => /^\/returns\/[^/]+$/.test(p),
    copy: {
      title: "Retur",
      subtitle: "Tautkan tukar atau refund tunai. Refund tunai hanya admin katalog.",
    },
  },
];

function pageCopy(pathname: string): { title: string; subtitle: string } {
  if (PAGE_COPY[pathname]) return PAGE_COPY[pathname];
  const matched = PAGE_COPY_MATCHERS.find((row) => row.test(pathname));
  if (matched) return matched.copy;
  return { title: "Dashboard", subtitle: "" };
}

function navMatches(href: string, pathname: string) {
  if (href === "/") return pathname === "/" || pathname.startsWith("/products");
  return pathname === href || pathname.startsWith(`${href}/`);
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
      match: (pathname: string) => navMatches("/", pathname),
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
  ].filter((item) => item.show)
    .map((item) => ({
      ...item,
      match: item.match ?? ((pathname: string) => navMatches(item.href, pathname)),
    }));

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
