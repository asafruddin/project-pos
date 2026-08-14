"use client";

import { FormActions, FormBackLink, FormDenied, FormSection } from "@pos-apps/ui/organisms";
import { Checkbox, Skeleton } from "@pos-apps/ui/atoms";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  ApiErrorBody,
  OpnameDetail,
  StockOverviewResponse,
} from "@pos-apps/types";
import { authorizedFetch } from "@/lib/api-client";

export function OpnameForm({ canMutate }: { canMutate: boolean }) {
  const router = useRouter();
  const [catalog, setCatalog] = useState<StockOverviewResponse["products"]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const ovRes = await authorizedFetch("/inventory/overview");
      const ovData = (await ovRes.json()) as StockOverviewResponse | ApiErrorBody;
      if (!ovRes.ok) {
        setError((ovData as ApiErrorBody).message ?? "Gagal memuat produk.");
        return;
      }
      setError(null);
      setCatalog((ovData as StockOverviewResponse).products);
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
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (picked.size === 0) {
      setError("Pilih minimal satu produk.");
      return;
    }
    setPending(true);
    try {
      const res = await authorizedFetch("/inventory/opnames", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_ids: [...picked] }),
      });
      const data = (await res.json()) as OpnameDetail | ApiErrorBody;
      if (!res.ok) {
        setError((data as ApiErrorBody).message ?? "Gagal membuat opname.");
        return;
      }
      router.push("/opname");
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
      <FormDenied href="/opname">
        Anda tidak memiliki izin membuat opname. Gunakan daftar opname untuk melihat
        draf yang sudah ada.
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

  return (
    <form onSubmit={(e) => void onCreate(e)} className="flex min-h-full flex-col gap-5">
      <FormBackLink href="/opname">Daftar opname</FormBackLink>

      <FormSection
        title="Produk"
        description="Pilih produk yang akan dihitung. Draf tidak mengubah stok."
      >
        <div className="max-h-80 overflow-y-auto rounded-md border border-border p-3">
          {catalog.length === 0 ? (
            <p className="text-sm text-muted-foreground">Tidak ada produk.</p>
          ) : (
            catalog.map((row) => (
              <label
                key={row.product_id}
                className="flex items-center gap-2 py-1 text-sm"
              >
                <Checkbox
                  checked={picked.has(row.product_id)}
                  onCheckedChange={(checked) => {
                    setPicked((prev) => {
                      const next = new Set(prev);
                      if (checked === true) next.add(row.product_id);
                      else next.delete(row.product_id);
                      return next;
                    });
                  }}
                  disabled={pending}
                />
                <span>
                  {row.name}{" "}
                  <span className="text-muted-foreground">
                    (dijual {row.sellable_qty})
                  </span>
                </span>
              </label>
            ))
          )}
        </div>
      </FormSection>

      <FormActions
        error={error}
        pending={pending}
        submitLabel="Buat draf"
        cancelHref="/opname"
      />
    </form>
  );
}
