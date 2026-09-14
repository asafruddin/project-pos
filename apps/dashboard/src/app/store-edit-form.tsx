"use client";

import { FormField, formInputClass } from "@pos-apps/ui/molecules";
import {
  FormActions,
  FormBackLink,
  FormDenied,
  FormSection,
  FormBody,
  formPageClassName,
} from "@pos-apps/ui/organisms";
import { Input, Skeleton } from "@pos-apps/ui/atoms";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ApiErrorBody, StoreRecord } from "@pos-apps/types";
import { storeLogoFilePath } from "@pos-apps/types";
import { authorizedFetch } from "@/lib/api-client";
import { useAuthorizedImage } from "@/lib/use-authorized-image";

function errorMessage(res: Response, body: unknown): string {
  return (body as ApiErrorBody)?.message ?? `Gagal (${res.status})`;
}

export function StoreEditForm({
  canEdit,
  storeId,
}: {
  canEdit: boolean;
  storeId: string;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [hasLogo, setHasLogo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [logoNonce, setLogoNonce] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);

  const remoteLogo = useAuthorizedImage(
    hasLogo ? `${storeLogoFilePath(storeId)}?v=${logoNonce}` : null,
  );
  const logoSrc = preview ?? remoteLogo;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authorizedFetch(`/stores/${storeId}`);
      const data = (await res.json()) as StoreRecord | ApiErrorBody;
      if (!res.ok) {
        if (res.status === 404) {
          setMissing(true);
          return;
        }
        setError(errorMessage(res, data));
        return;
      }
      const store = data as StoreRecord;
      setName(store.name);
      setHasLogo(Boolean(store.logo_public_id || store.logo_secure_url));
      setMissing(false);
      setError(null);
    } catch {
      setError("Gagal memuat toko.");
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  async function onUpload(file: File) {
    if (!canEdit || pending) return;
    setPending(true);
    setError(null);
    const nextPreview = URL.createObjectURL(file);
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return nextPreview;
    });
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await authorizedFetch(`/stores/${storeId}/logo`, {
        method: "POST",
        body,
      });
      if (!res.ok) {
        setPreview((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return null;
        });
        setError(errorMessage(res, await res.json().catch(() => ({}))));
        return;
      }
      setHasLogo(true);
      setLogoNonce((n) => n + 1);
    } catch {
      setError("Gagal mengunggah gambar toko.");
    } finally {
      setPending(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canEdit || pending) return;
    setPending(true);
    setError(null);
    try {
      const res = await authorizedFetch(`/stores/${storeId}`, {
        method: "PATCH",
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
        Anda tidak memiliki izin untuk mengubah toko.
      </FormDenied>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  if (missing) {
    return (
      <FormDenied href="/stores">Toko tidak ditemukan.</FormDenied>
    );
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className={formPageClassName}>
      <FormBody>
        <FormBackLink href="/stores">Daftar toko</FormBackLink>
        <FormSection
          title="Identitas toko"
          description="Nama dan gambar tampil di dashboard dan kasir setelah masuk."
        >
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
        <FormSection
          title="Gambar"
          description="JPEG, PNG, WebP, atau GIF. Maksimal 8 MB."
        >
          <label
            htmlFor="storeLogo"
            className="flex cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-border bg-secondary/30 px-4 py-6 text-center text-sm text-muted-foreground hover:bg-secondary/50"
          >
            <span className="font-medium text-foreground">Unggah gambar</span>
            <span className="mt-1 text-xs">JPEG, PNG, WebP, atau GIF</span>
            <Input
              id="storeLogo"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              disabled={pending}
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void onUpload(file);
              }}
            />
          </label>
          {logoSrc ? (
            <div className="flex items-center gap-3 rounded-lg border border-border p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoSrc}
                alt="Gambar toko"
                className="size-16 rounded-md object-cover"
              />
              <p className="text-sm text-muted-foreground">
                Gambar ini tampil di akun yang terhubung ke toko ini.
              </p>
            </div>
          ) : null}
        </FormSection>
      </FormBody>
      <FormActions error={error} pending={pending} cancelHref="/stores" />
    </form>
  );
}
