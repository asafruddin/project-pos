"use client";

import { Button, Input, Label } from "@pos-apps/ui/atoms";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@pos-apps/ui/molecules";
import {
  EnvelopeSimpleIcon,
  MagnifyingGlassIcon,
  PhoneIcon,
  UserIcon,
  UserPlusIcon,
} from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import type { ApiErrorBody, CustomerListResponse } from "@pos-apps/types";
import {
  customerFromApi,
  getCachedCustomer,
  listCachedCustomers,
  markCustomerCreateSynced,
  matchCustomers,
  queueCustomerCreate,
  replaceCustomers,
  type CachedCustomerRecord,
} from "@pos-apps/local-db";
import { useCart } from "@/components/providers/cart-context";
import { authorizedFetch } from "@/lib/api-client";
import { formatIdr } from "@/lib/money";
import { copy, type LangPref } from "@/lib/preferences";

type Props = {
  lang: LangPref;
  disabled?: boolean;
  /** Controlled dialog open state (driven from cart header). */
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CustomerAttach({ lang, disabled, open, onOpenChange }: Props) {
  const t = copy(lang);
  const { customer, setCustomer } = useCart();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CachedCustomerRecord[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [warn, setWarn] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const canCreate = Boolean(name.trim() && (phone.trim() || email.trim()));

  async function refreshMatches(q: string) {
    const rows = await listCachedCustomers();
    setResults(matchCustomers(rows, q).slice(0, 8));
  }

  useEffect(() => {
    void refreshMatches(query);
  }, [query]);

  async function pullRemote() {
    if (!navigator.onLine) return;
    try {
      const qs = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : "";
      const res = await authorizedFetch(`/customers${qs}`);
      if (!res.ok) return;
      const data = (await res.json()) as CustomerListResponse;
      const pulledAt = new Date().toISOString();
      await replaceCustomers(data.customers.map((row) => customerFromApi(row, pulledAt)));
      await refreshMatches(query);
    } catch {
      /* cache remains attachable offline */
    }
  }

  useEffect(() => {
    if (open) void pullRemote();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pull when picker opens
  }, [open]);

  async function attach(row: CachedCustomerRecord) {
    setCustomer(row);
    onOpenChange(false);
    setError(null);
    setWarn(null);
  }

  async function createLocal() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setWarn(null);
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
            | { warnings?: Array<"DUPLICATE_PHONE">; customer?: { customer_id: string } }
            | ApiErrorBody;
          if (res.ok) {
            await markCustomerCreateSynced(row.customerId);
            if ("warnings" in data && data.warnings?.includes("DUPLICATE_PHONE")) {
              setWarn(t.customerDupPhone);
            }
          }
        } catch {
          /* queued create still attachable */
        }
      }
      await attach(row);
      setName("");
      setPhone("");
      setEmail("");
    } catch {
      setError(t.customerCreateFail);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {customer ? (
        <div className="mb-3 rounded-2xl border border-border bg-secondary/40 px-3 py-2">
          <p className="text-sm font-medium">{customer.name}</p>
          <p className="text-xs text-muted-foreground">
            {customer.phone ?? customer.email}
            {customer.groupName ? ` · ${customer.groupName}` : ""}
            {` · ${t.storeCredit} ${formatIdr(customer.storeCreditMinor ?? 0, lang)}`}
            {(customer.loyaltyPoints ?? 0) > 0 || customer.loyaltyTier
              ? ` · ${t.loyaltyPoints} ${customer.loyaltyPoints ?? 0}${customer.loyaltyTier ? ` (${customer.loyaltyTier})` : ""}`
              : ""}
          </p>
          <Button
            type="button"
            variant="link"
            disabled={disabled}
            className="mt-1 h-auto px-0 text-sm text-muted-foreground"
            onClick={() => setCustomer(null)}
          >
            {t.customerDetach}
          </Button>
        </div>
      ) : null}

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[min(86dvh,42rem)] overflow-y-auto gap-0 p-0 sm:max-w-lg">
          <DialogHeader className="border-b border-border px-5 pt-5 pb-4 sm:px-6">
            <DialogTitle>{t.customerAttach}</DialogTitle>
            <DialogDescription>{t.customerPickerHint}</DialogDescription>
          </DialogHeader>
          <div className="space-y-5 p-5 sm:p-6">
            <section aria-labelledby="customer-search-title" className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p id="customer-search-title" className="text-sm font-semibold">
                  {t.customerSearch}
                </p>
                {results.length ? (
                  <span className="text-xs text-muted-foreground">
                    {t.customerSearchResults.replace("{count}", String(results.length))}
                  </span>
                ) : null}
              </div>
              <div className="relative">
                <MagnifyingGlassIcon
                  size={20}
                  className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t.customerSearchPh}
                  aria-label={t.customerSearch}
                  autoFocus
                  className="h-12 rounded-xl pl-11"
                />
              </div>
              {results.length ? (
                <ul className="max-h-48 space-y-2 overflow-y-auto pr-1">
                  {results.map((row) => (
                    <li key={row.customerId}>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-auto min-h-14 w-full justify-start gap-3 rounded-xl px-3 py-2.5 text-left whitespace-normal hover:border-primary/40 hover:bg-accent/40"
                        onClick={() => void attach(row)}
                      >
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <UserIcon size={18} weight="bold" />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-semibold">{row.name}</span>
                          <span className="block truncate text-sm font-normal text-muted-foreground">
                            {row.phone ?? row.email}
                          </span>
                        </span>
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-xl bg-secondary/60 px-3 py-2.5 text-sm text-muted-foreground">
                  {query.trim() ? t.customerNoMatches : t.customerEmpty}
                </p>
              )}
            </section>

            <section aria-labelledby="customer-new-title" className="border-t border-border pt-5">
              <div className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <UserPlusIcon size={18} weight="bold" />
                </span>
                <div>
                  <p id="customer-new-title" className="text-sm font-semibold">
                    {t.customerNew}
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {t.customerCreateHint}
                  </p>
                </div>
              </div>
              <div className="mt-4 grid gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="new-customer-name">{t.customerName}</Label>
                  <Input
                    id="new-customer-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t.customerName}
                    className="h-11 rounded-xl"
                  />
                </div>
                <div className="grid gap-1.5 sm:grid-cols-2 sm:gap-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="new-customer-phone">{t.customerPhone}</Label>
                    <div className="relative">
                      <PhoneIcon size={18} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" aria-hidden />
                      <Input id="new-customer-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t.customerPhone} inputMode="tel" className="h-11 rounded-xl pl-10" />
                    </div>
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="new-customer-email">{t.customerEmail}</Label>
                    <div className="relative">
                      <EnvelopeSimpleIcon size={18} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" aria-hidden />
                      <Input id="new-customer-email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t.customerEmail} inputMode="email" className="h-11 rounded-xl pl-10" />
                    </div>
                  </div>
                </div>
              </div>
            </section>
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
            <Button
              type="button"
              disabled={busy || !canCreate}
              className="min-h-12 w-full rounded-xl"
              onClick={() => void createLocal()}
            >
              {t.customerCreate}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export async function restoreCartCustomer(customerId: string | null | undefined) {
  if (!customerId) return null;
  return (await getCachedCustomer(customerId)) ?? null;
}
