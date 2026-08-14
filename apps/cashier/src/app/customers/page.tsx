"use client";

import { AuthLoadingShell } from "@pos-apps/ui/organisms";
import { Button, Input } from "@pos-apps/ui/atoms";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { CustomerHistoryResponse } from "@pos-apps/types";
import {
  listCachedCustomers,
  listCompleteSalesForLocalDay,
  matchCustomers,
  type CachedCustomerRecord,
  type LocalSaleRecord,
} from "@pos-apps/local-db";
import { AppShell } from "@/components/templates/app-shell";
import { authorizedFetch } from "@/lib/api-client";
import { formatIdr } from "@/lib/money";
import { isPinUnlocked } from "@/lib/pin-session";
import { applyTheme, copy, getLang } from "@/lib/preferences";

export default function CustomersPage() {
  const router = useRouter();
  const [lang, setLang] = useState(getLang());
  const t = copy(lang);
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<CachedCustomerRecord[]>([]);
  const [selected, setSelected] = useState<CachedCustomerRecord | null>(null);
  const [history, setHistory] = useState<CustomerHistoryResponse | null>(null);
  const [localSales, setLocalSales] = useState<LocalSaleRecord[]>([]);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    applyTheme();
    document.documentElement.lang = getLang();
    if (!isPinUnlocked()) {
      router.replace("/pin");
      return;
    }
    setReady(true);
    void listCachedCustomers().then(setRows);
  }, [router]);

  const shown = matchCustomers(rows, query);

  async function select(row: CachedCustomerRecord) {
    setSelected(row);
    setHistory(null);
    const today = await listCompleteSalesForLocalDay();
    setLocalSales(today.filter((sale) => sale.customerId === row.customerId));
    if (!navigator.onLine) {
      setOffline(true);
      return;
    }
    setOffline(false);
    try {
      const res = await authorizedFetch(`/customers/${row.customerId}/history`);
      if (!res.ok) return;
      setHistory((await res.json()) as CustomerHistoryResponse);
    } catch {
      setOffline(true);
    }
  }

  if (!ready) {
    return <AuthLoadingShell message={t.loading} />;
  }

  const serverSales = history?.sales ?? [];
  const serverIds = new Set(serverSales.map((sale) => sale.sale_id));
  const extraLocal = localSales.filter((sale) => !serverIds.has(sale.saleId));
  const spend =
    (history?.total_spend_minor ?? 0) +
    extraLocal
      .filter((sale) => !sale.voidedAt)
      .reduce((sum, sale) => sum + (sale.payment?.amountMinor ?? 0), 0);

  return (
    <AppShell
      title={t.customerTitle}
      lang={lang}
      onLangChange={() => setLang(getLang())}
      subtitle={t.customerHistory}
    >
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t.customerSearchPh}
        aria-label={t.customerSearch}
      />
      <ul className="mt-3 space-y-2">
        {shown.map((row) => (
          <li key={row.customerId}>
            <Button
              type="button"
              variant="outline"
              className="h-auto w-full flex-col items-start rounded-2xl px-3 py-3 text-left whitespace-normal"
              onClick={() => void select(row)}
            >
              <p className="font-medium">{row.name}</p>
              <p className="text-sm text-muted-foreground">
                {row.phone ?? row.email}
                {row.groupName ? ` · ${row.groupName}` : ""}
                {` · ${formatIdr(row.storeCreditMinor ?? 0, lang)}`}
                {(row.loyaltyPoints ?? 0) > 0
                  ? ` · ${t.loyaltyPoints} ${row.loyaltyPoints}`
                  : ""}
              </p>
            </Button>
          </li>
        ))}
      </ul>
      {selected ? (
        <div className="mt-6 space-y-3">
          <h2 className="text-lg font-semibold">{selected.name}</h2>
            <p className="text-sm text-muted-foreground">
              {t.customerSpend}: {formatIdr(spend, lang)}
              {(selected.loyaltyPoints ?? 0) > 0 || selected.loyaltyTier
                ? ` · ${t.loyaltyPoints} ${selected.loyaltyPoints ?? 0}${selected.loyaltyTier ? ` (${selected.loyaltyTier})` : ""}`
                : ""}
            </p>
          {offline ? (
            <p className="text-sm text-muted-foreground">{t.customerHistoryOffline}</p>
          ) : null}
          {serverSales.length || extraLocal.length ? (
            <ul className="space-y-2">
              {serverSales.map((sale) => (
                <li
                  key={sale.sale_id}
                  className="rounded-2xl border border-border px-3 py-2 text-sm"
                >
                  {formatIdr(sale.amount_minor, lang)}
                  {sale.voided_at ? ` · ${t.customerVoided}` : ""}
                </li>
              ))}
              {extraLocal.map((sale) => (
                <li
                  key={sale.saleId}
                  className="rounded-2xl border border-border px-3 py-2 text-sm"
                >
                  {formatIdr(sale.payment?.amountMinor ?? 0, lang)}
                  {sale.voidedAt ? ` · ${t.customerVoided}` : ""}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">{t.customerNoHistory}</p>
          )}
          {history?.returns.length ? (
            <ul className="space-y-2">
              {history.returns.map((ret) => (
                <li
                  key={ret.return_id}
                  className="rounded-2xl border border-border px-3 py-2 text-sm"
                >
                  {t.customerReturned}: {formatIdr(ret.amount_minor, lang)} · {ret.status}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </AppShell>
  );
}
