"use client";

import { FormField, formInputClass } from "@pos-apps/ui/molecules";
import { FormActions, FormBackLink, FormDenied, FormSection, FormBody, formPageClassName } from "@pos-apps/ui/organisms";
import { Input } from "@pos-apps/ui/atoms";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { ApiErrorBody } from "@pos-apps/types";
import { authorizedFetch } from "@/lib/api-client";

function errorMessage(res: Response, body: unknown): string {
  return (body as ApiErrorBody)?.message ?? `Gagal (${res.status})`;
}

export function StoreForm({ canEdit }: { canEdit: boolean }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onCreateStore(e: FormEvent) {
    e.preventDefault();
    if (!canEdit || pending) return;
    setPending(true);
    setError(null);
    try {
      const res = await authorizedFetch("/stores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        setError(errorMessage(res, await res.json().catch(() => ({}))));
        return;
      }
      router.push("/stores");
    } finally {
      setPending(false);
    }
  }

  if (!canEdit) {
    return (
      <FormDenied href="/stores">
        Anda tidak memiliki izin untuk menambah toko.
      </FormDenied>
    );
  }

  return (
    <form onSubmit={(e) => void onCreateStore(e)} className={formPageClassName}>
      <FormBody>
      <FormBackLink href="/stores">Daftar toko</FormBackLink>
      <FormSection title="Toko baru" description="Store #1 tetap toko awal.">
        <FormField id="store-name" label="Nama toko" required>
          <Input
            id="store-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={pending}
            className={formInputClass}
          />
        </FormField>
      </FormSection>
      </FormBody>
      <FormActions
        error={error}
        pending={pending}
        cancelHref="/stores"
      />
    </form>
  );
}
