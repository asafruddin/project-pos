"use client";

import {
  ArrowUDownLeftIcon,
  ChartBarIcon,
  ChartLineUpIcon,
  ClipboardTextIcon,
  ClockCountdownIcon,
  CoffeeIcon,
  HouseIcon,
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
  TagIcon,
  ScalesIcon,
} from "@phosphor-icons/react";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Button } from "@pos-apps/ui/atoms";
import { hasPermission, ROLE_LABELS, type Role } from "@pos-apps/types";
import { DashboardHeader } from "@/components/organisms/dashboard-header";
import { SideNav, type NavSection } from "@/components/organisms/pos-nav";
import { clearSession } from "@/lib/auth-token";

const PAGE_COPY: Record<string, { title: string; subtitle: string }> = {
  "/": {
    title: "Beranda",
    subtitle: "Ringkasan toko hari ini. Angka dari penjualan yang sudah tersinkron.",
  },
  "/products": {
    title: "Stok / Produk",
    subtitle:
      "Kelola katalog toko. Harga dalam Rupiah penuh (mis. 15000 = Rp15.000).",
  },
  "/categories": {
    title: "Kategori",
    subtitle: "Kategori produk untuk toko Anda. Muncul sebagai pilihan di form produk.",
  },
  "/categories/new": {
    title: "Tambah kategori",
    subtitle: "Nama kategori dipakai di form produk.",
  },
  "/units": {
    title: "Satuan",
    subtitle: "Satuan jual (pcs, kg, slop, dll.) untuk toko Anda. Muncul di form produk.",
  },
  "/units/new": {
    title: "Tambah satuan",
    subtitle: "Nama satuan dipakai di form produk.",
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
  "/reports/ringkasan": {
    title: "Laporan · Ringkasan",
    subtitle: "Pendapatan, transaksi, dan snapshot keuangan untuk rentang tanggal.",
  },
  "/reports/produk": {
    title: "Laporan · Produk",
    subtitle: "Produk terlaris dan lambat. Margin hanya untuk peran keuangan.",
  },
  "/reports/kasir": {
    title: "Laporan · Kasir",
    subtitle: "Kinerja kasir dan shift. Kasir hanya melihat datanya sendiri.",
  },
  "/reports/stok": {
    title: "Laporan · Stok",
    subtitle: "Nilai stok, pergerakan, opname, dan stok mati. Hanya peran keuangan.",
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
  "/products/import": {
    title: "Impor produk",
    subtitle:
      "Unduh template CSV/Excel, isi baris produk, lalu unggah. SKU yang sudah ada akan diperbarui.",
  },
  "/customers/new": {
    title: "Tambah pelanggan",
    subtitle: "Nama wajib. Telepon, email, dan catatan opsional.",
  },
  "/customers/import": {
    title: "Impor pelanggan",
    subtitle:
      "Unduh template CSV/Excel. Telepon yang sudah ada akan diperbarui; jika kosong, email dipakai sebagai kunci.",
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
  "/purchasing/suppliers/import": {
    title: "Impor pemasok",
    subtitle:
      "Unduh template CSV/Excel, isi baris pemasok, lalu unggah. Nama yang sudah ada akan diperbarui.",
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
    test: (p) => /^\/categories\/[^/]+\/edit$/.test(p),
    copy: {
      title: "Ubah kategori",
      subtitle: "Nama kategori dipakai di form produk. Simpan di bagian bawah.",
    },
  },
  {
    test: (p) => /^\/units\/[^/]+\/edit$/.test(p),
    copy: {
      title: "Ubah satuan",
      subtitle: "Nama satuan dipakai di form produk. Simpan di bagian bawah.",
    },
  },
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
  if (href === "/") return pathname === "/";
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

  const reportChildren = [
    { href: "/reports/ringkasan", label: "Ringkasan" },
    { href: "/reports/produk", label: "Produk" },
    { href: "/reports/kasir", label: "Kasir" },
    ...(can("reports", "view_financial")
      ? [{ href: "/reports/stok", label: "Stok" }]
      : []),
  ];

  const nav = [
    {
      group: "Menu",
      href: "/",
      label: "Beranda",
      icon: <HouseIcon size={20} weight="regular" />,
      show: true,
      match: (pathname: string) => pathname === "/",
    },
    {
      group: "Menu",
      href: "/sales",
      label: "Penjualan",
      icon: <ChartLineUpIcon size={20} weight="regular" />,
      show: can("sales", "view") || can("reports", "view"),
    },
    {
      group: "Menu",
      href: "/reports/ringkasan",
      label: "Laporan",
      icon: <ChartBarIcon size={20} weight="regular" />,
      show: can("reports", "view"),
      match: (pathname: string) => pathname === "/reports" || pathname.startsWith("/reports/"),
      children: reportChildren,
    },
    {
      group: "Produk",
      href: "/products",
      label: "Stok / Produk",
      icon: <PackageIcon size={20} weight="regular" />,
      show: can("products", "view"),
    },
    {
      group: "Produk",
      href: "/categories",
      label: "Kategori",
      icon: <TagIcon size={20} weight="regular" />,
      show: can("products", "view"),
    },
    {
      group: "Produk",
      href: "/units",
      label: "Satuan",
      icon: <ScalesIcon size={20} weight="regular" />,
      show: can("products", "view"),
    },
    {
      group: "Produk",
      href: "/stock",
      label: "Ikhtisar stok",
      icon: <WarehouseIcon size={20} weight="regular" />,
      show: can("inventory", "view"),
    },
    {
      group: "Produk",
      href: "/transfers",
      label: "Transfer stok",
      icon: <ArrowsLeftRightIcon size={20} weight="regular" />,
      show: can("transfers", "view"),
    },
    {
      group: "Produk",
      href: "/opname",
      label: "Opname stok",
      icon: <ClipboardTextIcon size={20} weight="regular" />,
      show: can("inventory", "view"),
    },
    {
      group: "Produk",
      href: "/purchasing",
      label: "Pembelian",
      icon: <TruckIcon size={20} weight="regular" />,
      show: can("purchases", "view"),
    },
    {
      group: "Pelanggan",
      href: "/customers",
      label: "Pelanggan",
      icon: <UserCircleIcon size={20} weight="regular" />,
      show: can("customers", "view"),
    },
    {
      group: "Pelanggan",
      href: "/loyalty",
      label: "Loyalitas",
      icon: <StarIcon size={20} weight="regular" />,
      show: can("loyalty", "view"),
    },
    {
      group: "Pelanggan",
      href: "/promotions",
      label: "Promo",
      icon: <PercentIcon size={20} weight="regular" />,
      show: can("promotions", "view"),
    },
    {
      group: "Pelanggan",
      href: "/returns",
      label: "Retur",
      icon: <ArrowUDownLeftIcon size={20} weight="regular" />,
      show: can("returns", "view"),
    },
    {
      group: "Umum",
      href: "/stores",
      label: "Toko",
      icon: <BuildingsIcon size={20} weight="regular" />,
      show: can("stores", "view"),
    },
    {
      group: "Umum",
      href: "/shifts",
      label: "Shift",
      icon: <ClockCountdownIcon size={20} weight="regular" />,
      show: can("shifts", "view"),
    },
    {
      group: "Umum",
      href: "/employees",
      label: "Karyawan",
      icon: <UsersThreeIcon size={20} weight="regular" />,
      show: can("users", "view"),
    },
  ]
    .filter((item) => item.show)
    .map((item) => ({
      ...item,
      match: item.match ?? ((pathname: string) => navMatches(item.href, pathname)),
    }));

  const groupOrder = ["Menu", "Produk", "Pelanggan", "Umum"];
  const sections: NavSection[] = groupOrder
    .map((label) => ({
      label,
      items: nav.filter((item) => item.group === label),
    }))
    .filter((section) => section.items.length > 0);

  const searchItems = nav.flatMap((item) => [
    { href: item.href, label: item.label },
    ...(item.children ?? []),
  ]);

  const brand = (
    <div className="flex items-center gap-3">
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <CoffeeIcon size={22} weight="fill" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">POS Apps</p>
        <p className="truncate text-xs text-muted-foreground">Dashboard</p>
      </div>
    </div>
  );

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <SideNav
        className="hidden h-full md:flex"
        sections={sections}
        brand={brand}
        footer={
          <Button
            type="button"
            variant="ghost"
            className="h-auto w-full justify-start gap-3 rounded-xl px-3 py-2.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={logout}
          >
            <SignOutIcon size={18} weight="bold" />
            Keluar
          </Button>
        }
      />

      <SideNav
        compact
        className="flex h-full md:hidden"
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
