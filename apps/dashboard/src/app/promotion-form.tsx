"use client";

import { FormField, formInputClass } from "@pos-apps/ui/molecules";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@pos-apps/ui/molecules";
import { FormActions, FormBackLink, FormDenied, FormSection, FormBody, formPageClassName } from "@pos-apps/ui/organisms";
import { Checkbox, Input, Label } from "@pos-apps/ui/atoms";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { ApiErrorBody, Promotion } from "@pos-apps/types";
import { authorizedFetch } from "@/lib/api-client";
import { parseGroupedInt } from "@/lib/format-money";

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
          percent_bps: kind === "percent" ? parseGroupedInt(percentBps) : null,
          fixed_minor: kind === "fixed" ? parseGroupedInt(fixedMinor) : null,
          coupon_code: coupon.trim() || null,
          exclusive,
          hour_start: hourStart.trim() ? parseGroupedInt(hourStart) : null,
          hour_end: hourEnd.trim() ? parseGroupedInt(hourEnd) : null,
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
    <form onSubmit={(e) => void savePromo(e)} className={formPageClassName}>
      <FormBody>
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
          <Select
            value={kind}
            disabled={pending}
            onValueChange={(value) => setKind(value as "percent" | "fixed")}
          >
            <SelectTrigger id="promo-kind">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="percent">Persen (bps, 1000 = 10%)</SelectItem>
              <SelectItem value="fixed">Nominal tetap</SelectItem>
            </SelectContent>
          </Select>
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
        <div className="flex items-center gap-2">
          <Checkbox
            id="promo-exclusive"
            checked={exclusive}
            disabled={pending}
            onCheckedChange={(checked) => setExclusive(checked === true)}
          />
          <Label htmlFor="promo-exclusive" className="font-normal">
            Eksklusif (tidak ditumpuk)
          </Label>
        </div>
      </FormSection>
      </FormBody>
      <FormActions
        error={error}
        pending={pending}
        submitLabel="Simpan promo"
        cancelHref="/promotions"
      />
    </form>
  );
}
