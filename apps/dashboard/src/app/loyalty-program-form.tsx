"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  ApiErrorBody,
  LoyaltyProgram,
  LoyaltyTierRule,
  UpdateLoyaltyProgramRequest,
} from "@pos-apps/types";
import { Button } from "@/components/ui/button";
import {
  FormActions,
  FormBackLink,
  FormDenied,
  FormField,
  FormSection,
  formInputClass,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { authorizedFetch } from "@/lib/api-client";
import { getAccessToken, isAccessTokenExpired, logoutToLogin } from "@/lib/auth-token";

function emptyTier(): LoyaltyTierRule {
  return { name: "", min_lifetime_points: 0, earn_multiplier_bps: 10000 };
}

export function LoyaltyProgramForm({ canEdit }: { canEdit: boolean }) {
  const router = useRouter();
  const [program, setProgram] = useState<LoyaltyProgram | null>(null);
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
      const pRes = await authorizedFetch("/loyalty/program");
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
    const expire = expireDays.trim() ? Number.parseInt(expireDays, 10) : null;
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
      router.push("/loyalty");
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

  if (!canEdit) {
    return (
      <FormDenied href="/loyalty">
        Kasir tidak dapat mengubah aturan loyalitas.
      </FormDenied>
    );
  }

  if (!program) {
    return (
      <div className="flex min-h-full flex-col gap-5">
        <FormBackLink href="/loyalty">Loyalitas</FormBackLink>
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : (
          <div className="space-y-3" role="status" aria-label="Memuat program">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-28" />
          </div>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void saveProgram(e)} className="flex min-h-full flex-col gap-5">
      <FormBackLink href="/loyalty">Loyalitas</FormBackLink>
      <FormSection title="Program poin" description="Aturan poin bersama untuk seluruh toko.">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={enabled}
            disabled={pending}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          Program aktif
        </label>
        <FormField id="earn-per" label="1 poin per (Rp)" required>
          <Input
            id="earn-per"
            type="number"
            min={1}
            step={1}
            value={earnPerMinor}
            disabled={pending}
            onChange={(e) => setEarnPerMinor(e.target.value)}
            className={formInputClass}
          />
        </FormField>
        <FormField id="point-value" label="Nilai 1 poin (Rp)" required>
          <Input
            id="point-value"
            type="number"
            min={1}
            step={1}
            value={pointValueMinor}
            disabled={pending}
            onChange={(e) => setPointValueMinor(e.target.value)}
            className={formInputClass}
          />
        </FormField>
        <FormField
          id="expire-days"
          label="Kedaluwarsa (hari)"
          hint="Kosongkan jika poin tidak kedaluwarsa."
        >
          <Input
            id="expire-days"
            type="number"
            min={1}
            step={1}
            value={expireDays}
            disabled={pending}
            onChange={(e) => setExpireDays(e.target.value)}
            className={formInputClass}
          />
        </FormField>
      </FormSection>
      <FormSection title="Tingkat" description="Nama kosong tidak disimpan.">
        {tiers.map((tier, index) => (
          <div key={index} className="grid grid-cols-3 gap-2">
            <FormField id={`tier-name-${index}`} label="Nama">
              <Input
                id={`tier-name-${index}`}
                value={tier.name}
                disabled={pending}
                placeholder="Nama"
                onChange={(e) => {
                  const next = [...tiers];
                  next[index] = { ...tier, name: e.target.value };
                  setTiers(next);
                }}
                className={formInputClass}
              />
            </FormField>
            <FormField id={`tier-min-${index}`} label="Min poin">
              <Input
                id={`tier-min-${index}`}
                type="number"
                min={0}
                value={tier.min_lifetime_points}
                disabled={pending}
                placeholder="Min poin"
                onChange={(e) => {
                  const next = [...tiers];
                  next[index] = {
                    ...tier,
                    min_lifetime_points: Number.parseInt(e.target.value, 10) || 0,
                  };
                  setTiers(next);
                }}
                className={formInputClass}
              />
            </FormField>
            <FormField id={`tier-bps-${index}`} label="Pengali bps">
              <Input
                id={`tier-bps-${index}`}
                type="number"
                min={0}
                value={tier.earn_multiplier_bps}
                disabled={pending}
                placeholder="Pengali bps"
                onChange={(e) => {
                  const next = [...tiers];
                  next[index] = {
                    ...tier,
                    earn_multiplier_bps: Number.parseInt(e.target.value, 10) || 0,
                  };
                  setTiers(next);
                }}
                className={formInputClass}
              />
            </FormField>
          </div>
        ))}
        <Button
          type="button"
          className="w-fit rounded-md bg-secondary text-secondary-foreground"
          disabled={pending}
          onClick={() => setTiers([...tiers, emptyTier()])}
        >
          Tambah tingkat
        </Button>
      </FormSection>
      <FormActions
        error={error}
        pending={pending}
        submitLabel="Simpan program"
        cancelHref="/loyalty"
      />
    </form>
  );
}
