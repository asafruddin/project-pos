"use client";

import { Button, Input, Skeleton } from "@pos-apps/ui/atoms";
import { FormField, formInputClass } from "@pos-apps/ui/molecules";
import { FormActions, FormBackLink, FormSection } from "@pos-apps/ui/organisms";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  ApiErrorBody,
  CreateCustomerResponse,
  Customer,
  CustomerGroupListResponse,
  ProductListResponse,
} from "@pos-apps/types";
import { authorizedFetch } from "@/lib/api-client";
import { formatIdr } from "@/lib/format-money";

function productLabel(
  products: ProductListResponse["products"],
  productId: string,
): string {
  return products.find((row) => row.product_id === productId)?.name ?? productId;
}

export function CustomerForm({
  canDelete,
  customerId,
}: {
  canDelete: boolean;
  customerId?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(Boolean(customerId));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warn, setWarn] = useState<string | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [missing, setMissing] = useState(false);
  const [groups, setGroups] = useState<string[]>([]);
  const [products, setProducts] = useState<ProductListResponse["products"]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [groupName, setGroupName] = useState("");
  const [storeCredit, setStoreCredit] = useState("0");
  const [priceProductId, setPriceProductId] = useState("");
  const [priceMinor, setPriceMinor] = useState("");
  const [groupPriceProductId, setGroupPriceProductId] = useState("");
  const [groupPriceMinor, setGroupPriceMinor] = useState("");

  const applyCustomer = useCallback((row: Customer) => {
    setCustomer(row);
    setName(row.name);
    setPhone(row.phone ?? "");
    setEmail(row.email ?? "");
    setNotes(row.notes ?? "");
    setGroupName(row.group_name ?? "");
    setStoreCredit(String(row.store_credit_minor ?? 0));
  }, []);

  const load = useCallback(async () => {
    try {
      const [gRes, pRes, cRes] = await Promise.all([
        authorizedFetch("/customers/groups"),
        authorizedFetch("/catalog/products"),
        customerId
          ? authorizedFetch(`/customers/${customerId}`)
          : Promise.resolve(null),
      ]);
      if (gRes.ok) {
        const gData = (await gRes.json()) as CustomerGroupListResponse;
        setGroups(gData.groups);
      }
      if (pRes.ok) {
        const pData = (await pRes.json()) as ProductListResponse;
        setProducts(pData.products);
      }
      if (customerId && cRes) {
        const data = (await cRes.json()) as Customer | ApiErrorBody;
        if (!cRes.ok) {
          setMissing(true);
          setError((data as ApiErrorBody).message ?? "Pelanggan tidak ditemukan.");
          setLoading(false);
          return;
        }
        setMissing(false);
        applyCustomer(data as Customer);
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
      setError("Gagal memuat pelanggan.");
    } finally {
      setLoading(false);
    }
  }, [applyCustomer, customerId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (customerId && missing) return;
    setPending(true);
    setError(null);
    setWarn(null);
    try {
      const body = {
        name,
        phone: phone || null,
        email: email || null,
        notes: notes || null,
        group_name: canDelete ? groupName || null : undefined,
        store_credit_minor: canDelete
          ? Number.parseInt(storeCredit, 10) || 0
          : undefined,
      };
      const res = customerId
        ? await authorizedFetch(`/customers/${customerId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
        : await authorizedFetch("/customers", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
      const data = (await res.json()) as
        | Customer
        | CreateCustomerResponse
        | ApiErrorBody;
      if (!res.ok) {
        setError((data as ApiErrorBody).message ?? "Gagal menyimpan pelanggan.");
        return;
      }
      if ("warnings" in data && data.warnings?.includes("DUPLICATE_PHONE")) {
        setWarn("Nomor telepon sudah ada — pelanggan baru tetap disimpan.");
        return;
      }
      router.push("/customers", { scroll: false });
    } catch (err) {
      if (
        err instanceof Error &&
        (err.message === "AUTH_UNAUTHORIZED" ||
          err.message === "AUTH_SESSION_EXPIRED")
      ) {
        return;
      }
      setError("Gagal menyimpan pelanggan.");
    } finally {
      setPending(false);
    }
  }

  async function savePrice() {
    if (!customer || !canDelete || !priceProductId) return;
    setPending(true);
    setError(null);
    try {
      const res = await authorizedFetch(`/customers/${customer.customer_id}/prices`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: priceProductId,
          price_minor: priceMinor.trim() === "" ? null : Number.parseInt(priceMinor, 10),
        }),
      });
      const data = (await res.json()) as Customer | ApiErrorBody;
      if (!res.ok) {
        setError((data as ApiErrorBody).message ?? "Gagal menyimpan harga.");
        return;
      }
      applyCustomer(data as Customer);
      setPriceProductId("");
      setPriceMinor("");
    } finally {
      setPending(false);
    }
  }

  async function saveGroupPrice() {
    if (!customer?.group_name || !canDelete || !groupPriceProductId) return;
    setPending(true);
    setError(null);
    try {
      const res = await authorizedFetch("/customers/group-prices", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          group_name: customer.group_name,
          product_id: groupPriceProductId,
          price_minor:
            groupPriceMinor.trim() === ""
              ? null
              : Number.parseInt(groupPriceMinor, 10),
        }),
      });
      const data = (await res.json()) as ApiErrorBody | { price_minor: number | null };
      if (!res.ok) {
        setError((data as ApiErrorBody).message ?? "Gagal menyimpan harga grup.");
        return;
      }
      const fresh = await authorizedFetch(`/customers/${customer.customer_id}`);
      if (fresh.ok) applyCustomer((await fresh.json()) as Customer);
      setGroupPriceProductId("");
      setGroupPriceMinor("");
    } finally {
      setPending(false);
    }
  }

  async function onDelete() {
    if (!customer || !canDelete) return;
    setPending(true);
    try {
      const res = await authorizedFetch(`/customers/${customer.customer_id}`, {
        method: "DELETE",
      });
      if (res.status === 403) {
        setError("Kasir tidak dapat menghapus pelanggan.");
        return;
      }
      if (!res.ok) {
        setError("Gagal menghapus pelanggan.");
        return;
      }
      router.push("/customers");
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

  if (missing) {
    return (
      <div className="flex min-h-full flex-col gap-5">
        <FormBackLink href="/customers">Daftar pelanggan</FormBackLink>
        <p className="text-sm text-destructive" role="alert">
          {error ?? "Pelanggan tidak ditemukan."}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void onSave(e)} className="flex min-h-full flex-col gap-5">
      <FormBackLink href="/customers">Daftar pelanggan</FormBackLink>
      {warn ? (
        <p className="text-sm text-muted-foreground" role="status">
          {warn}
        </p>
      ) : null}

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
        <FormSection
          title="Profil"
          description="Nama tampil di kasir saat menempel pelanggan ke penjualan."
        >
          <FormField id="cust-name" label="Nama" required>
            <Input
              id="cust-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={pending}
              className={formInputClass}
            />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="cust-phone" label="Telepon">
              <Input
                id="cust-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={pending}
                className={formInputClass}
              />
            </FormField>
            <FormField id="cust-email" label="Email">
              <Input
                id="cust-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={pending}
                className={formInputClass}
              />
            </FormField>
          </div>
          <FormField id="cust-notes" label="Catatan">
            <Input
              id="cust-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={pending}
              className={formInputClass}
            />
          </FormField>
        </FormSection>

        {customerId && canDelete ? (
          <FormSection
            title="Harga khusus"
            description="Kosongkan harga untuk menghapus override."
          >
            {customer?.price_overrides?.length || customer?.group_price_overrides?.length ? (
              <ul className="space-y-1 text-sm text-muted-foreground">
                {customer?.price_overrides?.map((row) => (
                  <li key={`c-${row.product_id}`}>
                    Pelanggan · {productLabel(products, row.product_id)}:{" "}
                    {formatIdr(row.price_minor)}
                  </li>
                ))}
                {customer?.group_price_overrides?.map((row) => (
                  <li key={`g-${row.product_id}`}>
                    Grup · {productLabel(products, row.product_id)}:{" "}
                    {formatIdr(row.price_minor)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Belum ada harga khusus.</p>
            )}
            <FormField id="price-product" label="Produk">
              <Input
                id="price-product"
                value={priceProductId}
                onChange={(e) => setPriceProductId(e.target.value)}
                placeholder="Pilih produk"
                list="cust-products"
                disabled={pending}
                className={formInputClass}
              />
            </FormField>
            <FormField id="price-minor" label="Harga pelanggan (Rp)">
              <Input
                id="price-minor"
                inputMode="numeric"
                value={priceMinor}
                onChange={(e) => setPriceMinor(e.target.value)}
                disabled={pending}
                className={formInputClass}
              />
            </FormField>
            <Button
              type="button"
              disabled={pending}
              className="h-10 bg-secondary text-secondary-foreground hover:opacity-90"
              onClick={() => void savePrice()}
            >
              Simpan harga pelanggan
            </Button>
            {customer?.group_name ? (
              <>
                <FormField id="group-price-product" label={`Produk grup (${customer.group_name})`}>
                  <Input
                    id="group-price-product"
                    value={groupPriceProductId}
                    onChange={(e) => setGroupPriceProductId(e.target.value)}
                    placeholder="Pilih produk"
                    list="cust-products"
                    disabled={pending}
                    className={formInputClass}
                  />
                </FormField>
                <FormField id="group-price-minor" label="Harga grup (Rp)">
                  <Input
                    id="group-price-minor"
                    inputMode="numeric"
                    value={groupPriceMinor}
                    onChange={(e) => setGroupPriceMinor(e.target.value)}
                    disabled={pending}
                    className={formInputClass}
                  />
                </FormField>
                <Button
                  type="button"
                  disabled={pending}
                  className="h-10 bg-secondary text-secondary-foreground hover:opacity-90"
                  onClick={() => void saveGroupPrice()}
                >
                  Simpan harga grup
                </Button>
              </>
            ) : null}
            <datalist id="cust-products">
              {products.map((p) => (
                <option key={p.product_id} value={p.product_id}>
                  {p.name}
                </option>
              ))}
            </datalist>
          </FormSection>
        ) : null}

        <div className="flex flex-col gap-4">
          <FormSection title="Grup & kredit">
            {canDelete ? (
              <>
                <FormField id="cust-group" label="Grup">
                  <Input
                    id="cust-group"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    list="customer-groups"
                    disabled={pending}
                    className={formInputClass}
                  />
                  <datalist id="customer-groups">
                    {groups.map((g) => (
                      <option key={g} value={g} />
                    ))}
                  </datalist>
                </FormField>
                <FormField id="cust-credit" label="Kredit toko (Rp)">
                  <Input
                    id="cust-credit"
                    inputMode="numeric"
                    value={storeCredit}
                    onChange={(e) => setStoreCredit(e.target.value)}
                    disabled={pending}
                    className={formInputClass}
                  />
                </FormField>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Grup: {customer?.group_name ?? "—"}
                <br />
                Kredit toko: {formatIdr(customer?.store_credit_minor ?? 0)}
              </p>
            )}
            {customer ? (
              <p className="text-sm text-muted-foreground">
                Poin: {customer.loyalty_points ?? 0}
                {customer.loyalty_tier ? ` · ${customer.loyalty_tier}` : ""}
              </p>
            ) : null}
          </FormSection>
        </div>
      </div>

      <FormActions
        error={error}
        pending={pending}
        cancelHref="/customers"
        extra={
          customer && canDelete ? (
            <Button
              type="button"
              disabled={pending}
              className="bg-secondary text-destructive hover:opacity-90"
              onClick={() => void onDelete()}
            >
              Hapus
            </Button>
          ) : null
        }
      />
    </form>
  );
}
