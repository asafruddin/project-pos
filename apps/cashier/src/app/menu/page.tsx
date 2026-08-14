"use client";

import { AuthLoadingShell } from "@pos-apps/ui/organisms";
import { Button } from "@pos-apps/ui/atoms";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  cacheCatalogImages,
  customerFromApi,
  getCatalogPulledAt,
  isValidSellablePrice,
  listCatalogProducts,
  replaceCatalog,
  replaceCustomers,
  replaceLoyaltyProgram,
  replacePromotions,
  type CatalogProductRecord,
  type LocalSaleRecord,
} from "@pos-apps/local-db";
import type { ApiErrorBody, CustomerListResponse, LoyaltyProgram, ProductListResponse, PromotionListResponse } from "@pos-apps/types";
import { AppShell } from "@/components/templates/app-shell";
import { CartPanel } from "@/components/organisms/cart-panel";
import { CatalogProductThumb } from "@/components/molecules/catalog-product-thumb";
import { useCart } from "@/components/providers/cart-context";
import { getAccessToken, isAccessTokenExpired } from "@/lib/auth-token";
import { authorizedFetch } from "@/lib/api-client";
import { formatIdr } from "@/lib/money";
import { isPinUnlocked } from "@/lib/pin-session";
import { applyTheme, copy, getLang } from "@/lib/preferences";
import { flushSalesAndVoids } from "@/lib/flush-sync";

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
  const { add, pruneToSellable } = useCart();

  const refreshLocal = useCallback(async () => {
    setProducts(await listCatalogProducts());
    setPulledAt(await getCatalogPulledAt());
  }, []);

  const flushSync = useCallback(async () => {
    const result = await flushSalesAndVoids();
    setPendingSyncCount(result.pendingCount);
    if (result.pendingCount) setSyncStatus("pending");
    else if (result.uploaded) setSyncStatus("synced");
    else setSyncStatus("idle");
    setSyncError(result.failed ? copy(lang).syncFail : null);
    if (navigator.onLine) {
      try {
        const res = await authorizedFetch("/customers");
        if (res.ok) {
          const data = (await res.json()) as CustomerListResponse;
          const pulledAt = new Date().toISOString();
          await replaceCustomers(
            data.customers.map((row) => customerFromApi(row, pulledAt)),
          );
        }
      } catch {
        /* cached customers remain attachable */
      }
      try {
        const loyaltyRes = await authorizedFetch("/loyalty/program");
        if (loyaltyRes.ok) {
          await replaceLoyaltyProgram(
            (await loyaltyRes.json()) as LoyaltyProgram,
          );
        }
      } catch {
        /* last cached program remains; redeem hides if missing */
      }
      try {
        const promoRes = await authorizedFetch("/promotions");
        if (promoRes.ok) {
          const data = (await promoRes.json()) as PromotionListResponse;
          await replacePromotions(data.promotions ?? []);
        }
      } catch {
        /* last cached autos remain */
      }
    }
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
      try {
        await cacheCatalogImages(list, async (productId, image) => {
          try {
            const fileRes = await authorizedFetch(
              `/catalog/products/${productId}/images/${image.image_id}/file`,
              { signal: AbortSignal.timeout(8000) },
            );
            if (!fileRes.ok) return null;
            const bytes = await fileRes.arrayBuffer();
            const mimeType =
              fileRes.headers.get("content-type")?.split(";")[0]?.trim() ||
              "image/jpeg";
            return { mimeType, bytes };
          } catch {
            return null;
          }
        });
      } catch {
        /* catalog rows already saved; missing images never block sell */
      }
      const sellable = await listCatalogProducts();
      setProducts(sellable);
      setPulledAt(await getCatalogPulledAt());
      pruneToSellable(sellable);
      try {
        const loyaltyRes = await authorizedFetch("/loyalty/program");
        if (loyaltyRes.ok) {
          await replaceLoyaltyProgram(
            (await loyaltyRes.json()) as LoyaltyProgram,
          );
        }
      } catch {
        /* catalog already saved; loyalty remains last cache */
      }
      try {
        const promoRes = await authorizedFetch("/promotions");
        if (promoRes.ok) {
          const data = (await promoRes.json()) as PromotionListResponse;
          await replacePromotions(data.promotions ?? []);
        }
      } catch {
        /* last cached autos remain */
      }
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
    await flushSync();
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
                <Button
                  type="button"
                  disabled={!sellable}
                  variant="outline"
                  onClick={() => add(p)}
                  className="flex h-auto min-h-[4.5rem] w-full flex-col items-start justify-center gap-1 rounded-2xl px-4 py-3 text-left whitespace-normal"
                  title={
                    sellable
                      ? undefined
                      : p.stockQty <= 0
                        ? t.stockOut
                        : t.catalogBlockedPrice
                  }
                >
                  <CatalogProductThumb productId={p.productId} alt="" />
                  <span className="font-medium text-foreground">{p.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {sellable
                      ? formatIdr(p.priceMinor, lang)
                      : p.stockQty <= 0
                        ? t.stockOut
                        : t.catalogBlockedPrice}
                    {` · ${t.stock}: ${p.stockQty}`}
                  </span>
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </AppShell>
  );
}
