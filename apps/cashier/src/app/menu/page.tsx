"use client";

import { AuthLoadingShell } from "@pos-apps/ui/organisms";
import { Button, Input, Label } from "@pos-apps/ui/atoms";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toSelectValue,
  fromSelectValue,
} from "@pos-apps/ui/molecules";
import { ListIcon, SquaresFourIcon } from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import type {
  ApiErrorBody,
  CustomerListResponse,
  LoyaltyProgram,
  PromotionListResponse,
} from "@pos-apps/types";
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
import { fetchAllCatalogProducts } from "@/lib/fetch-all-catalog";
import { canOfferUnpack, performUnpack, withLivePackStock } from "@/lib/unpack";

type StockFilter = "all" | "in" | "out";
type CatalogSort =
  | "name-asc"
  | "name-desc"
  | "price-asc"
  | "price-desc"
  | "stock-desc";
type CatalogView = "grid" | "list";

const CATALOG_PAGE_SIZE = 24;
const CATALOG_VIEW_KEY = "pos_cashier_catalog_view";

function readCatalogView(): CatalogView {
  if (typeof window === "undefined") return "grid";
  return localStorage.getItem(CATALOG_VIEW_KEY) === "list" ? "list" : "grid";
}

function compareLocale(a: string, b: string, lang: string): number {
  return a.localeCompare(b, lang === "en" ? "en" : "id", {
    sensitivity: "base",
  });
}

function filterAndSortProducts(
  products: CatalogProductRecord[],
  opts: {
    query: string;
    category: string;
    stock: StockFilter;
    sort: CatalogSort;
    lang: string;
  },
): CatalogProductRecord[] {
  const q = opts.query.trim().toLowerCase();
  const filtered = products.filter((p) => {
    if (opts.category && (p.categoryName ?? "") !== opts.category) return false;
    if (opts.stock === "in" && p.stockQty <= 0) return false;
    if (opts.stock === "out" && p.stockQty > 0) return false;
    if (!q) return true;
    const hay = `${p.name} ${p.sku ?? ""} ${p.unitName ?? ""}`.toLowerCase();
    return hay.includes(q);
  });

  const sorted = [...filtered];
  sorted.sort((a, b) => {
    switch (opts.sort) {
      case "name-desc":
        return compareLocale(b.name, a.name, opts.lang);
      case "price-asc":
        return (
          a.priceMinor - b.priceMinor ||
          compareLocale(a.name, b.name, opts.lang)
        );
      case "price-desc":
        return (
          b.priceMinor - a.priceMinor ||
          compareLocale(a.name, b.name, opts.lang)
        );
      case "stock-desc":
        return (
          b.stockQty - a.stockQty || compareLocale(a.name, b.name, opts.lang)
        );
      case "name-asc":
      default:
        return compareLocale(a.name, b.name, opts.lang);
    }
  });
  return sorted;
}

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
  const [syncStatus, setSyncStatus] = useState<"idle" | "pending" | "synced">(
    "idle",
  );
  const [syncError, setSyncError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");
  const [sortBy, setSortBy] = useState<CatalogSort>("name-asc");
  const [viewMode, setViewMode] = useState<CatalogView>("grid");
  const [page, setPage] = useState(1);
  const { add, lines, pruneToSellable, raiseStockCap } = useCart();
  const [unpackTarget, setUnpackTarget] = useState<CatalogProductRecord | null>(
    null,
  );
  const [unpackBusy, setUnpackBusy] = useState(false);
  const [unpackError, setUnpackError] = useState<string | null>(null);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) {
      if (p.categoryName?.trim()) set.add(p.categoryName.trim());
    }
    return [...set].sort((a, b) => compareLocale(a, b, lang));
  }, [products, lang]);

  const visibleProducts = useMemo(
    () =>
      filterAndSortProducts(products, {
        query: searchQuery,
        category: categoryFilter,
        stock: stockFilter,
        sort: sortBy,
        lang,
      }),
    [products, searchQuery, categoryFilter, stockFilter, sortBy, lang],
  );

  const totalPages = Math.max(
    1,
    Math.ceil(visibleProducts.length / CATALOG_PAGE_SIZE),
  );
  const pagedProducts = useMemo(() => {
    const safePage = Math.min(Math.max(1, page), totalPages);
    const start = (safePage - 1) * CATALOG_PAGE_SIZE;
    return visibleProducts.slice(start, start + CATALOG_PAGE_SIZE);
  }, [visibleProducts, page, totalPages]);

  useEffect(() => {
    setViewMode(readCatalogView());
  }, []);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, categoryFilter, stockFilter, sortBy]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

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

  useEffect(() => {
    if (categoryFilter && !categories.includes(categoryFilter)) {
      setCategoryFilter("");
    }
  }, [categories, categoryFilter]);

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
      const list = await fetchAllCatalogProducts();
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
      const body = (err as { body?: ApiErrorBody })?.body;
      setPullError(body?.message ?? t.catalogPullFail);
      await refreshLocal();
    } finally {
      setPulling(false);
    }
  }

  async function handleCompleted(_sale: LocalSaleRecord) {
    await refreshLocal();
    await flushSync();
  }

  function clearCatalogFilters() {
    setSearchQuery("");
    setCategoryFilter("");
    setStockFilter("all");
    setSortBy("name-asc");
    setPage(1);
  }

  function setCatalogView(next: CatalogView) {
    setViewMode(next);
    localStorage.setItem(CATALOG_VIEW_KEY, next);
  }

  function formatTemplate(
    template: string,
    values: Record<string, string | number>,
  ): string {
    return Object.entries(values).reduce(
      (text, [key, value]) => text.replaceAll(`{${key}}`, String(value)),
      template,
    );
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
      <div className="flex min-h-0 flex-1 flex-col gap-4">
      {!online ? (
        <p className="shrink-0 rounded-2xl border border-border bg-secondary/70 px-3 py-2 text-sm text-muted-foreground">
          {t.offlineMode} — {t.offlineKeep}
        </p>
      ) : null}
      {pendingSyncCount ? (
        <p className="shrink-0 text-sm text-muted-foreground">
          {t.waitingUpload}: {pendingSyncCount}
        </p>
      ) : null}
      {syncStatus === "synced" ? (
        <p className="shrink-0 text-sm text-success">{t.synced}</p>
      ) : null}
      {syncError ? (
        <p
          className="shrink-0 rounded-2xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {syncError}
        </p>
      ) : null}

      {pullError ? (
        <p
          className="shrink-0 rounded-2xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {pullError}
        </p>
      ) : null}

      {products.length > 0 ? (
        <div className="shrink-0 space-y-3 rounded-2xl border border-border/70 bg-muted/30 p-3 sm:p-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="grid gap-1.5 sm:col-span-2 xl:col-span-2">
              <Label htmlFor="catalog-search">{t.catalogSearch}</Label>
              <Input
                id="catalog-search"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.catalogSearchPlaceholder}
                autoComplete="off"
                className="h-11 rounded-xl bg-background"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="catalog-category">{t.catalogFilterCategory}</Label>
              <Select
                value={toSelectValue(categoryFilter)}
                onValueChange={(value) => setCategoryFilter(fromSelectValue(value))}
              >
                <SelectTrigger
                  id="catalog-category"
                  className="h-11 rounded-xl bg-background"
                >
                  <SelectValue placeholder={t.catalogFilterAllCategories} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={toSelectValue("")}>
                    {t.catalogFilterAllCategories}
                  </SelectItem>
                  {categories.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="catalog-stock">{t.catalogFilterStock}</Label>
              <Select
                value={stockFilter}
                onValueChange={(value) => setStockFilter(value as StockFilter)}
              >
                <SelectTrigger
                  id="catalog-stock"
                  className="h-11 rounded-xl bg-background"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t.catalogFilterAllStock}</SelectItem>
                  <SelectItem value="in">{t.catalogFilterInStock}</SelectItem>
                  <SelectItem value="out">{t.catalogFilterOutOfStock}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="grid min-w-[12rem] flex-1 gap-1.5 sm:max-w-xs">
              <Label htmlFor="catalog-sort">{t.catalogSort}</Label>
              <Select
                value={sortBy}
                onValueChange={(value) => setSortBy(value as CatalogSort)}
              >
                <SelectTrigger
                  id="catalog-sort"
                  className="h-11 rounded-xl bg-background"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name-asc">{t.catalogSortNameAsc}</SelectItem>
                  <SelectItem value="name-desc">{t.catalogSortNameDesc}</SelectItem>
                  <SelectItem value="price-asc">{t.catalogSortPriceAsc}</SelectItem>
                  <SelectItem value="price-desc">{t.catalogSortPriceDesc}</SelectItem>
                  <SelectItem value="stock-desc">{t.catalogSortStockDesc}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div
              className="inline-flex rounded-xl border border-border bg-background p-1"
              role="group"
              aria-label={t.catalogViewGrid}
            >
              <Button
                type="button"
                variant={viewMode === "grid" ? "default" : "ghost"}
                size="icon"
                className="size-10 rounded-lg"
                aria-pressed={viewMode === "grid"}
                aria-label={t.catalogViewGrid}
                title={t.catalogViewGrid}
                onClick={() => setCatalogView("grid")}
              >
                <SquaresFourIcon size={20} />
              </Button>
              <Button
                type="button"
                variant={viewMode === "list" ? "default" : "ghost"}
                size="icon"
                className="size-10 rounded-lg"
                aria-pressed={viewMode === "list"}
                aria-label={t.catalogViewList}
                title={t.catalogViewList}
                onClick={() => setCatalogView("list")}
              >
                <ListIcon size={20} />
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {products.length === 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-border bg-secondary/40 p-8 text-muted-foreground">
          <div className="max-w-sm text-center">
            <p>{t.catalogEmpty}</p>
            {!online ? (
              <p className="mt-2 text-sm">{t.catalogEmptyOffline}</p>
            ) : null}
          </div>
        </div>
      ) : visibleProducts.length === 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-border bg-secondary/40 p-8 text-muted-foreground">
          <div className="max-w-sm text-center">
            <p>{t.catalogNoMatches}</p>
            <Button
              type="button"
              variant="secondary"
              className="mt-4 rounded-xl"
              onClick={clearCatalogFilters}
            >
              {t.catalogClearFilters}
            </Button>
          </div>
        </div>
      ) : (
        <>
          <ul
            className={
              viewMode === "grid"
                ? "grid min-h-0 flex-1 auto-rows-min grid-cols-1 content-start gap-3 overflow-y-auto pb-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
                : "flex min-h-0 flex-1 flex-col content-start gap-2 overflow-y-auto pb-2"
            }
          >
            {pagedProducts.map((p) => {
              const selectedQty = lines.find(
                (line) => line.productId === p.productId,
              )?.qty ?? 0;
              const priceOk = isValidSellablePrice(p.priceMinor);
              const inStock = priceOk && p.stockQty > 0;
              const unpackable =
                priceOk &&
                p.stockQty <= 0 &&
                canOfferUnpack(p, online, products);
              const clickable = inStock || unpackable;
              const priceLabel =
                inStock || unpackable
                  ? formatIdr(p.priceMinor, lang)
                  : p.stockQty <= 0
                    ? t.stockOut
                    : t.catalogBlockedPrice;
              return (
                <li key={p.productId} className="h-full">
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
                    className={
                      viewMode === "grid"
                        ? `group relative flex h-full w-full flex-col items-stretch gap-0 overflow-hidden rounded-2xl border-border/80 p-0 text-left whitespace-normal shadow-none transition-colors hover:border-primary/40 hover:bg-accent/40 ${selectedQty > 0 ? "border-primary bg-accent/30 ring-1 ring-primary/20" : ""}`
                        : `group relative flex h-full w-full flex-row items-center gap-3 rounded-2xl border-border/80 p-2.5 text-left whitespace-normal shadow-none transition-colors hover:border-primary/40 hover:bg-accent/40 sm:gap-4 sm:p-3 ${selectedQty > 0 ? "border-primary bg-accent/30 ring-1 ring-primary/20" : ""}`
                    }
                    title={
                      clickable
                        ? undefined
                        : p.stockQty <= 0
                          ? t.stockOut
                          : t.catalogBlockedPrice
                    }
                  >
                    {selectedQty > 0 ? (
                      <span
                        className="absolute top-2 right-2 z-10 inline-flex min-w-8 items-center justify-center rounded-full bg-primary px-2 py-1 text-sm font-bold leading-none text-primary-foreground shadow-md"
                        aria-label={`${selectedQty} dipilih`}
                      >
                        {selectedQty}
                      </span>
                    ) : null}
                    <CatalogProductThumb
                      productId={p.productId}
                      alt=""
                      className={
                        viewMode === "list"
                          ? "aspect-square size-16 w-16 shrink-0 rounded-xl sm:size-[4.5rem] sm:w-[4.5rem]"
                          : "aspect-[4/3] max-h-36 rounded-none"
                      }
                    />
                    <span
                      className={
                        viewMode === "grid"
                          ? "flex min-w-0 flex-col gap-1 px-3 pt-2 pb-2.5"
                          : "flex min-w-0 flex-1 flex-col gap-1 py-0.5"
                      }
                    >
                      <span className="truncate text-base font-semibold tracking-tight text-foreground">
                        {p.name}
                      </span>
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                        {p.unitName ? (
                          <span className="rounded-md bg-secondary px-1.5 py-0.5 text-xs font-medium text-secondary-foreground">
                            {p.unitName}
                          </span>
                        ) : null}
                        <span className="font-medium text-foreground">
                          {priceLabel}
                        </span>
                        <span className="text-muted-foreground">
                          {t.stock}: {p.stockQty}
                        </span>
                        {unpackable ? (
                          <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                            {t.unpackTitle}
                          </span>
                        ) : null}
                      </span>
                    </span>
                  </Button>
                </li>
              );
            })}
          </ul>
          <div className="mt-auto flex w-full shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border pt-3 pb-28 md:pb-0">
            <p className="text-sm text-muted-foreground">
              {formatTemplate(t.catalogShowing, {
                from: (page - 1) * CATALOG_PAGE_SIZE + 1,
                to: Math.min(page * CATALOG_PAGE_SIZE, visibleProducts.length),
                count: visibleProducts.length,
              })}
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                className="min-h-11 rounded-xl"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                {t.catalogPagePrev}
              </Button>
              <span className="min-w-28 text-center text-sm text-muted-foreground">
                {formatTemplate(t.catalogPageOf, {
                  page,
                  total: totalPages,
                })}
              </span>
              <Button
                type="button"
                variant="secondary"
                className="min-h-11 rounded-xl"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                {t.catalogPageNext}
              </Button>
            </div>
          </div>
        </>
      )}
      </div>

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
