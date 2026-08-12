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
import { AppShell } from "@/components/app-shell";
import { AuthLoadingShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { CartPanel } from "@/components/cart-panel";
import { useCart } from "@/components/cart-context";
import { getAccessToken, isAccessTokenExpired } from "@/lib/auth-token";
import { authorizedFetch } from "@/lib/api-client";
import { formatIdr } from "@/lib/money";
import { isPinUnlocked } from "@/lib/pin-session";
import { applyTheme, copy, getLang } from "@/lib/preferences";

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
    if (!token || isAccessTokenExpired(token)) {
      setPendingSyncCount(pending.length);
      if (pending.length) setSyncStatus("pending");
      return;
    }
    let failed = false;
    for (const sale of pending) {
      try {
        const response = await authorizedFetch("/sales/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(toSyncSaleRequest(sale)),
        });
        if (response.ok) await markSaleSynced(sale.saleId);
        else failed = true;
      } catch (err) {
        if (
          err instanceof Error &&
          (err.message === "AUTH_UNAUTHORIZED" ||
            err.message === "AUTH_SESSION_EXPIRED")
        ) {
          return;
        }
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
    if (!token || isAccessTokenExpired(token)) {
      setPullError(t.catalogNeedLogin);
      return;
    }
    if (!navigator.onLine) {
      setPullError(t.catalogOffline);
      return;
    }
    setPulling(true);
    try {
      const res = await authorizedFetch("/catalog/products");
      const data = (await res.json()) as ProductListResponse | ApiErrorBody;
      if (!res.ok) {
        setPullError((data as ApiErrorBody).message ?? t.catalogPullFail);
        await refreshLocal();
        return;
      }
      const list = (data as ProductListResponse).products ?? [];
      await replaceCatalog(list);
      await refreshLocal();
    } catch (err) {
      if (
        err instanceof Error &&
        (err.message === "AUTH_UNAUTHORIZED" ||
          err.message === "AUTH_SESSION_EXPIRED")
      ) {
        return;
      }
      setPullError(t.catalogPullFail);
      await refreshLocal();
    } finally {
      setPulling(false);
    }
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
    return <AuthLoadingShell message={t.loading} />;
  }

  return (
    <AppShell
      title={t.menuTitle}
      lang={lang}
      onLangChange={() => setLang(getLang())}
      subtitle={
        <>
          {t.menuLocalOnly}
          {pulledAt
            ? ` · ${t.catalogPulled}: ${new Date(pulledAt).toLocaleString(lang === "en" ? "en-US" : "id-ID")}`
            : ""}
        </>
      }
      headerActions={
        <Button
          type="button"
          disabled={pulling || !online}
          onClick={() => void pullCatalog()}
          className="rounded-2xl bg-secondary text-secondary-foreground hover:opacity-90"
        >
          {pulling ? t.catalogPulling : t.catalogPull}
        </Button>
      }
      aside={<CartPanel lang={lang} onCompleted={handleCompleted} />}
    >
      {!online ? (
        <p className="mb-4 rounded-2xl border border-border bg-secondary/70 px-3 py-2 text-sm text-muted-foreground">
          {t.offlineMode} — {t.offlineKeep}
        </p>
      ) : null}
      {pendingSyncCount ? (
        <p className="mb-2 text-sm text-muted-foreground">
          {t.waitingUpload}: {pendingSyncCount}
        </p>
      ) : null}
      {syncStatus === "synced" ? (
        <p className="mb-2 text-sm text-success">{t.synced}</p>
      ) : null}
      {syncError ? (
        <p
          className="mb-4 rounded-2xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {syncError}
        </p>
      ) : null}

      {pullError ? (
        <p
          className="mb-4 rounded-2xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {pullError}
        </p>
      ) : null}
      {products.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-secondary/40 p-8 text-muted-foreground">
          <p>{t.catalogEmpty}</p>
          {!online ? <p className="mt-2 text-sm">{t.catalogEmptyOffline}</p> : null}
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {products.map((p) => {
            const sellable = isValidSellablePrice(p.priceMinor) && p.stockQty > 0;
            return (
              <li key={p.productId}>
                <button
                  type="button"
                  disabled={!sellable}
                  onClick={() => add(p)}
                  className="flex min-h-[4.5rem] w-full flex-col items-start justify-center gap-1 rounded-2xl border border-border bg-background/60 px-4 py-3 text-left transition-colors hover:bg-secondary/60 disabled:cursor-not-allowed disabled:opacity-50"
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
    </AppShell>
  );
}
