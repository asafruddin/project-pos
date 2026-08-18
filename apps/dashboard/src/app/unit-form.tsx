"use client";

import { FormField, formInputClass } from "@pos-apps/ui/molecules";
import { FormActions, FormBackLink, FormDenied, FormSection, FormBody, formPageClassName } from "@pos-apps/ui/organisms";
import { Button, Input, Skeleton } from "@pos-apps/ui/atoms";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ApiErrorBody, UnitListResponse } from "@pos-apps/types";
import { authorizedFetch } from "@/lib/api-client";

function errorMessage(res: Response, body: unknown): string {
  return (body as ApiErrorBody)?.message ?? `Gagal (${res.status})`;
}

export function UnitForm({
  canCreate,
  canEdit,
  unitId,
}: {
  canCreate: boolean;
  canEdit: boolean;
  unitId?: string;
}) {
  const router = useRouter();
  const editing = Boolean(unitId);
  const allowed = editing ? canEdit : canCreate;
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(editing);
  const [missing, setMissing] = useState(false);

  const load = useCallback(async () => {
    if (!unitId) return;
    setLoading(true);
    try {
      const res = await authorizedFetch("/catalog/units");
      const data = (await res.json()) as UnitListResponse | ApiErrorBody;
      if (!res.ok) {
        setError(errorMessage(res, data));
        return;
      }
      const row = (data as UnitListResponse).units.find(
        (item) => item.unit_id === unitId,
      );
      if (!row) {
        setMissing(true);
        return;
      }
      setName(row.name);
      setMissing(false);
    } catch {
      setError("Gagal memuat satuan.");
    } finally {
      setLoading(false);
    }
  }, [unitId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!allowed || pending) return;
    setPending(true);
    setError(null);
    try {
      const res = await authorizedFetch(
        editing ? `/catalog/units/${unitId}` : "/catalog/units",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        },
      );
      if (!res.ok) {
        setError(errorMessage(res, await res.json().catch(() => ({}))));
        return;
      }
      router.push("/units");
    } finally {
      setPending(false);
    }
  }

  async function onDelete() {
    if (!editing || !canEdit || pending || !unitId) return;
    if (!window.confirm("Hapus satuan ini?")) return;
    setPending(true);
    setError(null);
    try {
      const res = await authorizedFetch(`/catalog/units/${unitId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        setError(errorMessage(res, await res.json().catch(() => ({}))));
        return;
      }
      router.push("/units");
    } finally {
      setPending(false);
    }
  }

  if (!allowed) {
    return (
      <FormDenied href="/units">
        Anda tidak memiliki izin untuk {editing ? "mengubah" : "menambah"} satuan.
      </FormDenied>
    );
  }

  if (loading) {
    return <Skeleton className="h-40 w-full rounded-xl" />;
  }

  if (missing) {
    return <FormDenied href="/units">Satuan tidak ditemukan.</FormDenied>;
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className={formPageClassName}>
      <FormBody>
      <FormBackLink href="/units">Daftar satuan</FormBackLink>
      <FormSection
        title={editing ? "Ubah satuan" : "Satuan baru"}
        description="Contoh: pcs, kg, slop. Dipakai sebagai pilihan di form produk."
      >
        <FormField id="unit-name" label="Nama satuan" required>
          <Input
            id="unit-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="contoh: pcs"
            disabled={pending}
            className={formInputClass}
            required
          />
        </FormField>
      </FormSection>
      </FormBody>
      <FormActions
        error={error}
        pending={pending}
        cancelHref="/units"
        extra={
          editing && canEdit ? (
            <Button
              type="button"
              variant="ghost"
              className="mr-auto text-destructive hover:text-destructive"
              disabled={pending}
              onClick={() => void onDelete()}
            >
              Hapus
            </Button>
          ) : undefined
        }
      />
    </form>
  );
}
