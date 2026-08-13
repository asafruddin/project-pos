"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import type {
  ApiErrorBody,
  Customer,
  CustomerHistoryResponse,
  CustomerListResponse,
} from "@pos-apps/types";
import { Button } from "@/components/ui/button";
import { CreateLink, FormField, RowLink, formInputClass } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { TableSkeleton } from "@/components/ui/skeleton";
import { authorizedFetch } from "@/lib/api-client";
import { getAccessToken, isAccessTokenExpired, logoutToLogin } from "@/lib/auth-token";
import { formatIdr } from "@/lib/format-money";

export function CustomersPanel({ canDelete }: { canDelete: boolean }) {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<Customer[]>([]);
  const [history, setHistory] = useState<CustomerHistoryResponse | null>(null);
  const [historyFor, setHistoryFor] = useState<string | null>(null);
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
      const cRes = await authorizedFetch(`/customers${qs}`);
      const cData = (await cRes.json()) as CustomerListResponse | ApiErrorBody;
      if (!cRes.ok) {
        setError((cData as ApiErrorBody).message ?? "Gagal memuat pelanggan.");
        return;
      }
      setError(null);
      setRows((cData as CustomerListResponse).customers);
    } catch (err) {
      if (
        err instanceof Error &&
        (err.message === "AUTH_UNAUTHORIZED" ||
          err.message === "AUTH_SESSION_EXPIRED")
      ) {
        return;
      }
      setError("Gagal memuat pelanggan.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function openHistory(row: Customer) {
    setHistory(null);
    setHistoryFor(row.customer_id);
    try {
      const res = await authorizedFetch(`/customers/${row.customer_id}/history`);
      if (!res.ok) return;
      setHistory((await res.json()) as CustomerHistoryResponse);
    } catch {
      /* list still usable */
    }
  }

  function onSearch(e: FormEvent) {
    e.preventDefault();
    void load(query);
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Daftar pelanggan
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {loading ? "Memuat pelanggan…" : `${rows.length} pelanggan`}
          </p>
        </div>
        <CreateLink href="/customers/new">Tambah pelanggan</CreateLink>
      </div>

      <form className="flex max-w-xl items-end gap-2" onSubmit={onSearch}>
        <div className="min-w-0 flex-1">
          <FormField id="cust-search" label="Cari">
            <Input
              id="cust-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nama, telepon, email"
              className={formInputClass}
            />
          </FormField>
        </div>
        <Button type="submit" className="h-10 bg-secondary text-secondary-foreground hover:opacity-90">
          Cari
        </Button>
      </form>

      {error ? (
        <div
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {loading ? (
        <TableSkeleton rows={6} />
      ) : rows.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-secondary/40 px-4 py-10 text-center">
          <p className="text-sm text-muted-foreground">Belum ada pelanggan.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li
              key={row.customer_id}
              className="rounded-md border border-border bg-background/70 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => void openHistory(row)}
                >
                  <p className="font-medium">{row.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {row.phone ?? row.email}
                    {row.group_name ? ` · ${row.group_name}` : ""}
                    {` · kredit ${formatIdr(row.store_credit_minor ?? 0)}`}
                    {row.loyalty_points || row.loyalty_tier
                      ? ` · poin ${row.loyalty_points ?? 0}${row.loyalty_tier ? ` (${row.loyalty_tier})` : ""}`
                      : ""}
                  </p>
                </button>
                <RowLink href={`/customers/${row.customer_id}/edit`}>Ubah</RowLink>
              </div>
              {historyFor === row.customer_id && history ? (
                <div className="mt-3 space-y-2 border-t border-border pt-3">
                  <p className="text-sm font-medium">Riwayat belanja</p>
                  <p className="text-sm text-muted-foreground">
                    Total belanja: {formatIdr(history.total_spend_minor)}
                  </p>
                  {history.sales.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Belum ada penjualan.</p>
                  ) : (
                    <ul className="space-y-1 text-sm">
                      {history.sales.map((sale) => (
                        <li key={sale.sale_id}>
                          {formatIdr(sale.amount_minor)}
                          {sale.voided_at ? " · Di-void" : ""}
                        </li>
                      ))}
                    </ul>
                  )}
                  {history.returns.map((ret) => (
                    <p key={ret.return_id} className="text-sm">
                      Retur {formatIdr(ret.amount_minor)} · {ret.status}
                    </p>
                  ))}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {canDelete ? null : (
        <p className="text-xs text-muted-foreground">
          Kasir tidak dapat menghapus pelanggan atau mengubah kredit/harga.
        </p>
      )}
    </div>
  );
}
