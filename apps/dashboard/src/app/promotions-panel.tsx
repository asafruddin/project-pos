"use client";

import { Button } from "@pos-apps/ui/atoms";
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

  const load = useCallback(async () => {
    const token = getAccessToken();
    if (!token || isAccessTokenExpired(token)) {
      logoutToLogin();
      return;
    }
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
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <p className="font-medium">Kampanye</p>
          {canEdit ? <CreateLink href="/promotions/new">Tambah promo</CreateLink> : null}
        </div>
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <ul className="space-y-2">
          {rows.map((row) => (
            <li
              key={row.promotion_id}
              className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
            >
              <span>
                {row.name}
                {row.coupon_code ? ` · kupon ${row.coupon_code}` : " · otomatis"}
                {row.enabled ? "" : " · nonaktif"}
              </span>
              {canEdit ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="h-auto px-2 text-destructive hover:text-destructive"
                  onClick={() => void removePromo(row.promotion_id)}
                >
                  Hapus
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
        {canEdit ? null : (
          <p className="text-sm text-muted-foreground">
            Kasir tidak dapat mengubah aturan promo.
          </p>
        )}
      </div>
      <div className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <p className="font-medium">Voucher</p>
          {canEdit ? (
            <CreateLink href="/promotions/vouchers/new">Tambah voucher</CreateLink>
          ) : null}
        </div>
        <ul className="space-y-2 text-sm">
          {vouchers.map((row) => (
            <li key={row.voucher_id} className="rounded-md border border-border px-3 py-2">
              {row.code} · sisa {formatIdr(row.remaining_minor)}
              {row.enabled ? "" : " · nonaktif"}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
