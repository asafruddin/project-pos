"use client";

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
import { useCart } from "@/components/cart-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authorizedFetch } from "@/lib/api-client";
import { formatIdr } from "@/lib/money";
import { copy, type LangPref } from "@/lib/preferences";

type Props = {
  lang: LangPref;
  disabled?: boolean;
};

export function CustomerAttach({ lang, disabled }: Props) {
  const t = copy(lang);
  const { customer, setCustomer } = useCart();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CachedCustomerRecord[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [warn, setWarn] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
    setOpen(false);
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

  if (customer) {
    return (
      <div className="mt-3 rounded-2xl border border-border bg-secondary/40 px-3 py-2">
        <p className="text-sm font-medium">{customer.name}</p>
        <p className="text-xs text-muted-foreground">
          {customer.phone ?? customer.email}
          {customer.groupName ? ` · ${customer.groupName}` : ""}
          {` · ${t.storeCredit} ${formatIdr(customer.storeCreditMinor ?? 0, lang)}`}
          {(customer.loyaltyPoints ?? 0) > 0 || customer.loyaltyTier
            ? ` · ${t.loyaltyPoints} ${customer.loyaltyPoints ?? 0}${customer.loyaltyTier ? ` (${customer.loyaltyTier})` : ""}`
            : ""}
        </p>
        <button
          type="button"
          disabled={disabled}
          className="mt-1 text-sm text-muted-foreground"
          onClick={() => setCustomer(null)}
        >
          {t.customerDetach}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        disabled={disabled}
        className="text-sm text-muted-foreground"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? t.customerHide : t.customerAttach}
      </button>
      {open ? (
        <div className="mt-2 space-y-2 rounded-2xl border border-border p-3">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.customerSearchPh}
            aria-label={t.customerSearch}
          />
          {results.length ? (
            <ul className="max-h-40 space-y-1 overflow-y-auto">
              {results.map((row) => (
                <li key={row.customerId}>
                  <button
                    type="button"
                    className="w-full rounded-xl px-2 py-2 text-left text-sm hover:bg-secondary/70"
                    onClick={() => void attach(row)}
                  >
                    <span className="font-medium">{row.name}</span>
                    <span className="ml-2 text-muted-foreground">
                      {row.phone ?? row.email}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">{t.customerEmpty}</p>
          )}
          <p className="text-xs font-medium text-muted-foreground">{t.customerNew}</p>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t.customerName}
          />
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={t.customerPhone}
          />
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t.customerEmail}
          />
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
            disabled={busy}
            className="min-h-12 w-full rounded-2xl bg-secondary text-secondary-foreground"
            onClick={() => void createLocal()}
          >
            {t.customerCreate}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export async function restoreCartCustomer(customerId: string | null | undefined) {
  if (!customerId) return null;
  return (await getCachedCustomer(customerId)) ?? null;
}
