"use client";

import { AuthLoadingShell } from "@pos-apps/ui/organisms";
import { Button, Input, NativeSelect } from "@pos-apps/ui/atoms";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  ApiErrorBody,
  CreateReturnRequest,
  ReturnDecision,
  ReturnDetail,
  SaleLookupResponse,
} from "@pos-apps/types";
import { AppShell } from "@/components/templates/app-shell";
import { authorizedFetch } from "@/lib/api-client";
import { getAccessToken, isAccessTokenExpired } from "@/lib/auth-token";
import { formatIdr } from "@/lib/money";
import { isPinUnlocked } from "@/lib/pin-session";
import { applyTheme, copy, getLang } from "@/lib/preferences";

type DraftLine = {
  product_id: string;
  qty: string;
  decision: ReturnDecision;
};

export default function ReturnsPage() {
  const router = useRouter();
  const [lang, setLang] = useState(getLang());
  const t = copy(lang);
  const [ready, setReady] = useState(false);
  const [saleId, setSaleId] = useState("");
  const [sale, setSale] = useState<SaleLookupResponse | null>(null);
  const [draft, setDraft] = useState<DraftLine[]>([]);
  const [reason, setReason] = useState("");
  const [exchangeId, setExchangeId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [created, setCreated] = useState<ReturnDetail | null>(null);

  useEffect(() => {
    applyTheme();
    document.documentElement.lang = getLang();
    if (!isPinUnlocked()) {
      router.replace("/pin");
      return;
    }
    setReady(true);
  }, [router]);

  async function lookup(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus(null);
    setCreated(null);
    setSale(null);
    if (!navigator.onLine) {
      setError(t.returnOffline);
      return;
    }
    const token = getAccessToken();
    if (!token || isAccessTokenExpired(token)) {
      setError(t.catalogNeedLogin);
      return;
    }
    const id = saleId.trim();
    if (!id) return;
    setBusy(true);
    try {
      const res = await authorizedFetch(`/sales/${id}`);
      const data = (await res.json()) as SaleLookupResponse | ApiErrorBody;
      if (!res.ok) {
        setError((data as ApiErrorBody).message ?? t.returnFail);
        return;
      }
      const found = data as SaleLookupResponse;
      setSale(found);
      setDraft(
        found.lines.map((line) => ({
          product_id: line.product_id,
          qty: line.returned_qty >= line.qty ? "0" : "1",
          decision: "resellable",
        })),
      );
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

  async function submit() {
    if (!sale || sale.voided_at) return;
    setBusy(true);
    setError(null);
    setStatus(null);
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
      setCreated(data as ReturnDetail);
      setStatus(t.returnOk);
      setSale(null);
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

  if (!ready) {
    return <AuthLoadingShell message={t.loading} />;
  }

  return (
    <AppShell
      title={t.returnTitle}
      lang={lang}
      onLangChange={() => setLang(getLang())}
      subtitle={t.returnHint}
    >
      {status ? (
        <p className="mb-4 rounded-2xl border border-border bg-secondary/70 p-3 text-sm" role="status">
          {status}
          {created ? ` ${t.returnWaitingRefund}` : ""}
        </p>
      ) : null}
      {error ? (
        <p
          className="mb-4 rounded-2xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <form onSubmit={(e) => void lookup(e)} className="mb-6 flex flex-col gap-3 sm:flex-row">
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
          {t.returnSaleId}
          <Input
            className="h-12 min-h-12 rounded-2xl"
            value={saleId}
            onChange={(e) => setSaleId(e.target.value)}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          />
        </label>
        <Button
          type="submit"
          disabled={busy}
          className="min-h-12 rounded-2xl bg-secondary text-secondary-foreground sm:self-end"
        >
          {t.returnLookup}
        </Button>
      </form>

      {sale ? (
        sale.voided_at ? (
          <p className="text-sm text-muted-foreground">{t.returnVoided}</p>
        ) : (
          <div className="space-y-4">
            <p className="font-medium">
              {formatIdr(sale.amount_minor, lang)} ·{" "}
              {new Date(sale.completed_at).toLocaleString(lang === "en" ? "en-US" : "id-ID")}
            </p>
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
                        <label className="text-sm">
                          {t.returnDecision}
                          <NativeSelect
                            className="ml-2 min-h-12 w-auto"
                            value={row?.decision ?? "resellable"}
                            onChange={(e) => {
                              const next = [...draft];
                              next[index] = {
                                ...next[index]!,
                                decision: e.target.value as ReturnDecision,
                              };
                              setDraft(next);
                            }}
                          >
                            <option value="resellable">{t.returnResellable}</option>
                            <option value="damaged">{t.returnDamaged}</option>
                            <option value="warranty">{t.returnWarranty}</option>
                          </NativeSelect>
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
          </div>
        )
      ) : null}
    </AppShell>
  );
}
