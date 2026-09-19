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
import { ListIcon, MagnifyingGlassIcon, SquaresFourIcon } from "@phosphor-icons/react";
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
    setSyncError(
      result.failed
        ? result.errorMessage
          ? `${copy(lang).syncFail} ${result.errorMessage}`
          : copy(lang).syncFail
        : null,
    );
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
      <div className="flex min-h-0 flex-1 flex-col gap-2 md:gap-4">
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
        <div className="shrink-0 space-y-2 md:space-y-3 md:rounded-2xl md:border md:border-border/70 md:bg-muted/30 md:p-4">
          <div className="relative">
            <MagnifyingGlassIcon
              size={18}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
            />
            <Label htmlFor="catalog-search" className="sr-only">
              {t.catalogSearch}
            </Label>
            <Input
              id="catalog-search"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.catalogSearchPlaceholder}
              autoComplete="off"
              className="h-10 rounded-xl bg-muted/50 pr-3 pl-9 md:h-11 md:bg-background"
            />
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] md:hidden [&::-webkit-scrollbar]:hidden">
            <Button
              type="button"
              size="sm"
              variant={categoryFilter === "" ? "default" : "outline"}
              className="h-8 shrink-0 rounded-full px-3 text-xs"
              onClick={() => setCategoryFilter("")}
            >
              {t.catalogFilterAllCategories}
            </Button>
            {categories.map((name) => (
              <Button
                key={name}
                type="button"
                size="sm"
                variant={categoryFilter === name ? "default" : "outline"}
                className="h-8 max-w-40 shrink-0 truncate rounded-full px-3 text-xs"
                onClick={() => setCategoryFilter(name)}
              >
                {name}
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 md:hidden">
              <Select
                value={stockFilter}
                onValueChange={(value) => setStockFilter(value as StockFilter)}
              >
                <SelectTrigger
                  id="catalog-stock-mobile"
                  aria-label={t.catalogFilterStock}
                  className="h-9 rounded-xl bg-muted/50 text-xs"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t.catalogFilterAllStock}</SelectItem>
                  <SelectItem value="in">{t.catalogFilterInStock}</SelectItem>
                  <SelectItem value="out">{t.catalogFilterOutOfStock}</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={sortBy}
                onValueChange={(value) => setSortBy(value as CatalogSort)}
              >
                <SelectTrigger
                  id="catalog-sort-mobile"
                  aria-label={t.catalogSort}
                  className="h-9 rounded-xl bg-muted/50 text-xs"
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
            <div className="hidden min-w-0 flex-1 grid-cols-3 gap-3 md:grid">
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
              <div className="grid gap-1.5">
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
            </div>
            <div
              className="inline-flex shrink-0 rounded-xl border border-border bg-background p-0.5 md:p-1"
              role="group"
              aria-label={t.catalogViewGrid}
            >
              <Button
                type="button"
                variant={viewMode === "grid" ? "default" : "ghost"}
                size="icon"
                className="size-8 rounded-lg md:size-10"
                aria-pressed={viewMode === "grid"}
                aria-label={t.catalogViewGrid}
                title={t.catalogViewGrid}
                onClick={() => setCatalogView("grid")}
              >
                <SquaresFourIcon size={18} />
              </Button>
              <Button
                type="button"
                variant={viewMode === "list" ? "default" : "ghost"}
                size="icon"
                className="size-8 rounded-lg md:size-10"
                aria-pressed={viewMode === "list"}
                aria-label={t.catalogViewList}
                title={t.catalogViewList}
                onClick={() => setCatalogView("list")}
              >
                <ListIcon size={18} />
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
                ? "grid min-h-0 flex-1 auto-rows-min grid-cols-3 content-start gap-1.5 overflow-y-auto pb-2 sm:gap-2 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
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
                        ? `group relative flex h-full w-full flex-col items-stretch gap-0 overflow-hidden rounded-xl border-border/80 p-0 text-left whitespace-normal shadow-none transition-colors hover:border-primary/40 hover:bg-accent/40 md:rounded-2xl ${selectedQty > 0 ? "border-primary bg-accent/30 ring-1 ring-primary/20" : ""}`
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
                        className="absolute top-1 right-1 z-10 inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1 py-0.5 text-[10px] font-bold leading-none text-primary-foreground shadow-md md:top-2 md:right-2 md:min-w-8 md:px-2 md:py-1 md:text-sm"
                        aria-label={`${selectedQty} dipilih`}
                      >
                        {selectedQty}
                      </span>
                    ) : null}
                    <span
                      className={
                        viewMode === "list" ? "relative shrink-0" : "relative block"
                      }
                    >
                      <CatalogProductThumb
                        productId={p.productId}
                        alt=""
                        className={
                          viewMode === "list"
                            ? "aspect-square size-16 w-16 shrink-0 rounded-xl sm:size-[4.5rem] sm:w-[4.5rem]"
                            : "aspect-square rounded-none"
                        }
                      />
                      {viewMode === "grid" ? (
                        <span className="absolute bottom-1 left-1 rounded bg-black/65 px-1 py-px text-[10px] font-medium text-white md:hidden">
                          {t.stock} {p.stockQty}
                        </span>
                      ) : null}
                    </span>
                    <span
                      className={
                        viewMode === "grid"
                          ? "flex min-w-0 flex-col gap-0.5 px-1.5 py-1.5 md:gap-1 md:px-3 md:pt-2 md:pb-2.5"
                          : "flex min-w-0 flex-1 flex-col gap-1 py-0.5"
                      }
                    >
                      <span
                        className={
                          viewMode === "grid"
                            ? "line-clamp-2 text-[11px] leading-tight font-semibold tracking-tight text-foreground md:truncate md:text-base"
                            : "truncate text-base font-semibold tracking-tight text-foreground"
                        }
                      >
                        {p.name}
                      </span>
                      <span
                        className={
                          viewMode === "grid"
                            ? "flex flex-col gap-0.5 text-[11px] md:flex-row md:flex-wrap md:items-center md:gap-x-2 md:gap-y-1 md:text-sm"
                            : "flex flex-wrap items-center gap-x-2 gap-y-1 text-sm"
                        }
                      >
                        {p.unitName ? (
                          <span className="hidden rounded-md bg-secondary px-1.5 py-0.5 text-xs font-medium text-secondary-foreground md:inline-flex">
                            {p.unitName}
                          </span>
                        ) : null}
                        <span className="font-semibold text-primary md:font-medium md:text-foreground">
                          {priceLabel}
                        </span>
                        <span className="hidden text-muted-foreground md:inline">
                          {t.stock}: {p.stockQty}
                        </span>
                        {unpackable ? (
                          <span className="rounded-md bg-primary/10 px-1 py-px text-[10px] font-medium text-primary md:px-1.5 md:py-0.5 md:text-xs">
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
          <div className="mt-auto flex w-full shrink-0 flex-wrap items-center justify-between gap-2 border-t border-border pt-2 md:gap-3 md:pt-3">
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
                className="min-h-9 rounded-xl px-3 md:min-h-11"
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
                className="min-h-9 rounded-xl px-3 md:min-h-11"
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
