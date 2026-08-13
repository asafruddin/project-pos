"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import type {
  ApiErrorBody,
  ProductListResponse,
  PurchaseOrderDetail,
  PurchaseOrderListResponse,
  PurchaseOrderStatus,
  Supplier,
  SupplierListResponse,
} from "@pos-apps/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authorizedFetch } from "@/lib/api-client";
import { getAccessToken, isAccessTokenExpired, logoutToLogin } from "@/lib/auth-token";
import { formatIdr } from "@/lib/format-money";

function statusLabel(status: PurchaseOrderStatus): string {
  if (status === "draft") return "Draf";
  if (status === "submitted") return "Diajukan";
  if (status === "approved") return "Disetujui";
  if (status === "partially_received") return "Diterima sebagian";
  if (status === "completed") return "Selesai";
  return "Dibatalkan";
}

export function PurchasingPanel() {
  const [query, setQuery] = useState("");
  const [suppliers, setSuppliers] = useState<SupplierListResponse["suppliers"]>([]);
  const [pos, setPos] = useState<PurchaseOrderListResponse["purchase_orders"]>([]);
  const [catalog, setCatalog] = useState<ProductListResponse["products"]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [selectedPo, setSelectedPo] = useState<PurchaseOrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [supplierName, setSupplierName] = useState("");
  const [contact, setContact] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [terms, setTerms] = useState("");
  const [poSupplierId, setPoSupplierId] = useState("");
  const [poLines, setPoLines] = useState<
    Array<{ product_id: string; qty: string; cost_minor: string }>
  >([{ product_id: "", qty: "1", cost_minor: "0" }]);
  const [suppliedIds, setSuppliedIds] = useState<Set<string>>(new Set());
  const [receiveQty, setReceiveQty] = useState<Record<string, string>>({});
  const [invoiceRef, setInvoiceRef] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<"unpaid" | "partial" | "paid">(
    "unpaid",
  );

  const load = useCallback(async (q?: string) => {
    const token = getAccessToken();
    if (!token || isAccessTokenExpired(token)) {
      logoutToLogin();
      return;
    }
    try {
      const qs = q?.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
      const [sRes, pRes, cRes] = await Promise.all([
        authorizedFetch(`/purchasing/suppliers${qs}`),
        authorizedFetch("/purchasing/purchase-orders"),
        authorizedFetch("/catalog/products"),
      ]);
      const sData = (await sRes.json()) as SupplierListResponse | ApiErrorBody;
      const pData = (await pRes.json()) as PurchaseOrderListResponse | ApiErrorBody;
      const cData = (await cRes.json()) as ProductListResponse | ApiErrorBody;
      if (!sRes.ok) {
        setError((sData as ApiErrorBody).message ?? "Gagal memuat pemasok.");
        return;
      }
      if (!pRes.ok) {
        setError((pData as ApiErrorBody).message ?? "Gagal memuat pesanan.");
        return;
      }
      setError(null);
      setSuppliers((sData as SupplierListResponse).suppliers);
      setPos((pData as PurchaseOrderListResponse).purchase_orders);
      if (cRes.ok) {
        setCatalog((cData as ProductListResponse).products);
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
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function resetSupplierForm() {
    setSelectedSupplier(null);
    setSupplierName("");
    setContact("");
    setPhone("");
    setEmail("");
    setTerms("");
    setSuppliedIds(new Set());
  }

  async function openSupplier(id: string) {
    setPending(true);
    try {
      const res = await authorizedFetch(`/purchasing/suppliers/${id}`);
      const data = (await res.json()) as Supplier | ApiErrorBody;
      if (!res.ok) {
        setError((data as ApiErrorBody).message ?? "Gagal memuat pemasok.");
        setPending(false);
        return;
      }
      const supplier = data as Supplier;
      setSelectedSupplier(supplier);
      setSupplierName(supplier.name);
      setContact(supplier.contact_name ?? "");
      setPhone(supplier.phone ?? "");
      setEmail(supplier.email ?? "");
      setTerms(supplier.payment_terms ?? "");
      setPoSupplierId(supplier.supplier_id);
      setSuppliedIds(new Set(supplier.products.map((p) => p.product_id)));
      setError(null);
    } catch {
      setError("Tidak dapat menghubungi API.");
    }
    setPending(false);
  }

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
      const path = selectedSupplier
        ? `/purchasing/suppliers/${selectedSupplier.supplier_id}`
        : "/purchasing/suppliers";
      const res = await authorizedFetch(path, {
        method: selectedSupplier ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as Supplier | ApiErrorBody;
      if (!res.ok) {
        setError((data as ApiErrorBody).message ?? "Gagal menyimpan pemasok.");
        setPending(false);
        return;
      }
      setSelectedSupplier(data as Supplier);
      setError(null);
      await load(query);
    } catch {
      setError("Tidak dapat menghubungi API.");
    }
    setPending(false);
  }

  async function openPo(id: string) {
    setPending(true);
    try {
      const res = await authorizedFetch(`/purchasing/purchase-orders/${id}`);
      const data = (await res.json()) as PurchaseOrderDetail | ApiErrorBody;
      if (!res.ok) {
        setError((data as ApiErrorBody).message ?? "Gagal memuat pesanan.");
        setPending(false);
        return;
      }
      const detail = data as PurchaseOrderDetail;
      setSelectedPo(detail);
      setReceiveQty(
        Object.fromEntries(
          detail.lines.map((line) => [
            line.product_id,
            String(Math.max(0, line.qty - line.received_qty) || ""),
          ]),
        ),
      );
      setInvoiceRef(detail.invoice_ref ?? "");
      setPaymentStatus(detail.payment_status);
      setError(null);
    } catch {
      setError("Tidak dapat menghubungi API.");
    }
    setPending(false);
  }

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
        qty: Number(line.qty),
        cost_minor: Number(line.cost_minor),
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
        setPending(false);
        return;
      }
      setSelectedPo(data as PurchaseOrderDetail);
      setPoLines([{ product_id: "", qty: "1", cost_minor: "0" }]);
      setError(null);
      await load(query);
    } catch {
      setError("Tidak dapat menghubungi API.");
    }
    setPending(false);
  }

  async function poAction(path: "submit" | "approve" | "cancel") {
    if (!selectedPo) return;
    setPending(true);
    try {
      const res = await authorizedFetch(
        `/purchasing/purchase-orders/${selectedPo.po_id}/${path}`,
        { method: "POST" },
      );
      const data = (await res.json()) as PurchaseOrderDetail | ApiErrorBody;
      if (!res.ok) {
        setError((data as ApiErrorBody).message ?? "Gagal memproses pesanan.");
        setPending(false);
        return;
      }
      setSelectedPo(data as PurchaseOrderDetail);
      setReceiveQty(
        Object.fromEntries(
          (data as PurchaseOrderDetail).lines.map((line) => [
            line.product_id,
            String(Math.max(0, line.qty - line.received_qty) || ""),
          ]),
        ),
      );
      setInvoiceRef((data as PurchaseOrderDetail).invoice_ref ?? "");
      setPaymentStatus((data as PurchaseOrderDetail).payment_status);
      setError(null);
      await load(query);
    } catch {
      setError("Tidak dapat menghubungi API.");
    }
    setPending(false);
  }

  return (
    <div className="flex flex-col gap-10">
      {error ? (
        <div
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <section className="flex flex-col gap-4">
        <p className="font-medium">Pemasok</p>
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void load(query);
          }}
        >
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari nama / kontak / telepon"
            className="h-12 max-w-sm"
          />
          <Button type="submit" className="h-12">
            Cari
          </Button>
        </form>
        <ul className="flex flex-col gap-2">
          {suppliers.length === 0 ? (
            <li className="text-sm text-muted-foreground">Belum ada pemasok.</li>
          ) : (
            suppliers.map((item) => (
              <li key={item.supplier_id}>
                <Button
                  type="button"
                  className="h-11 bg-secondary text-secondary-foreground hover:opacity-90"
                  onClick={() => void openSupplier(item.supplier_id)}
                  disabled={pending}
                >
                  {item.name}
                </Button>
              </li>
            ))
          )}
        </ul>
        <form onSubmit={(e) => void onSaveSupplier(e)} className="flex max-w-md flex-col gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="supName">Nama</Label>
            <Input
              id="supName"
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              disabled={pending}
              className="h-12"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="supContact">Kontak</Label>
            <Input
              id="supContact"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              disabled={pending}
              className="h-12"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="supPhone">Telepon</Label>
            <Input
              id="supPhone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={pending}
              className="h-12"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="supEmail">Email</Label>
            <Input
              id="supEmail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={pending}
              className="h-12"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="supTerms">Syarat bayar</Label>
            <Input
              id="supTerms"
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              disabled={pending}
              className="h-12"
            />
          </div>
          <div className="max-h-40 overflow-y-auto rounded-xl border border-border p-3">
            <p className="mb-2 text-sm text-muted-foreground">Produk dipasok</p>
            {catalog.length === 0 ? (
              <p className="text-sm text-muted-foreground">Tidak ada produk.</p>
            ) : (
              catalog.map((p) => (
                <label key={p.product_id} className="flex items-center gap-2 py-1 text-sm">
                  <input
                    type="checkbox"
                    checked={suppliedIds.has(p.product_id)}
                    onChange={(e) => {
                      setSuppliedIds((prev) => {
                        const next = new Set(prev);
                        if (e.target.checked) next.add(p.product_id);
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
          <div className="flex gap-2">
            <Button type="submit" disabled={pending} className="h-12">
              {selectedSupplier ? "Simpan pemasok" : "Buat pemasok"}
            </Button>
            {selectedSupplier ? (
              <Button
                type="button"
                className="h-12 bg-secondary text-secondary-foreground hover:opacity-90"
                onClick={resetSupplierForm}
                disabled={pending}
              >
                Baru
              </Button>
            ) : null}
          </div>
          {selectedSupplier?.purchase_orders.length ? (
            <p className="text-sm text-muted-foreground">
              Riwayat: {selectedSupplier.purchase_orders.length} pesanan
            </p>
          ) : null}
        </form>
      </section>

      <section className="flex flex-col gap-4">
        <p className="font-medium">Pesanan pembelian</p>
        <form onSubmit={(e) => void onCreatePo(e)} className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="poSupplier">Pemasok</Label>
            <select
              id="poSupplier"
              className="h-12 rounded-md border border-border bg-background px-3"
              value={poSupplierId}
              onChange={(e) => setPoSupplierId(e.target.value)}
              disabled={pending}
            >
              <option value="">Pilih pemasok</option>
              {suppliers.map((item) => (
                <option key={item.supplier_id} value={item.supplier_id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
          {poLines.map((line, index) => (
            <div key={index} className="flex flex-wrap gap-2">
              <select
                className="h-12 min-w-[12rem] rounded-md border border-border bg-background px-3"
                value={line.product_id}
                onChange={(e) => {
                  const next = [...poLines];
                  next[index] = { ...line, product_id: e.target.value };
                  setPoLines(next);
                }}
                disabled={pending}
              >
                <option value="">Produk</option>
                {catalog.map((p) => (
                  <option key={p.product_id} value={p.product_id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <Input
                inputMode="numeric"
                value={line.qty}
                onChange={(e) => {
                  const next = [...poLines];
                  next[index] = { ...line, qty: e.target.value };
                  setPoLines(next);
                }}
                className="h-12 w-20"
                disabled={pending}
                aria-label="Jumlah"
              />
              <Input
                inputMode="numeric"
                value={line.cost_minor}
                onChange={(e) => {
                  const next = [...poLines];
                  next[index] = { ...line, cost_minor: e.target.value };
                  setPoLines(next);
                }}
                className="h-12 w-32"
                disabled={pending}
                aria-label="Harga pokok"
              />
            </div>
          ))}
          <div className="flex gap-2">
            <Button
              type="button"
              className="h-12 bg-secondary text-secondary-foreground hover:opacity-90"
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
            <Button type="submit" disabled={pending} className="h-12">
              Buat draf PO
            </Button>
          </div>
        </form>

        <ul className="flex flex-col gap-2">
          {pos.length === 0 ? (
            <li className="text-sm text-muted-foreground">Belum ada pesanan.</li>
          ) : (
            pos.map((item) => (
              <li key={item.po_id}>
                <Button
                  type="button"
                  className="h-11 bg-secondary text-secondary-foreground hover:opacity-90"
                  onClick={() => void openPo(item.po_id)}
                  disabled={pending}
                >
                  {statusLabel(item.status)} · {item.supplier_name} · {item.line_count} item
                </Button>
              </li>
            ))
          )}
        </ul>

        {selectedPo ? (
          <div className="flex flex-col gap-3 rounded-xl border border-border p-4">
            <p className="font-medium">
              {statusLabel(selectedPo.status)} · {selectedPo.supplier_name}
            </p>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-muted-foreground">
                  <th className="py-2 font-medium">Produk</th>
                  <th className="py-2 font-medium">Qty</th>
                  <th className="py-2 font-medium">Diterima</th>
                  <th className="py-2 font-medium">Pokok</th>
                </tr>
              </thead>
              <tbody>
                {selectedPo.lines.map((line) => (
                  <tr key={line.product_id}>
                    <td className="py-1">{line.name}</td>
                    <td className="py-1">{line.qty}</td>
                    <td className="py-1">{line.received_qty}</td>
                    <td className="py-1">{formatIdr(line.cost_minor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {selectedPo.status === "draft" ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  className="h-12"
                  disabled={pending}
                  onClick={() => void poAction("submit")}
                >
                  Ajukan
                </Button>
                <Button
                  type="button"
                  className="h-12 bg-secondary text-secondary-foreground hover:opacity-90"
                  disabled={pending}
                  onClick={() => void poAction("cancel")}
                >
                  Batalkan
                </Button>
              </div>
            ) : null}
            {selectedPo.status === "submitted" ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  className="h-12"
                  disabled={pending}
                  onClick={() => void poAction("approve")}
                >
                  Setujui
                </Button>
                <Button
                  type="button"
                  className="h-12 bg-secondary text-secondary-foreground hover:opacity-90"
                  disabled={pending}
                  onClick={() => void poAction("cancel")}
                >
                  Batalkan
                </Button>
              </div>
            ) : null}
            {selectedPo.status === "approved" ||
            selectedPo.status === "partially_received" ? (
              <form
                className="flex flex-col gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  void (async () => {
                    const lines = selectedPo.lines
                      .map((line) => ({
                        product_id: line.product_id,
                        qty: Number(receiveQty[line.product_id] ?? "0"),
                      }))
                      .filter((line) => Number.isInteger(line.qty) && line.qty > 0);
                    if (!lines.length) {
                      setError("Isi minimal satu jumlah terima.");
                      return;
                    }
                    setPending(true);
                    try {
                      const res = await authorizedFetch(
                        `/purchasing/purchase-orders/${selectedPo.po_id}/receipts`,
                        {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ lines }),
                        },
                      );
                      const data = (await res.json()) as
                        | PurchaseOrderDetail
                        | ApiErrorBody;
                      if (!res.ok) {
                        setError(
                          (data as ApiErrorBody).message ??
                            "Gagal menerima barang.",
                        );
                        setPending(false);
                        return;
                      }
                      const detail = data as PurchaseOrderDetail;
                      setSelectedPo(detail);
                      setReceiveQty(
                        Object.fromEntries(
                          detail.lines.map((line) => [
                            line.product_id,
                            String(Math.max(0, line.qty - line.received_qty) || ""),
                          ]),
                        ),
                      );
                      setError(null);
                      await load(query);
                    } catch {
                      setError("Tidak dapat menghubungi API.");
                    }
                    setPending(false);
                  })();
                }}
              >
                <p className="text-sm font-medium">Terima barang</p>
                {selectedPo.lines.map((line) => {
                  const remaining = line.qty - line.received_qty;
                  return (
                    <div key={line.product_id} className="flex items-center gap-2">
                      <span className="min-w-[8rem] text-sm">
                        {line.name}{" "}
                        <span className="text-muted-foreground">(sisa {remaining})</span>
                      </span>
                      <Input
                        inputMode="numeric"
                        value={receiveQty[line.product_id] ?? ""}
                        onChange={(e) =>
                          setReceiveQty((prev) => ({
                            ...prev,
                            [line.product_id]: e.target.value,
                          }))
                        }
                        disabled={pending || remaining <= 0}
                        className="h-10 w-24"
                        aria-label={`Terima ${line.name}`}
                      />
                    </div>
                  );
                })}
                <Button type="submit" disabled={pending} className="h-12 w-fit">
                  Terima
                </Button>
              </form>
            ) : null}
            {selectedPo.status === "approved" ||
            selectedPo.status === "partially_received" ||
            selectedPo.status === "completed" ? (
              <form
                className="flex flex-col gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  void (async () => {
                    setPending(true);
                    try {
                      const res = await authorizedFetch(
                        `/purchasing/purchase-orders/${selectedPo.po_id}/invoice`,
                        {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            invoice_ref: invoiceRef.trim() || null,
                            payment_status: paymentStatus,
                          }),
                        },
                      );
                      const data = (await res.json()) as
                        | PurchaseOrderDetail
                        | ApiErrorBody;
                      if (!res.ok) {
                        setError(
                          (data as ApiErrorBody).message ?? "Gagal menyimpan faktur.",
                        );
                        setPending(false);
                        return;
                      }
                      setSelectedPo(data as PurchaseOrderDetail);
                      setError(null);
                    } catch {
                      setError("Tidak dapat menghubungi API.");
                    }
                    setPending(false);
                  })();
                }}
              >
                <Label htmlFor="invoiceRef">Nomor faktur</Label>
                <Input
                  id="invoiceRef"
                  value={invoiceRef}
                  onChange={(e) => setInvoiceRef(e.target.value)}
                  disabled={pending}
                  className="h-12 max-w-sm"
                />
                <Label htmlFor="payStatus">Status bayar</Label>
                <select
                  id="payStatus"
                  className="h-12 max-w-sm rounded-md border border-border bg-background px-3"
                  value={paymentStatus}
                  onChange={(e) =>
                    setPaymentStatus(e.target.value as "unpaid" | "partial" | "paid")
                  }
                  disabled={pending}
                >
                  <option value="unpaid">Belum</option>
                  <option value="partial">Sebagian</option>
                  <option value="paid">Lunas</option>
                </select>
                <Button type="submit" disabled={pending} className="h-12 w-fit">
                  Simpan faktur
                </Button>
              </form>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
