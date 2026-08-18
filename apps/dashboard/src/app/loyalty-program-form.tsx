"use client";

import { Button, Checkbox, Input, Label, Skeleton } from "@pos-apps/ui/atoms";
import { FormField, formInputClass } from "@pos-apps/ui/molecules";
import { FormActions, FormBackLink, FormDenied, FormSection, FormBody, formPageClassName } from "@pos-apps/ui/organisms";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  ApiErrorBody,
  LoyaltyProgram,
  LoyaltyTierRule,
  UpdateLoyaltyProgramRequest,
} from "@pos-apps/types";
import { authorizedFetch } from "@/lib/api-client";
import { getAccessToken, isAccessTokenExpired, logoutToLogin } from "@/lib/auth-token";
import { parseGroupedInt } from "@/lib/format-money";

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
    const earn = parseGroupedInt(earnPerMinor);
    const value = parseGroupedInt(pointValueMinor);
    const expire = expireDays.trim() ? parseGroupedInt(expireDays) : null;
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
      <div className="flex flex-col gap-5">
      
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
    <form onSubmit={(e) => void saveProgram(e)} className={formPageClassName}>
      <FormBody>
      <FormBackLink href="/loyalty">Loyalitas</FormBackLink>
      <FormSection title="Program poin" description="Aturan poin bersama untuk seluruh toko.">
        <div className="flex items-center gap-2">
          <Checkbox
            id="loyalty-enabled"
            checked={enabled}
            disabled={pending}
            onCheckedChange={(checked) => setEnabled(checked === true)}
          />
          <Label htmlFor="loyalty-enabled" className="font-normal">
            Program aktif
          </Label>
        </div>
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
                    min_lifetime_points: parseGroupedInt(e.target.value) || 0,
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
                    earn_multiplier_bps: parseGroupedInt(e.target.value) || 0,
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
      
      </FormBody>
      <FormActions
        error={error}
        pending={pending}
        submitLabel="Simpan program"
        cancelHref="/loyalty"
      />
    </form>
  );
}
