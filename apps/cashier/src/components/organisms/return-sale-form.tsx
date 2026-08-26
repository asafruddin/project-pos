"use client";

import { Button, Input } from "@pos-apps/ui/atoms";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@pos-apps/ui/molecules";
import { useState } from "react";
import type {
  ApiErrorBody,
  CreateReturnRequest,
  ReturnDecision,
  ReturnDetail,
  SaleLookupResponse,
} from "@pos-apps/types";
import { authorizedFetch } from "@/lib/api-client";
import { formatIdr } from "@/lib/money";
import { copy, type LangPref } from "@/lib/preferences";

type DraftLine = {
  product_id: string;
  qty: string;
  decision: ReturnDecision;
};

export function ReturnSaleForm({
  lang,
  sale,
  onCancel,
  onSuccess,
}: {
  lang: LangPref;
  sale: SaleLookupResponse;
  onCancel: () => void;
  onSuccess: (detail: ReturnDetail) => void;
}) {
  const t = copy(lang);
  const [draft, setDraft] = useState<DraftLine[]>(() =>
    sale.lines.map((line) => ({
      product_id: line.product_id,
      qty: line.returned_qty >= line.qty ? "0" : "1",
      decision: "resellable" as ReturnDecision,
    })),
  );
  const [reason, setReason] = useState("");
  const [exchangeId, setExchangeId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (sale.voided_at) return;
    setBusy(true);
    setError(null);
    try {
      const lines = draft
        .map((line) => ({
          product_id: line.product_id,
          qty: Number.parseInt(line.qty, 10),
          decision: line.decision,
        }))
        .filter((line) => Number.isInteger(line.qty) && line.qty > 0);
      const body: CreateReturnRequest = {
        reason,
        lines,
        exchange_sale_id: exchangeId.trim() || null,
      };
      const res = await authorizedFetch(`/sales/${sale.sale_id}/returns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as ReturnDetail | ApiErrorBody;
      if (!res.ok) {
        setError((data as ApiErrorBody).message ?? t.returnFail);
        return;
      }
      onSuccess(data as ReturnDetail);
    } catch (err) {
      if (
        err instanceof Error &&
        (err.message === "AUTH_UNAUTHORIZED" ||
          err.message === "AUTH_SESSION_EXPIRED")
      ) {
        return;
      }
      setError(t.returnFail);
    } finally {
      setBusy(false);
    }
  }

  if (sale.voided_at) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{t.returnVoided}</p>
        <Button
          type="button"
          variant="ghost"
          className="h-12 min-h-12 w-full text-sm text-muted-foreground"
          onClick={onCancel}
        >
          {t.txBack}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="font-medium">
        {formatIdr(sale.amount_minor, lang)} ·{" "}
        {new Date(sale.completed_at).toLocaleString(lang === "en" ? "en-US" : "id-ID")}
      </p>
      {error ? (
        <p
          className="rounded-2xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      <ul className="space-y-3">
        {sale.lines.map((line, index) => {
          const remaining = line.qty - line.returned_qty;
          const row = draft[index];
          return (
            <li key={line.product_id} className="rounded-2xl border border-border p-3">
              <p className="font-medium">{line.name ?? line.product_id}</p>
              <p className="text-sm text-muted-foreground">
                {line.qty} · {t.returnRemaining} {remaining} · {formatIdr(line.price_minor, lang)}
              </p>
              {remaining <= 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">{t.returnAlready}</p>
              ) : (
                <div className="mt-2 flex flex-wrap gap-2">
                  <label className="text-sm">
                    {t.returnQty}
                    <Input
                      className="ml-2 h-12 w-16"
                      inputMode="numeric"
                      value={row?.qty ?? "0"}
                      onChange={(e) => {
                        const next = [...draft];
                        next[index] = { ...next[index]!, qty: e.target.value };
                        setDraft(next);
                      }}
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm sm:flex-row sm:items-center">
                    {t.returnDecision}
                    <Select
                      value={row?.decision ?? "resellable"}
                      onValueChange={(value) => {
                        const next = [...draft];
                        next[index] = {
                          ...next[index]!,
                          decision: value as ReturnDecision,
                        };
                        setDraft(next);
                      }}
                    >
                      <SelectTrigger className="h-12 min-h-12 w-full rounded-2xl sm:ml-2 sm:w-auto sm:min-w-[10rem]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="resellable">{t.returnResellable}</SelectItem>
                        <SelectItem value="damaged">{t.returnDamaged}</SelectItem>
                        <SelectItem value="warranty">{t.returnWarranty}</SelectItem>
                      </SelectContent>
                    </Select>
                  </label>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <label className="flex flex-col gap-1 text-sm">
        {t.returnReason}
        <Input
          className="h-12 min-h-12 rounded-2xl"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t.returnReasonPh}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        {t.returnExchange}
        <Input
          className="h-12 min-h-12 rounded-2xl"
          value={exchangeId}
          onChange={(e) => setExchangeId(e.target.value)}
        />
      </label>
      <Button
        type="button"
        disabled={busy}
        className="h-12 min-h-12 w-full rounded-xl"
        onClick={() => void submit()}
      >
        {t.returnSubmit}
      </Button>
      <Button
        type="button"
        variant="ghost"
        disabled={busy}
        className="h-12 min-h-12 w-full text-sm text-muted-foreground"
        onClick={onCancel}
      >
        {t.txBack}
      </Button>
    </div>
  );
}
