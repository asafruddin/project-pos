"use client";

import { AuthLoadingShell } from "@pos-apps/ui/organisms";
import { Button, Input, Label } from "@pos-apps/ui/atoms";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@pos-apps/ui/molecules";
import { EnvelopeSimpleIcon, PhoneIcon, PlusIcon } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ApiErrorBody, CustomerHistoryResponse, CustomerListResponse } from "@pos-apps/types";
import {
  customerFromApi,
  listCachedCustomers,
  listCompleteSalesForLocalDay,
  markCustomerCreateSynced,
  matchCustomers,
  queueCustomerCreate,
  replaceCustomers,
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
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [createWarn, setCreateWarn] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const canCreate = Boolean(name.trim());

  async function refreshRows() {
    setRows(await listCachedCustomers());
  }

  async function pullRemote() {
    if (!navigator.onLine) return;
    try {
      const res = await authorizedFetch("/customers");
      if (!res.ok) return;
      const data = (await res.json()) as CustomerListResponse;
      const pulledAt = new Date().toISOString();
      await replaceCustomers(data.customers.map((row) => customerFromApi(row, pulledAt)));
      await refreshRows();
    } catch {
      /* cache remains usable offline */
    }
  }

  useEffect(() => {
    applyTheme();
    document.documentElement.lang = getLang();
    if (!isPinUnlocked()) {
      router.replace("/pin");
      return;
    }
    setReady(true);
    void (async () => {
      await refreshRows();
      await pullRemote();
    })();
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

  async function createCustomer() {
    if (busy || !canCreate) return;
    setBusy(true);
    setCreateError(null);
    setCreateWarn(null);
    try {
      const row = await queueCustomerCreate({ name, phone, email });
      if (navigator.onLine) {
        try {
          const res = await authorizedFetch("/customers", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              customer_id: row.customerId,
              name: row.name,
              phone: row.phone,
              email: row.email,
              notes: row.notes,
            }),
          });
          const data = (await res.json()) as
            | { warnings?: Array<"DUPLICATE_PHONE"> }
            | ApiErrorBody;
          if (res.ok) {
            await markCustomerCreateSynced(row.customerId);
            if ("warnings" in data && data.warnings?.includes("DUPLICATE_PHONE")) {
              setCreateWarn(t.customerDupPhone);
            }
          }
        } catch {
          /* queued create still listed locally */
        }
      }
      setName("");
      setPhone("");
      setEmail("");
      setCreateOpen(false);
      await refreshRows();
      await select(row);
    } catch {
      setCreateError(t.customerCreateFail);
    } finally {
      setBusy(false);
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
      <div className="flex items-center gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.customerSearchPh}
          aria-label={t.customerSearch}
          className="h-11 min-w-0 flex-1 rounded-xl"
        />
        <Button
          type="button"
          className="h-11 shrink-0 rounded-xl px-3"
          onClick={() => {
            setCreateError(null);
            setCreateWarn(null);
            setCreateOpen(true);
          }}
        >
          <PlusIcon size={16} weight="bold" />
          <span className="hidden sm:inline">{t.customerAdd}</span>
        </Button>
      </div>
      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[80vh] gap-0 rounded-t-3xl px-0 pb-[calc(1rem+env(safe-area-inset-bottom))]"
        >
          <SheetHeader className="border-b border-border px-4 pb-3">
            <SheetTitle>{t.customerAdd}</SheetTitle>
            <SheetDescription>{t.customerCreateHint}</SheetDescription>
          </SheetHeader>
          <div className="space-y-3 px-4 py-4">
            <div className="grid gap-1.5">
              <Label htmlFor="pelanggan-name">{t.customerName}</Label>
              <Input
                id="pelanggan-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t.customerName}
                className="h-11 rounded-xl"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="pelanggan-phone">{t.customerPhone}</Label>
                <div className="relative">
                  <PhoneIcon
                    size={18}
                    className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  />
                  <Input
                    id="pelanggan-phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder={t.customerPhone}
                    inputMode="tel"
                    className="h-11 rounded-xl pl-10"
                  />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="pelanggan-email">{t.customerEmail}</Label>
                <div className="relative">
                  <EnvelopeSimpleIcon
                    size={18}
                    className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  />
                  <Input
                    id="pelanggan-email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t.customerEmail}
                    inputMode="email"
                    className="h-11 rounded-xl pl-10"
                  />
                </div>
              </div>
            </div>
            {createError ? (
              <p className="text-sm text-destructive" role="alert">
                {createError}
              </p>
            ) : null}
            {createWarn ? (
              <p className="text-sm text-muted-foreground" role="status">
                {createWarn}
              </p>
            ) : null}
          </div>
          <SheetFooter className="mt-0 border-t border-border px-4 pt-3">
            <Button
              type="button"
              disabled={busy || !canCreate}
              className="min-h-11 w-full rounded-xl"
              onClick={() => void createCustomer()}
            >
              {t.customerCreate}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
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
