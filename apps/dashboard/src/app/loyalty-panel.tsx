"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import type {
  ApiErrorBody,
  CustomerListResponse,
  LoyaltyAccount,
  LoyaltyProgram,
  LoyaltyTierRule,
  UpdateLoyaltyProgramRequest,
} from "@pos-apps/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authorizedFetch } from "@/lib/api-client";
import { getAccessToken, isAccessTokenExpired, logoutToLogin } from "@/lib/auth-token";
import { formatIdr } from "@/lib/format-money";

function emptyTier(): LoyaltyTierRule {
  return { name: "", min_lifetime_points: 0, earn_multiplier_bps: 10000 };
}

export function LoyaltyPanel({ canEdit }: { canEdit: boolean }) {
  const [program, setProgram] = useState<LoyaltyProgram | null>(null);
  const [account, setAccount] = useState<LoyaltyAccount | null>(null);
  const [customers, setCustomers] = useState<CustomerListResponse["customers"]>(
    [],
  );
  const [customerId, setCustomerId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [earnPerMinor, setEarnPerMinor] = useState("10000");
  const [pointValueMinor, setPointValueMinor] = useState("100");
  const [expireDays, setExpireDays] = useState("");
  const [tiers, setTiers] = useState<LoyaltyTierRule[]>([emptyTier()]);

  const loadProgram = useCallback(async () => {
    const token = getAccessToken();
    if (!token || isAccessTokenExpired(token)) {
      logoutToLogin();
      return;
    }
    try {
      const [pRes, cRes] = await Promise.all([
        authorizedFetch("/loyalty/program"),
        authorizedFetch("/customers"),
      ]);
      const pData = (await pRes.json()) as LoyaltyProgram | ApiErrorBody;
      if (!pRes.ok) {
        setError((pData as ApiErrorBody).message ?? "Gagal memuat program.");
        return;
      }
      const next = pData as LoyaltyProgram;
      setError(null);
      setProgram(next);
      setEnabled(next.enabled);
      setEarnPerMinor(String(next.earn_per_minor));
      setPointValueMinor(String(next.point_value_minor));
      setExpireDays(next.expire_days == null ? "" : String(next.expire_days));
      setTiers(next.tiers.length ? next.tiers : [emptyTier()]);
      if (cRes.ok) {
        const cData = (await cRes.json()) as CustomerListResponse;
        setCustomers(cData.customers);
      }
    } catch (err) {
      if (
        err instanceof Error &&
        (err.message === "AUTH_UNAUTHORIZED" ||
          err.message === "AUTH_SESSION_EXPIRED")
      ) {
        return;
      }
      setError("Gagal memuat program loyalitas.");
    }
  }, []);

  useEffect(() => {
    void loadProgram();
  }, [loadProgram]);

  async function saveProgram(e: FormEvent) {
    e.preventDefault();
    if (!canEdit || pending) return;
    setPending(true);
    setError(null);
    const earn = Number.parseInt(earnPerMinor, 10);
    const value = Number.parseInt(pointValueMinor, 10);
    const expire = expireDays.trim()
      ? Number.parseInt(expireDays, 10)
      : null;
    const body: UpdateLoyaltyProgramRequest = {
      enabled,
      earn_per_minor: earn,
      point_value_minor: value,
      expire_days: expire,
      tiers: tiers.filter((tier) => tier.name.trim().length > 0),
    };
    try {
      const res = await authorizedFetch("/loyalty/program", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as LoyaltyProgram | ApiErrorBody;
      if (!res.ok) {
        setError((data as ApiErrorBody).message ?? "Gagal menyimpan program.");
        return;
      }
      setProgram(data as LoyaltyProgram);
    } catch (err) {
      if (
        err instanceof Error &&
        (err.message === "AUTH_UNAUTHORIZED" ||
          err.message === "AUTH_SESSION_EXPIRED")
      ) {
        return;
      }
      setError("Gagal menyimpan program.");
    } finally {
      setPending(false);
    }
  }

  async function loadAccount(id: string) {
    setCustomerId(id);
    setAccount(null);
    if (!id) return;
    try {
      const res = await authorizedFetch(`/loyalty/accounts/${id}`);
      const data = (await res.json()) as LoyaltyAccount | ApiErrorBody;
      if (!res.ok) {
        setError((data as ApiErrorBody).message ?? "Gagal memuat akun.");
        return;
      }
      setError(null);
      setAccount(data as LoyaltyAccount);
    } catch (err) {
      if (
        err instanceof Error &&
        (err.message === "AUTH_UNAUTHORIZED" ||
          err.message === "AUTH_SESSION_EXPIRED")
      ) {
        return;
      }
      setError("Gagal memuat akun loyalitas.");
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form className="space-y-3" onSubmit={(e) => void saveProgram(e)}>
        <p className="font-medium">Program poin</p>
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        {!program ? (
          <p className="text-sm text-muted-foreground">Memuat program…</p>
        ) : (
          <>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={enabled}
                disabled={!canEdit}
                onChange={(e) => setEnabled(e.target.checked)}
              />
              Program aktif
            </label>
            <div>
              <Label htmlFor="earn-per">1 poin per (Rp)</Label>
              <Input
                id="earn-per"
                type="number"
                min={1}
                step={1}
                value={earnPerMinor}
                disabled={!canEdit}
                onChange={(e) => setEarnPerMinor(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="point-value">Nilai 1 poin (Rp)</Label>
              <Input
                id="point-value"
                type="number"
                min={1}
                step={1}
                value={pointValueMinor}
                disabled={!canEdit}
                onChange={(e) => setPointValueMinor(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="expire-days">Kedaluwarsa (hari, kosong = tidak)</Label>
              <Input
                id="expire-days"
                type="number"
                min={1}
                step={1}
                value={expireDays}
                disabled={!canEdit}
                onChange={(e) => setExpireDays(e.target.value)}
              />
            </div>
            <p className="text-sm font-medium">Tingkat</p>
            {tiers.map((tier, index) => (
              <div key={index} className="grid grid-cols-3 gap-2">
                <Input
                  value={tier.name}
                  disabled={!canEdit}
                  placeholder="Nama"
                  onChange={(e) => {
                    const next = [...tiers];
                    next[index] = { ...tier, name: e.target.value };
                    setTiers(next);
                  }}
                />
                <Input
                  type="number"
                  min={0}
                  value={tier.min_lifetime_points}
                  disabled={!canEdit}
                  placeholder="Min poin"
                  onChange={(e) => {
                    const next = [...tiers];
                    next[index] = {
                      ...tier,
                      min_lifetime_points: Number.parseInt(e.target.value, 10) || 0,
                    };
                    setTiers(next);
                  }}
                />
                <Input
                  type="number"
                  min={0}
                  value={tier.earn_multiplier_bps}
                  disabled={!canEdit}
                  placeholder="Pengali bps"
                  onChange={(e) => {
                    const next = [...tiers];
                    next[index] = {
                      ...tier,
                      earn_multiplier_bps:
                        Number.parseInt(e.target.value, 10) || 0,
                    };
                    setTiers(next);
                  }}
                />
              </div>
            ))}
            {canEdit ? (
              <div className="flex gap-2">
                <Button
                  type="button"
                  className="rounded-2xl bg-secondary text-secondary-foreground"
                  onClick={() => setTiers([...tiers, emptyTier()])}
                >
                  Tambah tingkat
                </Button>
                <Button
                  type="submit"
                  disabled={pending}
                  className="rounded-2xl bg-accent text-accent-foreground"
                >
                  {pending ? "Menyimpan…" : "Simpan program"}
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Kasir tidak dapat mengubah aturan loyalitas.
              </p>
            )}
          </>
        )}
      </form>
      <div className="space-y-3">
        <p className="font-medium">Buku besar pelanggan</p>
        <select
          className="w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm"
          value={customerId}
          onChange={(e) => void loadAccount(e.target.value)}
        >
          <option value="">Pilih pelanggan</option>
          {customers.map((row) => (
            <option key={row.customer_id} value={row.customer_id}>
              {row.name} · {row.loyalty_points} poin
            </option>
          ))}
        </select>
        {account ? (
          <div className="space-y-2 rounded-2xl border border-border p-4">
            <p className="text-sm text-muted-foreground">
              Saldo {account.points_balance} · seumur hidup{" "}
              {account.lifetime_earned}
              {account.tier ? ` · ${account.tier}` : ""}
            </p>
            {account.ledger.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada mutasi.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {account.ledger.map((row) => (
                  <li key={row.entry_id}>
                    {row.kind} {row.points_delta > 0 ? "+" : ""}
                    {row.points_delta}
                    {row.note ? ` · ${row.note}` : ""}
                    {row.occurred_at
                      ? ` · ${new Date(row.occurred_at).toLocaleString("id-ID")}`
                      : ""}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Pilih pelanggan untuk melihat poin. Nilai {formatIdr(program?.point_value_minor ?? 100)}.
          </p>
        )}
      </div>
    </div>
  );
}
