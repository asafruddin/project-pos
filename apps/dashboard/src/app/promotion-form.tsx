"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { ApiErrorBody, Promotion } from "@pos-apps/types";
import {
  FormActions,
  FormBackLink,
  FormDenied,
  FormField,
  FormSection,
  formInputClass,
  formSelectClass,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { authorizedFetch } from "@/lib/api-client";

export function PromotionForm({ canEdit }: { canEdit: boolean }) {
  const router = useRouter();
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

  async function savePromo(e: FormEvent) {
    e.preventDefault();
    if (!canEdit || pending) return;
    setPending(true);
    setError(null);
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
      router.push("/promotions");
    } finally {
      setPending(false);
    }
  }

  if (!canEdit) {
    return (
      <FormDenied href="/promotions">
        Kasir tidak dapat mengubah aturan promo.
      </FormDenied>
    );
  }

  return (
    <form onSubmit={(e) => void savePromo(e)} className="flex min-h-full flex-col gap-5">
      <FormBackLink href="/promotions">Daftar promo</FormBackLink>
      <FormSection
        title="Kampanye"
        description="Persen memakai bps (1000 = 10%). Kosongkan kupon untuk aturan otomatis."
      >
        <FormField id="promo-name" label="Nama" required>
          <Input
            id="promo-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={pending}
            className={formInputClass}
          />
        </FormField>
        <FormField id="promo-kind" label="Jenis" required>
          <select
            id="promo-kind"
            className={formSelectClass}
            value={kind}
            disabled={pending}
            onChange={(e) => setKind(e.target.value as "percent" | "fixed")}
          >
            <option value="percent">Persen (bps, 1000 = 10%)</option>
            <option value="fixed">Nominal tetap</option>
          </select>
        </FormField>
        {kind === "percent" ? (
          <FormField id="promo-bps" label="Persen (bps)" required>
            <Input
              id="promo-bps"
              type="number"
              value={percentBps}
              disabled={pending}
              onChange={(e) => setPercentBps(e.target.value)}
              className={formInputClass}
            />
          </FormField>
        ) : (
          <FormField id="promo-fixed" label="Nominal (Rp)" required>
            <Input
              id="promo-fixed"
              type="number"
              value={fixedMinor}
              disabled={pending}
              onChange={(e) => setFixedMinor(e.target.value)}
              className={formInputClass}
            />
          </FormField>
        )}
        <FormField
          id="promo-coupon"
          label="Kode kupon"
          hint="Kosongkan agar promo berlaku otomatis."
        >
          <Input
            id="promo-coupon"
            value={coupon}
            placeholder="Kode kupon (kosong = otomatis)"
            disabled={pending}
            onChange={(e) => setCoupon(e.target.value)}
            className={formInputClass}
          />
        </FormField>
        <div className="grid grid-cols-2 gap-2">
          <FormField id="promo-hour-start" label="Jam mulai">
            <Input
              id="promo-hour-start"
              type="number"
              min={0}
              max={23}
              value={hourStart}
              placeholder="Jam mulai"
              disabled={pending}
              onChange={(e) => setHourStart(e.target.value)}
              className={formInputClass}
            />
          </FormField>
          <FormField id="promo-hour-end" label="Jam selesai">
            <Input
              id="promo-hour-end"
              type="number"
              min={0}
              max={23}
              value={hourEnd}
              placeholder="Jam selesai"
              disabled={pending}
              onChange={(e) => setHourEnd(e.target.value)}
              className={formInputClass}
            />
          </FormField>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={exclusive}
            disabled={pending}
            onChange={(e) => setExclusive(e.target.checked)}
          />
          Eksklusif (tidak ditumpuk)
        </label>
      </FormSection>
      <FormActions
        error={error}
        pending={pending}
        submitLabel="Simpan promo"
        cancelHref="/promotions"
      />
    </form>
  );
}
