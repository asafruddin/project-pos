"use client";

import { FormField, formInputClass } from "@pos-apps/ui/molecules";
import { FormActions, FormBackLink, FormSection, FormBody, formPageClassName } from "@pos-apps/ui/organisms";
import { Checkbox, Input, Skeleton } from "@pos-apps/ui/atoms";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  ApiErrorBody,
  ProductListResponse,
  Supplier,
} from "@pos-apps/types";
import { authorizedFetch } from "@/lib/api-client";
import { fetchAllCatalogProductsAuth } from "@/lib/fetch-all-catalog";

export function SupplierForm({ supplierId }: { supplierId?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<ProductListResponse["products"]>([]);
  const [supplierName, setSupplierName] = useState("");
  const [contact, setContact] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [terms, setTerms] = useState("");
  const [suppliedIds, setSuppliedIds] = useState<Set<string>>(new Set());
  const [poCount, setPoCount] = useState(0);

  const load = useCallback(async () => {
    try {
      const [catalogResult, sRes] = await Promise.all([
        fetchAllCatalogProductsAuth(),
        supplierId
          ? authorizedFetch(`/purchasing/suppliers/${supplierId}`)
          : Promise.resolve(null),
      ]);
      if (catalogResult.ok) {
        setCatalog(catalogResult.products);
      }
      if (supplierId && sRes) {
        const data = (await sRes.json()) as Supplier | ApiErrorBody;
        if (!sRes.ok) {
          setError((data as ApiErrorBody).message ?? "Gagal memuat pemasok.");
          return;
        }
        const supplier = data as Supplier;
        setSupplierName(supplier.name);
        setContact(supplier.contact_name ?? "");
        setPhone(supplier.phone ?? "");
        setEmail(supplier.email ?? "");
        setTerms(supplier.payment_terms ?? "");
        setSuppliedIds(new Set(supplier.products.map((p) => p.product_id)));
        setPoCount(supplier.purchase_orders.length);
        setError(null);
      } else {
        setError(null);
      }
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
  }, [supplierId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSaveSupplier(e: FormEvent) {
    e.preventDefault();
    if (!supplierName.trim()) {
      setError("Nama pemasok wajib diisi.");
      return;
    }
    setPending(true);
    const body = {
      name: supplierName.trim(),
      contact_name: contact.trim() || null,
      phone: phone.trim() || null,
      email: email.trim() || null,
      payment_terms: terms.trim() || null,
      products: [...suppliedIds].map((product_id) => ({ product_id })),
    };
    try {
      const path = supplierId
        ? `/purchasing/suppliers/${supplierId}`
        : "/purchasing/suppliers";
      const res = await authorizedFetch(path, {
        method: supplierId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as Supplier | ApiErrorBody;
      if (!res.ok) {
        setError((data as ApiErrorBody).message ?? "Gagal menyimpan pemasok.");
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

  if (supplierId && error && !supplierName) {
    return (
      <div className="flex flex-col gap-4">
        <FormBackLink href="/purchasing">Daftar pembelian</FormBackLink>
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => void onSaveSupplier(e)}
      className={formPageClassName}
    >
      <FormBody>
      <FormBackLink href="/purchasing">Daftar pembelian</FormBackLink>

      <FormSection title="Pemasok" description="Nama wajib. Kontak opsional.">
        <FormField id="supName" label="Nama" required>
          <Input
            id="supName"
            value={supplierName}
            onChange={(e) => setSupplierName(e.target.value)}
            disabled={pending}
            className={formInputClass}
          />
        </FormField>
        <FormField id="supContact" label="Kontak">
          <Input
            id="supContact"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            disabled={pending}
            className={formInputClass}
          />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="supPhone" label="Telepon">
            <Input
              id="supPhone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={pending}
              className={formInputClass}
            />
          </FormField>
          <FormField id="supEmail" label="Email">
            <Input
              id="supEmail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={pending}
              className={formInputClass}
            />
          </FormField>
        </div>
        <FormField id="supTerms" label="Syarat bayar">
          <Input
            id="supTerms"
            value={terms}
            onChange={(e) => setTerms(e.target.value)}
            disabled={pending}
            className={formInputClass}
          />
        </FormField>
      </FormSection>

      <FormSection title="Produk dipasok">
        <div className="max-h-40 overflow-y-auto rounded-md border border-border p-3">
          {catalog.length === 0 ? (
            <p className="text-sm text-muted-foreground">Tidak ada produk.</p>
          ) : (
            catalog.map((p) => (
              <label
                key={p.product_id}
                className="flex items-center gap-2 py-1 text-sm"
              >
                <Checkbox
                  checked={suppliedIds.has(p.product_id)}
                  onCheckedChange={(checked) => {
                    setSuppliedIds((prev) => {
                      const next = new Set(prev);
                      if (checked === true) next.add(p.product_id);
                      else next.delete(p.product_id);
                      return next;
                    });
                  }}
                  disabled={pending}
                />
                {p.name}
              </label>
            ))
          )}
        </div>
        {poCount ? (
          <p className="text-sm text-muted-foreground">
            Riwayat: {poCount} pesanan
          </p>
        ) : null}
      </FormSection>

      </FormBody>
      <FormActions
        error={error}
        pending={pending}
        cancelHref="/purchasing"
      />
    </form>
  );
}
