"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import type {
  ApiErrorBody,
  Promotion,
  PromotionListResponse,
  Voucher,
  VoucherListResponse,
} from "@pos-apps/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authorizedFetch } from "@/lib/api-client";
import { getAccessToken, isAccessTokenExpired, logoutToLogin } from "@/lib/auth-token";
import { formatIdr } from "@/lib/format-money";

export function PromotionsPanel({ canEdit }: { canEdit: boolean }) {
  const [rows, setRows] = useState<Promotion[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [name, setName] = useState("Happy hour 10%");
  const [kind, setKind] = useState<"percent" | "fixed">("percent");
  const [percentBps, setPercentBps] = useState("1000");
  const [fixedMinor, setFixedMinor] = useState("10000");
  const [coupon, setCoupon] = useState("");
  const [hourStart, setHourStart] = useState("17");
  const [hourEnd, setHourEnd] = useState("21");
  const [exclusive, setExclusive] = useState(false);
  const [voucherCode, setVoucherCode] = useState("");
  const [voucherRemaining, setVoucherRemaining] = useState("50000");

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

  async function savePromo(e: FormEvent) {
    e.preventDefault();
    if (!canEdit || pending) return;
    setPending(true);
    try {
      const res = await authorizedFetch("/promotions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          kind,
          percent_bps: kind === "percent" ? Number.parseInt(percentBps, 10) : null,
          fixed_minor: kind === "fixed" ? Number.parseInt(fixedMinor, 10) : null,
          coupon_code: coupon.trim() || null,
          exclusive,
          hour_start: hourStart.trim() ? Number.parseInt(hourStart, 10) : null,
          hour_end: hourEnd.trim() ? Number.parseInt(hourEnd, 10) : null,
        }),
      });
      const data = (await res.json()) as Promotion | ApiErrorBody;
      if (!res.ok) {
        setError((data as ApiErrorBody).message ?? "Gagal menyimpan promo.");
        return;
      }
      await load();
    } finally {
      setPending(false);
    }
  }

  async function saveVoucher(e: FormEvent) {
    e.preventDefault();
    if (!canEdit || pending) return;
    setPending(true);
    try {
      const res = await authorizedFetch("/vouchers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: voucherCode,
          remaining_minor: Number.parseInt(voucherRemaining, 10),
        }),
      });
      const data = (await res.json()) as Voucher | ApiErrorBody;
      if (!res.ok) {
        setError((data as ApiErrorBody).message ?? "Gagal menyimpan voucher.");
        return;
      }
      setVoucherCode("");
      await load();
    } finally {
      setPending(false);
    }
  }

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
        <p className="font-medium">Kampanye</p>
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
                <button
                  type="button"
                  className="text-destructive"
                  onClick={() => void removePromo(row.promotion_id)}
                >
                  Hapus
                </button>
              ) : null}
            </li>
          ))}
        </ul>
        {canEdit ? (
          <form className="space-y-2" onSubmit={(e) => void savePromo(e)}>
            <Label htmlFor="promo-name">Nama</Label>
            <Input id="promo-name" value={name} onChange={(e) => setName(e.target.value)} />
            <select
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={kind}
              onChange={(e) => setKind(e.target.value as "percent" | "fixed")}
            >
              <option value="percent">Persen (bps, 1000 = 10%)</option>
              <option value="fixed">Nominal tetap</option>
            </select>
            {kind === "percent" ? (
              <Input
                type="number"
                value={percentBps}
                onChange={(e) => setPercentBps(e.target.value)}
              />
            ) : (
              <Input
                type="number"
                value={fixedMinor}
                onChange={(e) => setFixedMinor(e.target.value)}
              />
            )}
            <Input
              value={coupon}
              placeholder="Kode kupon (kosong = otomatis)"
              onChange={(e) => setCoupon(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="number"
                min={0}
                max={23}
                value={hourStart}
                placeholder="Jam mulai"
                onChange={(e) => setHourStart(e.target.value)}
              />
              <Input
                type="number"
                min={0}
                max={23}
                value={hourEnd}
                placeholder="Jam selesai"
                onChange={(e) => setHourEnd(e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={exclusive}
                onChange={(e) => setExclusive(e.target.checked)}
              />
              Eksklusif (tidak ditumpuk)
            </label>
            <Button
              type="submit"
              disabled={pending}
              className="rounded-md bg-accent text-accent-foreground"
            >
              Simpan promo
            </Button>
          </form>
        ) : (
          <p className="text-sm text-muted-foreground">
            Kasir tidak dapat mengubah aturan promo.
          </p>
        )}
      </div>
      <div className="space-y-3">
        <p className="font-medium">Voucher</p>
        <ul className="space-y-2 text-sm">
          {vouchers.map((row) => (
            <li key={row.voucher_id} className="rounded-md border border-border px-3 py-2">
              {row.code} · sisa {formatIdr(row.remaining_minor)}
              {row.enabled ? "" : " · nonaktif"}
            </li>
          ))}
        </ul>
        {canEdit ? (
          <form className="space-y-2" onSubmit={(e) => void saveVoucher(e)}>
            <Input
              value={voucherCode}
              placeholder="Kode voucher"
              onChange={(e) => setVoucherCode(e.target.value)}
            />
            <Input
              type="number"
              min={0}
              value={voucherRemaining}
              onChange={(e) => setVoucherRemaining(e.target.value)}
            />
            <Button
              type="submit"
              disabled={pending}
              className="rounded-md bg-secondary text-secondary-foreground"
            >
              Simpan voucher
            </Button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
