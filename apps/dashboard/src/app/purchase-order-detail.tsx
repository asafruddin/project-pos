"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  ApiErrorBody,
  PurchaseOrderDetail,
  PurchaseOrderStatus,
} from "@pos-apps/types";
import { Button } from "@/components/ui/button";
import {
  FormActions,
  FormBackLink,
  FormField,
  FormSection,
  formInputClass,
  formSelectClass,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { authorizedFetch } from "@/lib/api-client";
import { formatIdr } from "@/lib/format-money";

function statusLabel(status: PurchaseOrderStatus): string {
  if (status === "draft") return "Draf";
  if (status === "submitted") return "Diajukan";
  if (status === "approved") return "Disetujui";
  if (status === "partially_received") return "Diterima sebagian";
  if (status === "completed") return "Selesai";
  return "Dibatalkan";
}

export function PurchaseOrderDetailForm({ poId }: { poId: string }) {
  const router = useRouter();
  const [selectedPo, setSelectedPo] = useState<PurchaseOrderDetail | null>(null);
  const [receiveQty, setReceiveQty] = useState<Record<string, string>>({});
  const [invoiceRef, setInvoiceRef] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<
    "unpaid" | "partial" | "paid"
  >("unpaid");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);

  const applyDetail = useCallback((detail: PurchaseOrderDetail) => {
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
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await authorizedFetch(`/purchasing/purchase-orders/${poId}`);
      const data = (await res.json()) as PurchaseOrderDetail | ApiErrorBody;
      if (!res.ok) {
        setError((data as ApiErrorBody).message ?? "Gagal memuat pesanan.");
        setSelectedPo(null);
        return;
      }
      applyDetail(data as PurchaseOrderDetail);
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
  }, [applyDetail, poId]);

  useEffect(() => {
    void load();
  }, [load]);

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
        return;
      }
      if (path === "cancel") {
        router.push("/purchasing", { scroll: false });
        return;
      }
      setSelectedPo(data as PurchaseOrderDetail);
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

  async function onReceive(e: FormEvent) {
    e.preventDefault();
    if (!selectedPo) return;
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
      const data = (await res.json()) as PurchaseOrderDetail | ApiErrorBody;
      if (!res.ok) {
        setError((data as ApiErrorBody).message ?? "Gagal menerima barang.");
        return;
      }
      setSelectedPo(data as PurchaseOrderDetail);
      setReceiveQty({});
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

  async function onInvoice(e: FormEvent) {
    e.preventDefault();
    if (!selectedPo) return;
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
      const data = (await res.json()) as PurchaseOrderDetail | ApiErrorBody;
      if (!res.ok) {
        setError((data as ApiErrorBody).message ?? "Gagal menyimpan faktur.");
        return;
      }
      setSelectedPo(data as PurchaseOrderDetail);
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
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!selectedPo) {
    return (
      <div className="flex flex-col gap-4">
        <FormBackLink href="/purchasing">Daftar pembelian</FormBackLink>
        <p className="text-sm text-destructive" role="alert">
          {error ?? "Pesanan tidak ditemukan."}
        </p>
      </div>
    );
  }

  const canReceive =
    selectedPo.status === "approved" ||
    selectedPo.status === "partially_received";
  const canInvoice =
    selectedPo.status === "approved" ||
    selectedPo.status === "partially_received" ||
    selectedPo.status === "completed";

  return (
    <div className="flex min-h-full flex-col gap-5">
      <FormBackLink href="/purchasing">Daftar pembelian</FormBackLink>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <FormSection
        title={`${statusLabel(selectedPo.status)} · ${selectedPo.supplier_name}`}
      >
        <div className="overflow-x-auto">
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
        </div>
        {selectedPo.status === "draft" ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={pending}
              onClick={() => void poAction("submit")}
            >
              Ajukan
            </Button>
            <Button
              type="button"
              className="bg-secondary text-secondary-foreground hover:opacity-90"
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
              disabled={pending}
              onClick={() => void poAction("approve")}
            >
              Setujui
            </Button>
            <Button
              type="button"
              className="bg-secondary text-secondary-foreground hover:opacity-90"
              disabled={pending}
              onClick={() => void poAction("cancel")}
            >
              Batalkan
            </Button>
          </div>
        ) : null}
      </FormSection>

      {canReceive ? (
        <form onSubmit={(e) => void onReceive(e)} className="flex flex-col gap-5">
          <FormSection title="Terima barang">
            {selectedPo.lines.map((line) => {
              const remaining = line.qty - line.received_qty;
              return (
                <FormField
                  key={line.product_id}
                  label={`${line.name} (sisa ${remaining})`}
                >
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
                    className={`${formInputClass} w-24`}
                    aria-label={`Terima ${line.name}`}
                  />
                </FormField>
              );
            })}
            <FormActions
              pending={pending}
              submitLabel="Terima"
              cancelHref="/purchasing"
            />
          </FormSection>
        </form>
      ) : null}

      {canInvoice ? (
        <form onSubmit={(e) => void onInvoice(e)} className="flex flex-col gap-5">
          <FormSection title="Faktur">
            <FormField id="invoiceRef" label="Nomor faktur">
              <Input
                id="invoiceRef"
                value={invoiceRef}
                onChange={(e) => setInvoiceRef(e.target.value)}
                disabled={pending}
                className={formInputClass}
              />
            </FormField>
            <FormField id="payStatus" label="Status bayar">
              <select
                id="payStatus"
                className={formSelectClass}
                value={paymentStatus}
                onChange={(e) =>
                  setPaymentStatus(
                    e.target.value as "unpaid" | "partial" | "paid",
                  )
                }
                disabled={pending}
              >
                <option value="unpaid">Belum</option>
                <option value="partial">Sebagian</option>
                <option value="paid">Lunas</option>
              </select>
            </FormField>
          </FormSection>
          <FormActions
            pending={pending}
            submitLabel="Simpan faktur"
            cancelHref="/purchasing"
          />
        </form>
      ) : null}
    </div>
  );
}
