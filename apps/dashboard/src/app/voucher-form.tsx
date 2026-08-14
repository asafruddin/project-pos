"use client";

import { FormField, formInputClass } from "@pos-apps/ui/molecules";
import { FormActions, FormBackLink, FormDenied, FormSection } from "@pos-apps/ui/organisms";
import { Input } from "@pos-apps/ui/atoms";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { ApiErrorBody, Voucher } from "@pos-apps/types";
import { authorizedFetch } from "@/lib/api-client";

export function VoucherForm({ canEdit }: { canEdit: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [voucherCode, setVoucherCode] = useState("");
  const [voucherRemaining, setVoucherRemaining] = useState("50000");

  async function saveVoucher(e: FormEvent) {
    e.preventDefault();
    if (!canEdit || pending) return;
    setPending(true);
    setError(null);
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
    <form onSubmit={(e) => void saveVoucher(e)} className="flex min-h-full flex-col gap-5">
      <FormBackLink href="/promotions">Daftar promo</FormBackLink>
      <FormSection title="Voucher" description="Kode dan sisa nilai voucher.">
        <FormField id="voucher-code" label="Kode voucher" required>
          <Input
            id="voucher-code"
            value={voucherCode}
            placeholder="Kode voucher"
            disabled={pending}
            onChange={(e) => setVoucherCode(e.target.value)}
            className={formInputClass}
          />
        </FormField>
        <FormField id="voucher-remaining" label="Sisa nilai (Rp)" required>
          <Input
            id="voucher-remaining"
            type="number"
            min={0}
            value={voucherRemaining}
            disabled={pending}
            onChange={(e) => setVoucherRemaining(e.target.value)}
            className={formInputClass}
          />
        </FormField>
      </FormSection>
      <FormActions
        error={error}
        pending={pending}
        submitLabel="Simpan voucher"
        cancelHref="/promotions"
      />
    </form>
  );
}
