"use client";

import { Button } from "@pos-apps/ui/atoms";
import { TableSkeleton } from "@pos-apps/ui/molecules";
import { CreateLink } from "@pos-apps/ui/organisms";
import { useCallback, useEffect, useState } from "react";
import type {
  ApiErrorBody,
  Promotion,
  PromotionListResponse,
  Voucher,
  VoucherListResponse,
} from "@pos-apps/types";
import { authorizedFetch } from "@/lib/api-client";
import { getAccessToken, isAccessTokenExpired, logoutToLogin } from "@/lib/auth-token";
import { formatIdr } from "@/lib/format-money";

export function PromotionsPanel({ canEdit }: { canEdit: boolean }) {
  const [rows, setRows] = useState<Promotion[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const token = getAccessToken();
    if (!token || isAccessTokenExpired(token)) {
      logoutToLogin();
      return;
    }
    setLoading(true);
    try {
      const [pRes, vRes] = await Promise.all([
        authorizedFetch("/promotions"),
        canEdit ? authorizedFetch("/vouchers") : Promise.resolve(null),
      ]);
      const pData = (await pRes.json()) as PromotionListResponse | ApiErrorBody;
      if (!pRes.ok) {
        setError((pData as ApiErrorBody).message ?? "Gagal memuat promo.");
        return;
      }
      setError(null);
      setRows((pData as PromotionListResponse).promotions);
      if (vRes?.ok) {
        const vData = (await vRes.json()) as VoucherListResponse;
        setVouchers(vData.vouchers);
      }
    } catch (err) {
      if (
        err instanceof Error &&
        (err.message === "AUTH_UNAUTHORIZED" ||
          err.message === "AUTH_SESSION_EXPIRED")
      ) {
        return;
      }
      setError("Gagal memuat promo.");
    } finally {
      setLoading(false);
    }
  }, [canEdit]);

  useEffect(() => {
    void load();
  }, [load]);

  async function removePromo(id: string) {
    if (!canEdit) return;
    const res = await authorizedFetch(`/promotions/${id}`, { method: "DELETE" });
    if (!res.ok && res.status !== 204) {
      const data = (await res.json()) as ApiErrorBody;
      setError(data.message ?? "Gagal menghapus promo.");
      return;
    }
    await load();
  }

  return (
    <div className="grid gap-10 lg:grid-cols-2">
      <section className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              Kampanye
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {loading ? "Memuat…" : `${rows.length} promo`}
            </p>
          </div>
          {canEdit ? <CreateLink href="/promotions/new">Tambah promo</CreateLink> : null}
        </div>
        {error ? (
          <div
            className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
            role="alert"
          >
            {error}
          </div>
        ) : null}
        {loading ? (
          <TableSkeleton rows={4} />
        ) : rows.length === 0 ? (
          <div className="rounded-md border border-dashed border-border bg-secondary/40 px-4 py-10 text-center">
            <p className="text-sm text-muted-foreground">Belum ada promo.</p>
          </div>
        ) : (
          <>
            <ul className="grid gap-3 sm:hidden">
              {rows.map((row) => (
                <li
                  key={row.promotion_id}
                  className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)]"
                >
                  <p className="font-medium text-foreground">{row.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {row.coupon_code ? `kupon ${row.coupon_code}` : "otomatis"}
                    {row.enabled ? "" : " · nonaktif"}
                  </p>
                  {canEdit ? (
                    <div className="mt-3">
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-9 px-3 text-destructive hover:text-destructive"
                        onClick={() => void removePromo(row.promotion_id)}
                      >
                        Hapus
                      </Button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
            <div className="hidden overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-card)] sm:block">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[28rem] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="px-4 py-3 font-medium">Nama</th>
                      <th className="px-4 py-3 font-medium">Detail</th>
                      <th className="px-4 py-3 font-medium">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr
                        key={row.promotion_id}
                        className="border-b border-border/60 last:border-0"
                      >
                        <td className="px-4 py-3 font-medium">{row.name}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {row.coupon_code ? `kupon ${row.coupon_code}` : "otomatis"}
                          {row.enabled ? "" : " · nonaktif"}
                        </td>
                        <td className="px-4 py-3">
                          {canEdit ? (
                            <Button
                              type="button"
                              variant="ghost"
                              className="h-9 px-3 text-destructive hover:text-destructive"
                              onClick={() => void removePromo(row.promotion_id)}
                            >
                              Hapus
                            </Button>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
        {canEdit ? null : (
          <p className="text-sm text-muted-foreground">
            Kasir tidak dapat mengubah aturan promo.
          </p>
        )}
      </section>

      <section className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              Voucher
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {loading ? "Memuat…" : `${vouchers.length} voucher`}
            </p>
          </div>
          {canEdit ? (
            <CreateLink href="/promotions/vouchers/new">Tambah voucher</CreateLink>
          ) : null}
        </div>
        {loading ? (
          <TableSkeleton rows={4} />
        ) : vouchers.length === 0 ? (
          <div className="rounded-md border border-dashed border-border bg-secondary/40 px-4 py-10 text-center">
            <p className="text-sm text-muted-foreground">Belum ada voucher.</p>
          </div>
        ) : (
          <>
            <ul className="grid gap-3 sm:hidden">
              {vouchers.map((row) => (
                <li
                  key={row.voucher_id}
                  className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)]"
                >
                  <p className="font-medium text-foreground">{row.code}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    sisa {formatIdr(row.remaining_minor)}
                    {row.enabled ? "" : " · nonaktif"}
                  </p>
                </li>
              ))}
            </ul>
            <div className="hidden overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-card)] sm:block">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[28rem] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="px-4 py-3 font-medium">Kode</th>
                      <th className="px-4 py-3 font-medium">Sisa</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vouchers.map((row) => (
                      <tr
                        key={row.voucher_id}
                        className="border-b border-border/60 last:border-0"
                      >
                        <td className="px-4 py-3 font-medium">{row.code}</td>
                        <td className="px-4 py-3">
                          {formatIdr(row.remaining_minor)}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {row.enabled ? "Aktif" : "Nonaktif"}
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
