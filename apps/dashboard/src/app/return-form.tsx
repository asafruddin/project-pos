"use client";

import { Button, Input, Skeleton } from "@pos-apps/ui/atoms";
import { FormField, formInputClass } from "@pos-apps/ui/molecules";
import { FormActions, FormBackLink, FormSection } from "@pos-apps/ui/organisms";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ApiErrorBody, ReturnDetail, ReturnListResponse } from "@pos-apps/types";
import { authorizedFetch } from "@/lib/api-client";
import { formatIdr } from "@/lib/format-money";

function decisionLabel(decision: string): string {
  if (decision === "resellable") return "Layak jual";
  if (decision === "damaged") return "Rusak";
  return "Garansi";
}

export function ReturnForm({
  returnId,
  canRefund,
  canLinkExchange,
}: {
  returnId: string;
  canRefund: boolean;
  canLinkExchange: boolean;
}) {
  const router = useRouter();
  const [row, setRow] = useState<ReturnDetail | null>(null);
  const [exchangeId, setExchangeId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await authorizedFetch("/sales/returns");
      const data = (await res.json()) as ReturnListResponse | ApiErrorBody;
      if (!res.ok) {
        setError((data as ApiErrorBody).message ?? "Gagal memuat retur.");
        return;
      }
      const found = (data as ReturnListResponse).returns.find(
        (item) => item.return_id === returnId,
      );
      if (!found) {
        setError("Retur tidak ditemukan.");
        setRow(null);
        return;
      }
      setRow(found);
      setExchangeId(found.exchange_sale_id ?? "");
      setError(null);
    } catch (err) {
      if (
        err instanceof Error &&
        (err.message === "AUTH_UNAUTHORIZED" ||
          err.message === "AUTH_SESSION_EXPIRED")
      ) {
        return;
      }
      setError("Gagal memuat retur.");
    } finally {
      setLoading(false);
    }
  }, [returnId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function refund() {
    if (!row || !canRefund) return;
    setPending(true);
    setError(null);
    try {
      const res = await authorizedFetch(`/sales/returns/${row.return_id}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount_minor: row.amount_minor }),
      });
      const data = (await res.json()) as ReturnDetail | ApiErrorBody;
      if (!res.ok) {
        setError((data as ApiErrorBody).message ?? "Gagal refund.");
        return;
      }
      router.push("/returns", { scroll: false });
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

  async function linkExchange(e: FormEvent) {
    e.preventDefault();
    if (!row || !canLinkExchange) return;
    const id = exchangeId.trim();
    if (!id) {
      setError("ID penjualan tukar wajib diisi.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const res = await authorizedFetch(
        `/sales/returns/${row.return_id}/exchange`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ exchange_sale_id: id }),
        },
      );
      const data = (await res.json()) as ReturnDetail | ApiErrorBody;
      if (!res.ok) {
        setError((data as ApiErrorBody).message ?? "Gagal tautkan tukar.");
        return;
      }
      router.push("/returns", { scroll: false });
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

  if (!row) {
    return (
      <div className="flex flex-col gap-4">
        <FormBackLink href="/returns">Daftar retur</FormBackLink>
        <p className="text-sm text-destructive" role="alert">
          {error ?? "Retur tidak ditemukan."}
        </p>
      </div>
    );
  }

  const showExchangeForm = canLinkExchange && !row.exchange_sale_id;

  return (
    <form
      onSubmit={(e) => {
        if (showExchangeForm) {
          void linkExchange(e);
          return;
        }
        e.preventDefault();
        void refund();
      }}
      className="flex min-h-full flex-col gap-5"
    >
      <FormBackLink href="/returns">Daftar retur</FormBackLink>

      <FormSection
        title={`${formatIdr(row.amount_minor)} · ${row.reason}`}
        description={`Penjualan ${row.sale_id}`}
      >
        <ul className="text-sm">
          {row.lines.map((line) => (
            <li key={line.product_id}>
              {line.name ?? line.product_id} ×{line.qty} ·{" "}
              {decisionLabel(line.decision)}
            </li>
          ))}
        </ul>
        {row.exchange_sale_id ? (
          <p className="text-sm text-muted-foreground">
            Tukar: {row.exchange_sale_id}
          </p>
        ) : null}
        {showExchangeForm ? (
          <FormField id="exchange-sale" label="ID penjualan tukar" required>
            <Input
              id="exchange-sale"
              className={formInputClass}
              placeholder="ID penjualan tukar"
              value={exchangeId}
              onChange={(e) => setExchangeId(e.target.value)}
              disabled={pending}
            />
          </FormField>
        ) : null}
        {!canRefund ? (
          <p className="text-sm text-muted-foreground">Menunggu refund manajer.</p>
        ) : null}
      </FormSection>

      {showExchangeForm || canRefund ? (
        <FormActions
          error={error}
          pending={pending}
          submitLabel={
            showExchangeForm
              ? "Tautkan tukar"
              : `Refund tunai ${formatIdr(row.amount_minor)}`
          }
          cancelHref="/returns"
          extra={
            showExchangeForm && canRefund ? (
              <Button
                type="button"
                disabled={pending}
                className="bg-accent text-accent-foreground"
                onClick={() => void refund()}
              >
                Refund tunai {formatIdr(row.amount_minor)}
              </Button>
            ) : null
          }
        />
      ) : (
        <FormActions
          error={error}
          pending={pending}
          hideSubmit
          cancelHref="/returns"
        />
      )}
    </form>
  );
}
