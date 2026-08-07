"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ApiErrorBody, ProductListResponse } from "@pos-apps/types";
import {
  getCatalogPulledAt,
  isValidSellablePrice,
  listCatalogProducts,
  replaceCatalog,
  listPendingSyncSales,
  markSaleSynced,
  toSyncSaleRequest,
  type CatalogProductRecord,
  type LocalSaleRecord,
} from "@pos-apps/local-db";
import { Button } from "@/components/ui/button";
import { CartPanel } from "@/components/cart-panel";
import { useCart } from "@/components/cart-context";
import { SettingsMenu } from "@/components/settings-menu";
import { clearSession, getAccessToken } from "@/lib/auth-token";
import { formatIdr } from "@/lib/money";
import { clearPinUnlock, isPinUnlocked } from "@/lib/pin-session";
import { applyTheme, copy, getLang } from "@/lib/preferences";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export default function MenuPage() {
  const router = useRouter();
  const [lang, setLang] = useState(getLang());
  const t = copy(lang);
  const [ready, setReady] = useState(false);
  const [products, setProducts] = useState<CatalogProductRecord[]>([]);
  const [pulledAt, setPulledAt] = useState<string | null>(null);
  const [pullError, setPullError] = useState<string | null>(null);
  const [pulling, setPulling] = useState(false);
  const [online, setOnline] = useState(true);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [syncStatus, setSyncStatus] = useState<"idle" | "pending" | "synced">("idle");
  const [syncError, setSyncError] = useState<string | null>(null);
  const { add } = useCart();

  const refreshLocal = useCallback(async () => {
    setProducts(await listCatalogProducts());
    setPulledAt(await getCatalogPulledAt());
  }, []);

  const flushSync = useCallback(async () => {
    const pending = await listPendingSyncSales();
    if (!navigator.onLine) {
      setPendingSyncCount(pending.length);
      if (pending.length) setSyncStatus("pending");
      return;
    }
    const token = getAccessToken();
    if (!token) {
      setPendingSyncCount(pending.length);
      if (pending.length) setSyncStatus("pending");
      return;
    }
    let failed = false;
    for (const sale of pending) {
      try {
        const response = await fetch(`${API_URL}/sales/sync`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(toSyncSaleRequest(sale)),
        });
        if (response.ok) await markSaleSynced(sale.saleId);
        else failed = true;
      } catch {
        failed = true;
      }
    }
    const remaining = await listPendingSyncSales();
    setPendingSyncCount(remaining.length);
    setSyncStatus(remaining.length ? "pending" : pending.length ? "synced" : "idle");
    setSyncError(failed && remaining.length ? copy(lang).syncFail : null);
  }, [lang]);

  useEffect(() => {
    applyTheme();
    document.documentElement.lang = getLang();
    if (!isPinUnlocked()) {
      router.replace("/pin");
      return;
    }
    void refreshLocal().then(() => setReady(true));
    setOnline(navigator.onLine);
    const onOnline = () => {
      setOnline(true);
      void flushSync();
    };
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    void flushSync();
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [router, refreshLocal, flushSync]);

  async function pullCatalog() {
    setPullError(null);
    const token = getAccessToken();
    if (!token) {
      setPullError(t.catalogNeedLogin);
      return;
    }
    if (!navigator.onLine) {
      setPullError(t.catalogOffline);
      return;
    }
    setPulling(true);
    try {
      const res = await fetch(`${API_URL}/catalog/products`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json()) as ProductListResponse | ApiErrorBody;
      if (!res.ok) {
        setPullError((data as ApiErrorBody).message ?? t.catalogPullFail);
        await refreshLocal();
        return;
      }
      const list = (data as ProductListResponse).products ?? [];
      await replaceCatalog(list);
      await refreshLocal();
    } catch {
      setPullError(t.catalogPullFail);
      await refreshLocal();
    } finally {
      setPulling(false);
    }
  }

  function logout() {
    clearSession();
    clearPinUnlock();
    router.replace("/login");
  }

  async function handleCompleted(_sale: LocalSaleRecord) {
    await refreshLocal();
    if (navigator.onLine) await flushSync();
    else {
      setPendingSyncCount((await listPendingSyncSales()).length);
      setSyncStatus("pending");
    }
  }

  if (!ready) {
    return (
      <main className="flex flex-1 items-center p-8 text-muted-foreground">
        {t.loading}
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col gap-6 pb-80 p-6 md:pb-8 md:p-8">
      <div className="flex w-full items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-accent">{t.brand}</p>
          <h1 className="text-3xl font-semibold tracking-tight text-primary">
            {t.menuTitle}
          </h1>
          <p className="max-w-lg text-sm text-muted-foreground">
            {t.menuLocalOnly}
            {pulledAt
              ? ` · ${t.catalogPulled}: ${new Date(pulledAt).toLocaleString(lang === "en" ? "en-US" : "id-ID")}`
              : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            disabled={pulling || !online}
            onClick={() => void pullCatalog()}
            className="min-h-12"
          >
            {pulling ? t.catalogPulling : t.catalogPull}
          </Button>
          <SettingsMenu onLangChange={() => setLang(getLang())} />
        </div>
      </div>

      {!online ? (
        <p className="rounded-lg bg-secondary px-3 py-2 text-sm text-muted-foreground">
          {t.offlineMode} — {t.offlineKeep}
        </p>
      ) : null}
      {pendingSyncCount ? (
        <p className="text-sm text-muted-foreground">
          {t.waitingUpload}: {pendingSyncCount}
        </p>
      ) : null}
      {syncStatus === "synced" ? (
        <p className="text-sm text-muted-foreground">{t.synced}</p>
      ) : null}
      {syncError ? (
        <p className="text-sm text-destructive" role="alert">
          {syncError}
        </p>
      ) : null}
      <div className="grid flex-1 gap-6 md:grid-cols-[minmax(0,1fr)_22rem]">
        <section>
          {pullError ? (
            <p className="mb-4 text-sm text-destructive" role="alert">
              {pullError}
            </p>
          ) : null}
          {products.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-8 text-muted-foreground">
              <p>{t.catalogEmpty}</p>
              {!online ? <p className="mt-2 text-sm">{t.catalogEmptyOffline}</p> : null}
            </div>
          ) : (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((p) => {
                const sellable = isValidSellablePrice(p.priceMinor) && p.stockQty > 0;
                return (
                  <li key={p.productId}>
                    <button
                      type="button"
                      disabled={!sellable}
                      onClick={() => add(p)}
                      className="flex min-h-[56px] w-full flex-col items-start justify-center gap-1 rounded-lg border border-border bg-background px-4 py-3 text-left transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                      title={
                        sellable
                          ? undefined
                          : p.stockQty <= 0
                            ? t.stockOut
                            : t.catalogBlockedPrice
                      }
                    >
                      <span className="font-medium text-foreground">{p.name}</span>
                      <span className="text-sm text-muted-foreground">
                        {sellable
                          ? formatIdr(p.priceMinor, lang)
                          : p.stockQty <= 0
                            ? t.stockOut
                            : t.catalogBlockedPrice}
                        {` · ${t.stock}: ${p.stockQty}`}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        <CartPanel lang={lang} onCompleted={handleCompleted} />
      </div>

      <Button type="button" onClick={logout} className="self-start">
        {t.logout}
      </Button>
    </main>
  );
}
