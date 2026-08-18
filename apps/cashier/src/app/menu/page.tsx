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
import { UnpackConfirmDialog } from "@/components/organisms/unpack-confirm-dialog";
import { useCart } from "@/components/providers/cart-context";
import { getAccessToken, isAccessTokenExpired } from "@/lib/auth-token";
import { authorizedFetch } from "@/lib/api-client";
import { formatIdr } from "@/lib/money";
import { isPinUnlocked } from "@/lib/pin-session";
import { applyTheme, copy, getLang } from "@/lib/preferences";
import { flushSalesAndVoids } from "@/lib/flush-sync";
import { canOfferUnpack, performUnpack, withLivePackStock } from "@/lib/unpack";

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
  const { add, pruneToSellable, raiseStockCap } = useCart();
  const [unpackTarget, setUnpackTarget] = useState<CatalogProductRecord | null>(
    null,
  );
  const [unpackBusy, setUnpackBusy] = useState(false);
  const [unpackError, setUnpackError] = useState<string | null>(null);

  const refreshLocal = useCallback(async () => {
    const rows = withLivePackStock(await listCatalogProducts());
    setProducts(rows);
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
      const sellable = withLivePackStock(await listCatalogProducts());
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
          className="rounded-xl"
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
        <ul className="grid grid-cols-1 gap-3 pb-36 sm:grid-cols-2 md:pb-0 xl:grid-cols-3">
          {products.map((p) => {
            const priceOk = isValidSellablePrice(p.priceMinor);
            const inStock = priceOk && p.stockQty > 0;
            const unpackable =
              priceOk && p.stockQty <= 0 && canOfferUnpack(p, online, products);
            const clickable = inStock || unpackable;
            return (
              <li key={p.productId}>
                <Button
                  type="button"
                  disabled={!clickable}
                  variant="outline"
                  onClick={() => {
                    if (inStock) {
                      add(p);
                      return;
                    }
                    if (unpackable) {
                      setUnpackError(null);
                      setUnpackTarget(p);
                    }
                  }}
                  className="flex h-auto w-full flex-col items-stretch gap-0 overflow-hidden rounded-xl p-0 text-left whitespace-normal"
                  title={
                    clickable
                      ? undefined
                      : p.stockQty <= 0
                        ? t.stockOut
                        : t.catalogBlockedPrice
                  }
                >
                  <CatalogProductThumb productId={p.productId} alt="" />
                  <span className="px-3 pt-2.5 font-medium text-foreground">
                    {p.name}
                    {p.unitName ? (
                      <span className="font-normal text-muted-foreground">
                        {" "}
                        · {p.unitName}
                      </span>
                    ) : null}
                  </span>
                  <span className="px-3 pb-3 text-sm text-muted-foreground">
                    {inStock || unpackable
                      ? formatIdr(p.priceMinor, lang)
                      : p.stockQty <= 0
                        ? t.stockOut
                        : t.catalogBlockedPrice}
                    {` · ${t.stock}: ${p.stockQty}`}
                    {unpackable ? ` · ${t.unpackTitle}` : ""}
                  </span>
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      <UnpackConfirmDialog
        lang={lang}
        product={unpackTarget}
        open={Boolean(unpackTarget)}
        busy={unpackBusy}
        error={unpackError}
        onCancel={() => {
          if (unpackBusy) return;
          setUnpackTarget(null);
          setUnpackError(null);
        }}
        onConfirm={() => {
          if (!unpackTarget || unpackBusy) return;
          void (async () => {
            setUnpackBusy(true);
            setUnpackError(null);
            const result = await performUnpack(unpackTarget);
            if (!result.ok) {
              setUnpackError(
                result.message === "network" ? t.unpackFail : result.message,
              );
              setUnpackBusy(false);
              await refreshLocal();
              return;
            }
            raiseStockCap(result.product.productId, result.product.stockQty);
            add(result.product);
            setUnpackBusy(false);
            setUnpackTarget(null);
            await refreshLocal();
          })();
        }}
      />
    </AppShell>
  );
}
