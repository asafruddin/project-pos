"use client";

import { Button, Input } from "@pos-apps/ui/atoms";
import { FormField, formInputClass, TableSkeleton } from "@pos-apps/ui/molecules";
import { CreateLink, RowLink } from "@pos-apps/ui/organisms";
import { FormEvent, useCallback, useEffect, useState } from "react";
import type {
  ApiErrorBody,
  PurchaseOrderListResponse,
  PurchaseOrderStatus,
  SupplierListResponse,
} from "@pos-apps/types";
import { authorizedFetch } from "@/lib/api-client";
import { getAccessToken, isAccessTokenExpired, logoutToLogin } from "@/lib/auth-token";

function statusLabel(status: PurchaseOrderStatus): string {
  if (status === "draft") return "Draf";
  if (status === "submitted") return "Diajukan";
  if (status === "approved") return "Disetujui";
  if (status === "partially_received") return "Diterima sebagian";
  if (status === "completed") return "Selesai";
  return "Dibatalkan";
}

export function PurchasingPanel() {
  const [query, setQuery] = useState("");
  const [suppliers, setSuppliers] = useState<SupplierListResponse["suppliers"]>(
    [],
  );
  const [pos, setPos] = useState<PurchaseOrderListResponse["purchase_orders"]>(
    [],
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (q?: string) => {
    const token = getAccessToken();
    if (!token || isAccessTokenExpired(token)) {
      logoutToLogin();
      return;
    }
    setLoading(true);
    try {
      const qs = q?.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
      const [sRes, pRes] = await Promise.all([
        authorizedFetch(`/purchasing/suppliers${qs}`),
        authorizedFetch("/purchasing/purchase-orders"),
      ]);
      const sData = (await sRes.json()) as SupplierListResponse | ApiErrorBody;
      const pData = (await pRes.json()) as PurchaseOrderListResponse | ApiErrorBody;
      if (!sRes.ok) {
        setError((sData as ApiErrorBody).message ?? "Gagal memuat pemasok.");
        return;
      }
      if (!pRes.ok) {
        setError((pData as ApiErrorBody).message ?? "Gagal memuat pesanan.");
        return;
      }
      setError(null);
      setSuppliers((sData as SupplierListResponse).suppliers);
      setPos((pData as PurchaseOrderListResponse).purchase_orders);
    } catch (err) {
      if (
        err instanceof Error &&
        (err.message === "AUTH_UNAUTHORIZED" ||
          err.message === "AUTH_SESSION_EXPIRED")
      ) {
        return;
      }
      setError("Tidak dapat menghubungi API.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function onSearch(e: FormEvent) {
    e.preventDefault();
    void load(query);
  }

  return (
    <div className="flex min-w-0 flex-col gap-10">
      {error ? (
        <div
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              Pemasok
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {loading ? "Memuat pemasok…" : `${suppliers.length} pemasok`}
            </p>
          </div>
          <CreateLink href="/purchasing/suppliers/new">Tambah pemasok</CreateLink>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 shadow-[var(--shadow-card)] sm:p-4">
          <form className="flex max-w-xl items-end gap-2" onSubmit={onSearch}>
            <div className="min-w-0 flex-1">
              <FormField id="sup-search" label="Cari">
                <Input
                  id="sup-search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Nama / kontak / telepon"
                  className={formInputClass}
                />
              </FormField>
            </div>
            <Button
              type="submit"
              className="h-10 bg-secondary text-secondary-foreground hover:opacity-90"
            >
              Cari
            </Button>
          </form>
        </div>
        {loading ? (
          <TableSkeleton rows={4} />
        ) : suppliers.length === 0 ? (
          <div className="rounded-md border border-dashed border-border bg-secondary/40 px-4 py-10 text-center">
            <p className="text-sm text-muted-foreground">Belum ada pemasok.</p>
          </div>
        ) : (
          <>
            <ul className="grid gap-3 sm:hidden">
              {suppliers.map((item) => (
                <li
                  key={item.supplier_id}
                  className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)]"
                >
                  <p className="font-medium text-foreground">{item.name}</p>
                  <div className="mt-3">
                    <RowLink href={`/purchasing/suppliers/${item.supplier_id}/edit`}>
                      Ubah
                    </RowLink>
                  </div>
                </li>
              ))}
            </ul>
            <div className="hidden overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-card)] sm:block">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[28rem] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="px-4 py-3 font-medium">Nama</th>
                      <th className="px-4 py-3 font-medium">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {suppliers.map((item) => (
                      <tr
                        key={item.supplier_id}
                        className="border-b border-border/60 last:border-0"
                      >
                        <td className="px-4 py-3 font-medium">{item.name}</td>
                        <td className="px-4 py-3">
                          <RowLink
                            href={`/purchasing/suppliers/${item.supplier_id}/edit`}
                          >
                            Ubah
                          </RowLink>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              Pesanan pembelian
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {loading ? "Memuat pesanan…" : `${pos.length} pesanan`}
            </p>
          </div>
          <CreateLink href="/purchasing/orders/new">Tambah PO</CreateLink>
        </div>
        {loading ? (
          <TableSkeleton rows={4} />
        ) : pos.length === 0 ? (
          <div className="rounded-md border border-dashed border-border bg-secondary/40 px-4 py-10 text-center">
            <p className="text-sm text-muted-foreground">Belum ada pesanan.</p>
          </div>
        ) : (
          <>
            <ul className="grid gap-3 sm:hidden">
              {pos.map((item) => (
                <li
                  key={item.po_id}
                  className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)]"
                >
                  <p className="font-medium text-foreground">
                    {statusLabel(item.status)}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {item.supplier_name} · {item.line_count} item
                  </p>
                  <div className="mt-3">
                    <RowLink href={`/purchasing/orders/${item.po_id}`}>Buka</RowLink>
                  </div>
                </li>
              ))}
            </ul>
            <div className="hidden overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-card)] sm:block">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Pemasok</th>
                      <th className="px-4 py-3 font-medium">Item</th>
                      <th className="px-4 py-3 font-medium">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pos.map((item) => (
                      <tr
                        key={item.po_id}
                        className="border-b border-border/60 last:border-0"
                      >
                        <td className="px-4 py-3 font-medium">
                          {statusLabel(item.status)}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {item.supplier_name}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {item.line_count} item
                        </td>
                        <td className="px-4 py-3">
                          <RowLink href={`/purchasing/orders/${item.po_id}`}>
                            Buka
                          </RowLink>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
