"use client";

import { FormField, formInputClass } from "@pos-apps/ui/molecules";
import { FormActions, FormBackLink, FormDenied, FormSection, FormBody, formPageClassName } from "@pos-apps/ui/organisms";
import { Button, Input, Skeleton } from "@pos-apps/ui/atoms";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ApiErrorBody, CategoryListResponse } from "@pos-apps/types";
import { authorizedFetch } from "@/lib/api-client";

function errorMessage(res: Response, body: unknown): string {
  return (body as ApiErrorBody)?.message ?? `Gagal (${res.status})`;
}

export function CategoryForm({
  canCreate,
  canEdit,
  categoryId,
}: {
  canCreate: boolean;
  canEdit: boolean;
  categoryId?: string;
}) {
  const router = useRouter();
  const editing = Boolean(categoryId);
  const allowed = editing ? canEdit : canCreate;
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(editing);
  const [missing, setMissing] = useState(false);

  const load = useCallback(async () => {
    if (!categoryId) return;
    setLoading(true);
    try {
      const res = await authorizedFetch("/catalog/categories");
      const data = (await res.json()) as CategoryListResponse | ApiErrorBody;
      if (!res.ok) {
        setError(errorMessage(res, data));
        return;
      }
      const row = (data as CategoryListResponse).categories.find(
        (item) => item.category_id === categoryId,
      );
      if (!row) {
        setMissing(true);
        return;
      }
      setName(row.name);
      setMissing(false);
    } catch {
      setError("Gagal memuat kategori.");
    } finally {
      setLoading(false);
    }
  }, [categoryId]);

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
        editing ? `/catalog/categories/${categoryId}` : "/catalog/categories",
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
      router.push("/categories");
    } finally {
      setPending(false);
    }
  }

  async function onDelete() {
    if (!editing || !canEdit || pending || !categoryId) return;
    if (!window.confirm("Hapus kategori ini?")) return;
    setPending(true);
    setError(null);
    try {
      const res = await authorizedFetch(`/catalog/categories/${categoryId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        setError(errorMessage(res, await res.json().catch(() => ({}))));
        return;
      }
      router.push("/categories");
    } finally {
      setPending(false);
    }
  }

  if (!allowed) {
    return (
      <FormDenied href="/categories">
        Anda tidak memiliki izin untuk {editing ? "mengubah" : "menambah"} kategori.
      </FormDenied>
    );
  }

  if (loading) {
    return <Skeleton className="h-40 w-full rounded-xl" />;
  }

  if (missing) {
    return (
      <FormDenied href="/categories">Kategori tidak ditemukan.</FormDenied>
    );
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className={formPageClassName}>
      <FormBody>
      <FormBackLink href="/categories">Daftar kategori</FormBackLink>
      <FormSection
        title={editing ? "Ubah kategori" : "Kategori baru"}
        description="Dipakai sebagai pilihan di form produk untuk toko Anda."
      >
        <FormField id="category-name" label="Nama kategori" required>
          <Input
            id="category-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="contoh: Minuman"
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
        cancelHref="/categories"
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
