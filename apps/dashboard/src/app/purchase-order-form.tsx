"use client";

import { Button, Input, Skeleton } from "@pos-apps/ui/atoms";
import { FormField, formInputClass } from "@pos-apps/ui/molecules";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toSelectValue,
  fromSelectValue,
} from "@pos-apps/ui/molecules";
import { FormActions, FormBackLink, FormSection, FormBody, formPageClassName } from "@pos-apps/ui/organisms";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  ApiErrorBody,
  ProductListResponse,
  PurchaseOrderDetail,
  SupplierListResponse,
} from "@pos-apps/types";
import { authorizedFetch } from "@/lib/api-client";
import { fetchAllCatalogProductsAuth } from "@/lib/fetch-all-catalog";
import { parseGroupedInt } from "@/lib/format-money";

export function PurchaseOrderForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suppliers, setSuppliers] = useState<SupplierListResponse["suppliers"]>(
    [],
  );
  const [catalog, setCatalog] = useState<ProductListResponse["products"]>([]);
  const [poSupplierId, setPoSupplierId] = useState("");
  const [poLines, setPoLines] = useState<
    Array<{ product_id: string; qty: string; cost_minor: string }>
  >([{ product_id: "", qty: "1", cost_minor: "0" }]);

  const load = useCallback(async () => {
    try {
      const [sRes, catalog] = await Promise.all([
        authorizedFetch("/purchasing/suppliers"),
        fetchAllCatalogProductsAuth(),
      ]);
      const sData = (await sRes.json()) as SupplierListResponse | ApiErrorBody;
      if (!sRes.ok) {
        setError((sData as ApiErrorBody).message ?? "Gagal memuat pemasok.");
        return;
      }
      setSuppliers((sData as SupplierListResponse).suppliers);
      if (catalog.ok) {
        setCatalog(catalog.products);
      }
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
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreatePo(e: FormEvent) {
    e.preventDefault();
    if (!poSupplierId) {
      setError("Pilih pemasok.");
      return;
    }
    const lines = poLines
      .filter((line) => line.product_id)
      .map((line) => ({
        product_id: line.product_id,
        qty: parseGroupedInt(line.qty),
        cost_minor: parseGroupedInt(line.cost_minor),
      }));
    setPending(true);
    try {
      const res = await authorizedFetch("/purchasing/purchase-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplier_id: poSupplierId,
          lines: lines.length ? lines : undefined,
        }),
      });
      const data = (await res.json()) as PurchaseOrderDetail | ApiErrorBody;
      if (!res.ok) {
        setError((data as ApiErrorBody).message ?? "Gagal membuat pesanan.");
        return;
      }
      router.push("/purchasing");
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

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-40 w-full max-w-md" />
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => void onCreatePo(e)}
      className={formPageClassName}
    >
      <FormBody>
      <FormBackLink href="/purchasing">Daftar pembelian</FormBackLink>

      <FormSection
        title="Pesanan"
        description="Pilih pemasok dan item. Draf belum mengubah stok."
      >
        <FormField id="poSupplier" label="Pemasok" required>
          <Select
            value={toSelectValue(poSupplierId)}
            onValueChange={(value) => setPoSupplierId(fromSelectValue(value))}
            disabled={pending}
          >
            <SelectTrigger id="poSupplier">
              <SelectValue placeholder="Pilih pemasok" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={toSelectValue("")}>Pilih pemasok</SelectItem>
              {suppliers.map((item) => (
                <SelectItem key={item.supplier_id} value={item.supplier_id}>
                  {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        {poLines.map((line, index) => (
          <div key={index} className="grid gap-3 sm:grid-cols-[1fr_6rem_8rem]">
            <FormField label="Produk">
              <Select
                value={toSelectValue(line.product_id)}
                onValueChange={(value) => {
                  const next = [...poLines];
                  next[index] = { ...line, product_id: fromSelectValue(value) };
                  setPoLines(next);
                }}
                disabled={pending}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Produk" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={toSelectValue("")}>Produk</SelectItem>
                  {catalog.map((p) => (
                    <SelectItem key={p.product_id} value={p.product_id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Jumlah">
              <Input
                inputMode="numeric"
                value={line.qty}
                onChange={(e) => {
                  const next = [...poLines];
                  next[index] = { ...line, qty: e.target.value };
                  setPoLines(next);
                }}
                className={formInputClass}
                disabled={pending}
                aria-label="Jumlah"
              />
            </FormField>
            <FormField label="Harga pokok">
              <Input
                inputMode="numeric"
                value={line.cost_minor}
                onChange={(e) => {
                  const next = [...poLines];
                  next[index] = { ...line, cost_minor: e.target.value };
                  setPoLines(next);
                }}
                className={formInputClass}
                disabled={pending}
                aria-label="Harga pokok"
              />
            </FormField>
          </div>
        ))}
        <Button
          type="button"
          className="h-10 w-fit bg-secondary text-secondary-foreground hover:opacity-90"
          onClick={() =>
            setPoLines((prev) => [
              ...prev,
              { product_id: "", qty: "1", cost_minor: "0" },
            ])
          }
          disabled={pending}
        >
          Tambah item
        </Button>
      </FormSection>

      </FormBody>
      <FormActions
        error={error}
        pending={pending}
        submitLabel="Buat draf PO"
        cancelHref="/purchasing"
      />
    </form>
  );
}
