"use client";

import { FormField, formInputClass } from "@pos-apps/ui/molecules";
import { FormActions, FormBackLink, FormDenied, FormSection, FormBody, formPageClassName } from "@pos-apps/ui/organisms";
import { Input, Skeleton } from "@pos-apps/ui/atoms";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type {
  ApiErrorBody,
  StockOverviewItem,
  StockOverviewResponse,
} from "@pos-apps/types";
import { authorizedFetch } from "@/lib/api-client";

export function StockDamageForm({
  productId,
  canMutate,
}: {
  productId: string;
  canMutate: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const storeId = searchParams.get("store_id");
  const [product, setProduct] = useState<StockOverviewItem | null>(null);
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!storeId) {
      setError("Toko wajib dipilih dari ikhtisar stok.");
      setProduct(null);
      setLoading(false);
      return;
    }
    try {
      const qs = `?store_id=${encodeURIComponent(storeId)}`;
      const res = await authorizedFetch(`/inventory/overview${qs}`);
      const data = (await res.json()) as StockOverviewResponse | ApiErrorBody;
      if (!res.ok) {
        setError((data as ApiErrorBody).message ?? "Gagal memuat ikhtisar stok.");
        return;
      }
      const row = (data as StockOverviewResponse).products.find(
        (item) => item.product_id === productId,
      );
      if (!row) {
        setError("Produk tidak ditemukan.");
        setProduct(null);
        return;
      }
      setProduct(row);
      setError(null);
    } catch (err) {
      if (
        err instanceof Error &&
        (err.message === "AUTH_UNAUTHORIZED" ||
          err.message === "AUTH_SESSION_EXPIRED")
      ) {
        return;
      }
      setError("Tidak dapat menghubungi API.");
    } finally {
      setLoading(false);
    }
  }, [productId, storeId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onMarkDamaged(e: FormEvent) {
    e.preventDefault();
    const n = Number(qty);
    if (!Number.isInteger(n) || n < 1) {
      setError("Jumlah rusak harus bilangan bulat ≥ 1.");
      return;
    }
    if (!storeId) {
      setError("Toko wajib dipilih dari ikhtisar stok.");
      return;
    }
    if (!reason.trim()) {
      setError("Alasan wajib saat memindah ke rusak.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const qs = storeId ? `?store_id=${encodeURIComponent(storeId)}` : "";
      const res = await authorizedFetch(
        `/inventory/products/${productId}/damaged${qs}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ qty: n, reason: reason.trim() }),
        },
      );
      const data = (await res.json()) as StockOverviewItem | ApiErrorBody;
      if (!res.ok) {
        setError((data as ApiErrorBody).message ?? "Gagal memindah stok.");
        return;
      }
      router.push("/stock");
    } catch (err) {
      if (
        err instanceof Error &&
        (err.message === "AUTH_UNAUTHORIZED" ||
          err.message === "AUTH_SESSION_EXPIRED")
      ) {
        return;
      }
      setError("Tidak dapat menghubungi API.");
    } finally {
      setPending(false);
    }
  }

  if (!canMutate) {
    return (
      <FormDenied href="/stock">
        Anda tidak memiliki izin memindah stok ke rusak.
      </FormDenied>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-40 w-full max-w-md" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex flex-col gap-4">
        <FormBackLink href="/stock">Ikhtisar stok</FormBackLink>
        <p className="text-sm text-destructive" role="alert">
          {error ?? "Produk tidak ditemukan."}
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => void onMarkDamaged(e)}
      className={formPageClassName}
    >
      <FormBody>
      <FormBackLink href="/stock">Ikhtisar stok</FormBackLink>

      <FormSection
        title="Pindah ke rusak"
        description={product.name}
      >
        <FormField id="dmgQty" label="Jumlah" required>
          <Input
            id="dmgQty"
            inputMode="numeric"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            disabled={pending}
            className={formInputClass}
          />
        </FormField>
        <FormField id="dmgReason" label="Alasan" required hint="contoh: pecah saat kirim">
          <Input
            id="dmgReason"
            placeholder="contoh: pecah saat kirim"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={pending}
            className={formInputClass}
          />
        </FormField>
      </FormSection>

      </FormBody>
      <FormActions
        error={error}
        pending={pending}
        cancelHref="/stock"
      />
    </form>
  );
}
