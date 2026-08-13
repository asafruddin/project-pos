"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ApiErrorBody, StoreListResponse, StoreRecord } from "@pos-apps/types";
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

function errorMessage(res: Response, body: unknown): string {
  return (body as ApiErrorBody)?.message ?? `Gagal (${res.status})`;
}

export function RegisterForm({
  canEdit,
  storeId,
}: {
  canEdit: boolean;
  storeId: string;
}) {
  const router = useRouter();
  const [store, setStore] = useState<StoreRecord | null>(null);
  const [registerName, setRegisterName] = useState("Register 2");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  const load = useCallback(async () => {
    try {
      const storeRes = await authorizedFetch("/stores");
      const storeData = (await storeRes.json()) as StoreListResponse | ApiErrorBody;
      if (!storeRes.ok) {
        setError(errorMessage(storeRes, storeData));
        setMissing(true);
        return;
      }
      const packed = storeData as StoreListResponse;
      const row = packed.stores.find((item) => item.store_id === storeId);
      if (!row) {
        setError("Toko tidak ditemukan.");
        setMissing(true);
        return;
      }
      setStore(row);
      setError(null);
    } catch {
      setError("Gagal memuat toko.");
      setMissing(true);
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreateRegister(e: FormEvent) {
    e.preventDefault();
    if (!canEdit || pending) return;
    setPending(true);
    setError(null);
    try {
      const res = await authorizedFetch("/registers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ store_id: storeId, name: registerName }),
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
        Anda tidak memiliki izin untuk menambah register.
      </FormDenied>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-36 w-full" />
      </div>
    );
  }

  if (missing || !store) {
    return (
      <div className="flex min-h-full flex-col gap-5">
        <FormBackLink href="/stores">Daftar toko</FormBackLink>
        <p className="text-sm text-destructive" role="alert">
          {error ?? "Toko tidak ditemukan."}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void onCreateRegister(e)} className="flex min-h-full flex-col gap-5">
      <FormBackLink href="/stores">Daftar toko</FormBackLink>
      <FormSection
        title="Register baru"
        description={`Register terikat pada ${store.name}, bukan Checkout.`}
      >
        <FormField id="reg-name" label="Nama register" required>
          <Input
            id="reg-name"
            value={registerName}
            onChange={(e) => setRegisterName(e.target.value)}
            disabled={pending}
            className={formInputClass}
          />
        </FormField>
      </FormSection>
      <FormActions
        error={error}
        pending={pending}
        cancelHref="/stores"
      />
    </form>
  );
}
