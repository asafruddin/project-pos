"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import type {
  ApiErrorBody,
  CreateCustomerResponse,
  Customer,
  CustomerGroupListResponse,
  CustomerHistoryResponse,
  CustomerListResponse,
  ProductListResponse,
} from "@pos-apps/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authorizedFetch } from "@/lib/api-client";
import { getAccessToken, isAccessTokenExpired, logoutToLogin } from "@/lib/auth-token";
import { formatIdr } from "@/lib/format-money";

function productLabel(
  products: ProductListResponse["products"],
  productId: string,
): string {
  return products.find((row) => row.product_id === productId)?.name ?? productId;
}

export function CustomersPanel({ canDelete }: { canDelete: boolean }) {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<Customer[]>([]);
  const [groups, setGroups] = useState<string[]>([]);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [history, setHistory] = useState<CustomerHistoryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warn, setWarn] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [groupName, setGroupName] = useState("");
  const [storeCredit, setStoreCredit] = useState("0");
  const [products, setProducts] = useState<ProductListResponse["products"]>([]);
  const [priceProductId, setPriceProductId] = useState("");
  const [priceMinor, setPriceMinor] = useState("");
  const [groupPriceProductId, setGroupPriceProductId] = useState("");
  const [groupPriceMinor, setGroupPriceMinor] = useState("");

  const load = useCallback(async (q?: string) => {
    const token = getAccessToken();
    if (!token || isAccessTokenExpired(token)) {
      logoutToLogin();
      return;
    }
    try {
      const qs = q?.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
      const [cRes, gRes, pRes] = await Promise.all([
        authorizedFetch(`/customers${qs}`),
        authorizedFetch("/customers/groups"),
        authorizedFetch("/catalog/products"),
      ]);
      const cData = (await cRes.json()) as CustomerListResponse | ApiErrorBody;
      const gData = (await gRes.json()) as CustomerGroupListResponse | ApiErrorBody;
      if (!cRes.ok) {
        setError((cData as ApiErrorBody).message ?? "Gagal memuat pelanggan.");
        return;
      }
      setError(null);
      setRows((cData as CustomerListResponse).customers);
      if (gRes.ok) setGroups((gData as CustomerGroupListResponse).groups);
      if (pRes.ok) {
        const pData = (await pRes.json()) as ProductListResponse;
        setProducts(pData.products);
      }
    } catch (err) {
      if (
        err instanceof Error &&
        (err.message === "AUTH_UNAUTHORIZED" ||
          err.message === "AUTH_SESSION_EXPIRED")
      ) {
        return;
      }
      setError("Gagal memuat pelanggan.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function fill(row: Customer | null) {
    setSelected(row);
    setHistory(null);
    setWarn(null);
    setName(row?.name ?? "");
    setPhone(row?.phone ?? "");
    setEmail(row?.email ?? "");
    setNotes(row?.notes ?? "");
    setGroupName(row?.group_name ?? "");
    setStoreCredit(String(row?.store_credit_minor ?? 0));
    setPriceProductId("");
    setPriceMinor("");
    setGroupPriceProductId("");
    setGroupPriceMinor("");
  }

  async function openHistory(row: Customer) {
    fill(row);
    try {
      const res = await authorizedFetch(`/customers/${row.customer_id}/history`);
      if (!res.ok) return;
      setHistory((await res.json()) as CustomerHistoryResponse);
    } catch {
      /* list still usable */
    }
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
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
      const res = selected
        ? await authorizedFetch(`/customers/${selected.customer_id}`, {
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
      const saved =
        "customer" in data && data.customer
          ? (data as CreateCustomerResponse).customer
          : (data as Customer);
      if ("warnings" in data && data.warnings?.includes("DUPLICATE_PHONE")) {
        setWarn("Nomor telepon sudah ada — pelanggan baru tetap disimpan.");
      }
      fill(saved);
      await load(query);
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
    if (!selected || !canDelete || !priceProductId) return;
    setPending(true);
    setError(null);
    try {
      const res = await authorizedFetch(
        `/customers/${selected.customer_id}/prices`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            product_id: priceProductId,
            price_minor: priceMinor.trim() === "" ? null : Number.parseInt(priceMinor, 10),
          }),
        },
      );
      const data = (await res.json()) as Customer | ApiErrorBody;
      if (!res.ok) {
        setError((data as ApiErrorBody).message ?? "Gagal menyimpan harga.");
        return;
      }
      fill(data as Customer);
      await load(query);
    } finally {
      setPending(false);
    }
  }

  async function saveGroupPrice() {
    if (!selected?.group_name || !canDelete || !groupPriceProductId) return;
    setPending(true);
    setError(null);
    try {
      const res = await authorizedFetch("/customers/group-prices", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          group_name: selected.group_name,
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
      const fresh = await authorizedFetch(`/customers/${selected.customer_id}`);
      if (fresh.ok) fill((await fresh.json()) as Customer);
      await load(query);
    } finally {
      setPending(false);
    }
  }

  async function onDelete() {
    if (!selected || !canDelete) return;
    setPending(true);
    try {
      const res = await authorizedFetch(`/customers/${selected.customer_id}`, {
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
      fill(null);
      await load(query);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)]">
      <div className="space-y-4">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void load(query);
          }}
        >
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari nama, telepon, email"
          />
          <Button type="submit" className="rounded-md bg-secondary text-secondary-foreground">
            Cari
          </Button>
        </form>
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.customer_id}>
              <button
                type="button"
                className="w-full rounded-md border border-border px-3 py-3 text-left hover:bg-secondary/60"
                onClick={() => void openHistory(row)}
              >
                <p className="font-medium">{row.name}</p>
                <p className="text-sm text-muted-foreground">
                  {row.phone ?? row.email}
                  {row.group_name ? ` · ${row.group_name}` : ""}
                  {` · kredit ${formatIdr(row.store_credit_minor ?? 0)}`}
                  {row.loyalty_points || row.loyalty_tier
                    ? ` · poin ${row.loyalty_points ?? 0}${row.loyalty_tier ? ` (${row.loyalty_tier})` : ""}`
                    : ""}
                </p>
              </button>
            </li>
          ))}
        </ul>
        {history ? (
          <div className="space-y-2 rounded-md border border-border p-4">
            <p className="font-medium">Riwayat belanja</p>
            <p className="text-sm text-muted-foreground">
              Total belanja: {formatIdr(history.total_spend_minor)}
            </p>
            {history.sales.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada penjualan.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {history.sales.map((sale) => (
                  <li key={sale.sale_id}>
                    {formatIdr(sale.amount_minor)}
                    {sale.voided_at ? " · Di-void" : ""}
                  </li>
                ))}
              </ul>
            )}
            {history.returns.map((ret) => (
              <p key={ret.return_id} className="text-sm">
                Retur {formatIdr(ret.amount_minor)} · {ret.status}
              </p>
            ))}
          </div>
        ) : null}
      </div>
      <form className="space-y-3" onSubmit={(e) => void onSave(e)}>
        <p className="font-medium">
          {selected ? "Ubah pelanggan" : "Pelanggan baru"}
        </p>
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        {warn ? (
          <p className="text-sm text-muted-foreground" role="status">
            {warn}
          </p>
        ) : null}
        <div>
          <Label htmlFor="cust-name">Nama</Label>
          <Input id="cust-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <Label htmlFor="cust-phone">Telepon</Label>
          <Input id="cust-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="cust-email">Email</Label>
          <Input id="cust-email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="cust-notes">Catatan</Label>
          <Input id="cust-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        {canDelete ? (
          <div>
            <Label htmlFor="cust-group">Grup</Label>
            <Input
              id="cust-group"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              list="customer-groups"
            />
            <datalist id="customer-groups">
              {groups.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
          </div>
        ) : selected?.group_name ? (
          <p className="text-sm text-muted-foreground">Grup: {selected.group_name}</p>
        ) : null}
        {canDelete ? (
          <div>
            <Label htmlFor="cust-credit">Kredit toko (Rp)</Label>
            <Input
              id="cust-credit"
              type="number"
              min={0}
              step={1}
              value={storeCredit}
              onChange={(e) => setStoreCredit(e.target.value)}
            />
          </div>
        ) : selected ? (
          <p className="text-sm text-muted-foreground">
            Kredit toko: {formatIdr(selected.store_credit_minor ?? 0)}
          </p>
        ) : null}
        {selected ? (
          <p className="text-sm text-muted-foreground">
            Poin: {selected.loyalty_points ?? 0}
            {selected.loyalty_tier ? ` · ${selected.loyalty_tier}` : ""}
          </p>
        ) : null}
        {selected && (selected.price_overrides?.length || selected.group_price_overrides?.length) ? (
          <ul className="space-y-1 text-sm text-muted-foreground">
            {selected.price_overrides?.map((row) => (
              <li key={`c-${row.product_id}`}>
                Harga pelanggan · {productLabel(products, row.product_id)}:{" "}
                {formatIdr(row.price_minor)}
              </li>
            ))}
            {selected.group_price_overrides?.map((row) => (
              <li key={`g-${row.product_id}`}>
                Harga grup · {productLabel(products, row.product_id)}:{" "}
                {formatIdr(row.price_minor)}
              </li>
            ))}
          </ul>
        ) : null}
        {canDelete && selected ? (
          <div className="space-y-2 rounded-md border border-border p-3">
            <p className="text-sm font-medium">Harga pelanggan</p>
            <Input
              value={priceProductId}
              onChange={(e) => setPriceProductId(e.target.value)}
              placeholder="Produk"
              list="cust-products"
            />
            <Input
              type="number"
              min={0}
              step={1}
              value={priceMinor}
              onChange={(e) => setPriceMinor(e.target.value)}
              placeholder="Harga (Rp)"
            />
            <Button
              type="button"
              disabled={pending}
              className="min-h-10 w-full rounded-md bg-secondary text-secondary-foreground"
              onClick={() => void savePrice()}
            >
              Simpan harga pelanggan
            </Button>
            {selected.group_name ? (
              <>
                <p className="text-sm font-medium">Harga grup ({selected.group_name})</p>
                <Input
                  value={groupPriceProductId}
                  onChange={(e) => setGroupPriceProductId(e.target.value)}
                  placeholder="Produk"
                  list="cust-products"
                />
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={groupPriceMinor}
                  onChange={(e) => setGroupPriceMinor(e.target.value)}
                  placeholder="Harga (Rp)"
                />
                <Button
                  type="button"
                  disabled={pending}
                  className="min-h-10 w-full rounded-md bg-secondary text-secondary-foreground"
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
          </div>
        ) : null}
        <Button
          type="submit"
          disabled={pending}
          className="min-h-12 w-full rounded-md bg-accent text-accent-foreground"
        >
          Simpan
        </Button>
        {selected ? (
          <button
            type="button"
            className="w-full text-sm text-muted-foreground"
            onClick={() => fill(null)}
          >
            Batal
          </button>
        ) : null}
        {selected && canDelete ? (
          <button
            type="button"
            disabled={pending}
            className="w-full text-sm text-destructive"
            onClick={() => void onDelete()}
          >
            Hapus
          </button>
        ) : null}
      </form>
    </div>
  );
}
