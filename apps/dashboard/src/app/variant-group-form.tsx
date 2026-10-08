"use client";

import { FormField, formInputClass } from "@pos-apps/ui/molecules";
import { FormActions, FormBackLink, FormDenied, FormSection, FormBody, formPageClassName } from "@pos-apps/ui/organisms";
import { Button, Input, Skeleton } from "@pos-apps/ui/atoms";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ApiErrorBody, VariantGroupListResponse } from "@pos-apps/types";
import { authorizedFetch } from "@/lib/api-client";

function errorMessage(res: Response, body: unknown): string {
  return (body as ApiErrorBody)?.message ?? `Gagal (${res.status})`;
}

export function VariantGroupForm({
  canCreate,
  canEdit,
  variantGroupId,
}: {
  canCreate: boolean;
  canEdit: boolean;
  variantGroupId?: string;
}) {
  const router = useRouter();
  const editing = Boolean(variantGroupId);
  const allowed = editing ? canEdit : canCreate;
  const [name, setName] = useState("");
  const [options, setOptions] = useState<string[]>([""]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(editing);
  const [missing, setMissing] = useState(false);

  const load = useCallback(async () => {
    if (!variantGroupId) return;
    setLoading(true);
    try {
      const res = await authorizedFetch("/catalog/variants");
      const data = (await res.json()) as VariantGroupListResponse | ApiErrorBody;
      if (!res.ok) {
        setError(errorMessage(res, data));
        return;
      }
      const row = (data as VariantGroupListResponse).variant_groups.find(
        (item) => item.variant_group_id === variantGroupId,
      );
      if (!row) {
        setMissing(true);
        return;
      }
      setName(row.name);
      setOptions(row.options.length ? row.options : [""]);
      setMissing(false);
    } catch {
      setError("Gagal memuat varian.");
    } finally {
      setLoading(false);
    }
  }, [variantGroupId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!allowed || pending) return;
    if (!options.some((o) => o.trim())) {
      setError("Isi minimal satu pilihan varian.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const res = await authorizedFetch(
        editing ? `/catalog/variants/${variantGroupId}` : "/catalog/variants",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, options: options.map((o) => o.trim()).filter(Boolean) }),
        },
      );
      if (!res.ok) {
        setError(errorMessage(res, await res.json().catch(() => ({}))));
        return;
      }
      router.push("/variants");
    } finally {
      setPending(false);
    }
  }

  async function onDelete() {
    if (!editing || !canEdit || pending || !variantGroupId) return;
    if (!window.confirm("Hapus varian ini?")) return;
    setPending(true);
    setError(null);
    try {
      const res = await authorizedFetch(`/catalog/variants/${variantGroupId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        setError(errorMessage(res, await res.json().catch(() => ({}))));
        return;
      }
      router.push("/variants");
    } finally {
      setPending(false);
    }
  }

  if (!allowed) {
    return (
      <FormDenied href="/variants">
        Anda tidak memiliki izin untuk {editing ? "mengubah" : "menambah"} varian.
      </FormDenied>
    );
  }

  if (loading) {
    return <Skeleton className="h-40 w-full rounded-xl" />;
  }

  if (missing) {
    return (
      <FormDenied href="/variants">Varian tidak ditemukan.</FormDenied>
    );
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className={formPageClassName}>
      <FormBody>
      <FormBackLink href="/variants">Daftar varian</FormBackLink>
      <FormSection
        title={editing ? "Ubah varian" : "Varian baru"}
        description="Jenis varian (mis. Ukuran, Suhu) beserta pilihannya. Dipilih di form produk."
      >
        <FormField id="category-name" label="Nama varian" required>
          <Input
            id="category-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="contoh: Ukuran"
            disabled={pending}
            className={formInputClass}
            required
          />
        </FormField>
        <FormField
          id="variant-options"
          label="Pilihan"
          required
          hint="Nilai yang bisa dipilih kasir, mis. S, M, L atau Hot, Ice."
        >
          <div className="flex flex-col gap-2">
            {options.map((option, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  aria-label={`Pilihan ${index + 1}`}
                  value={option}
                  onChange={(e) =>
                    setOptions((prev) =>
                      prev.map((o, i) => (i === index ? e.target.value : o)),
                    )
                  }
                  placeholder={index === 0 ? "contoh: S" : ""}
                  disabled={pending}
                  className={formInputClass}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={pending || options.length === 1}
                  onClick={() =>
                    setOptions((prev) => prev.filter((_, i) => i !== index))
                  }
                >
                  Hapus
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="secondary"
              className="self-start"
              disabled={pending}
              onClick={() => setOptions((prev) => [...prev, ""])}
            >
              Tambah pilihan
            </Button>
          </div>
        </FormField>
      </FormSection>
      </FormBody>
      <FormActions
        error={error}
        pending={pending}
        cancelHref="/variants"
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
