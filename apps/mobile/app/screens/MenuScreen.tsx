import { useCallback, useMemo, useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { useStore } from "zustand";
import { CartPanel } from "@/components/pos/CartPanel";
import { CatalogFilterSheet } from "@/components/pos/CatalogFilterSheet";
import { ProductCard } from "@/components/pos/ProductCard";
import { UnpackDialog } from "@/components/pos/UnpackDialog";
import { AppShell, SyncBadge } from "@/components/layout";
import {
  ArrowsClockwiseIcon,
  Button,
  CloudArrowDownIcon,
  FunnelIcon,
  ListIcon,
  MagnifyingGlassIcon,
  SegmentedControl,
  SquaresFourIcon,
  Text,
  TextField,
} from "@/components/ui";
import { useContainer, usePrefs } from "@/core/di/container-context";
import { isAppError } from "@/core/errors/app-error";
import {
  activeFilterCount,
  categoriesOf,
  defaultFilters,
  filterAndSort,
  paginate,
  type CatalogFilters,
} from "@/features/catalog/domain/catalog-view";
import { canOfferUnpack, tracksStock, withLivePackStock, type CatalogProduct } from "@/features/catalog/domain/product";
import { useImageUris } from "@/hooks/useImageUris";
import { useLayout } from "@/hooks/useBreakpoint";
import { useOnline } from "@/hooks/useOnline";
import { useT } from "@/i18n";
import { radius, useTheme } from "@/theme";

const GRID_GAP = 8;
const MIN_TILE = 150;

/** Catalog: search, filters, grid/list, pages, pull + unpack; the cart lives beside (tablet) or below (phone). */
export default function MenuScreen() {
  const container = useContainer();
  const { colors } = useTheme();
  const { t, lang } = useT();
  const prefs = usePrefs();
  const online = useOnline();
  const { layout } = useLayout();
  const imageUris = useImageUris();
  const pulledAt = useStore(container.catalogEvents, (s) => s.pulledAt);
  const lines = useStore(container.cart, (s) => s.lines);
  // Re-read after pulls and after every sale/void (stock changed).
  const catalogVersion = useStore(container.catalogEvents, (s) => `${s.pulledAt}.${s.imagesVersion}`);
  const salesVersion = useStore(container.events, (s) => s.sales);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const products = useMemo(() => withLivePackStock(container.repositories.catalog.listSellable()), [container, catalogVersion, salesVersion]);

  const [filters, setFilters] = useState<CatalogFilters>(() => defaultFilters(prefs.lang));
  const [page, setPage] = useState(1);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [pullError, setPullError] = useState<string | null>(null);
  const [unpackTarget, setUnpackTarget] = useState<CatalogProduct | null>(null);
  const [unpackBusy, setUnpackBusy] = useState(false);
  const [unpackError, setUnpackError] = useState<string | null>(null);
  const [gridWidth, setGridWidth] = useState(0);

  const effective = { ...filters, lang };
  const categories = useMemo(() => categoriesOf(products, lang), [products, lang]);
  const visible = useMemo(() => filterAndSort(products, effective), [products, filters, lang]); // eslint-disable-line react-hooks/exhaustive-deps
  const { rows, page: safePage, totalPages } = paginate(visible, page);
  const qtyById = useMemo(() => new Map(lines.map((l) => [l.productId, l.qty])), [lines]);
  const view = prefs.catalogView;
  const cols = view === "grid" ? Math.max(2, Math.floor((gridWidth + GRID_GAP) / (MIN_TILE + GRID_GAP))) : 1;
  const filterCount = activeFilterCount(filters);

  const patch = useCallback((p: Partial<CatalogFilters>) => {
    setFilters((f) => ({ ...f, ...p }));
    setPage(1);
  }, []);

  async function pullCatalog() {
    setPullError(null);
    if (!online) return setPullError(t("catalogOffline"));
    if (!container.auth.getState().session?.accessToken) return setPullError(t("catalogNeedLogin"));
    setPulling(true);
    try {
      await container.pullCatalogNow();
    } catch (e) {
      if (!(isAppError(e) && (e.code === "AUTH_UNAUTHORIZED" || e.code === "AUTH_SESSION_EXPIRED"))) {
        setPullError(isAppError(e) && e.code === "API" && e.message ? e.message : t("catalogPullFail"));
      }
    } finally {
      setPulling(false);
    }
  }

  const onPressProduct = useCallback(
    (p: CatalogProduct) => {
      const unlimited = !tracksStock(p);
      if (unlimited || p.stockQty > 0) {
        container.cart.getState().add(p);
        return;
      }
      if (canOfferUnpack(p, container.isOnline(), container.repositories.catalog.listSellable())) {
        setUnpackError(null);
        setUnpackTarget(p);
      }
    },
    [container],
  );

  async function confirmUnpack() {
    if (!unpackTarget || unpackBusy) return;
    setUnpackBusy(true);
    setUnpackError(null);
    try {
      const updated = await container.useCases.unpack.execute(unpackTarget);
      const cart = container.cart.getState();
      cart.raiseStockCap(updated.productId, updated.stockQty);
      cart.add(updated);
      container.catalogEvents.setState((s) => ({ ...s, imagesVersion: s.imagesVersion + 1 }));
      setUnpackTarget(null);
    } catch (e) {
      setUnpackError(isAppError(e) && e.code === "API" && e.message ? e.message : t("unpackFail"));
    } finally {
      setUnpackBusy(false);
    }
  }

  const subtitle = `${t("menuLocalOnly")}${pulledAt ? ` · ${t("catalogPulled")}: ${new Date(pulledAt).toLocaleString(lang === "en" ? "en-US" : "id-ID")}` : ""}`;

  const pullButton = (
    <Button
      size={layout === "wide" ? "default" : "iconSm"}
      accessibilityLabel={pulling ? t("catalogPulling") : t("catalogPull")}
      disabled={pulling || !online}
      onPress={pullCatalog}
      icon={
        pulling ? <ArrowsClockwiseIcon size={16} weight="bold" color={colors.primaryForeground} /> : <CloudArrowDownIcon size={16} weight="bold" color={colors.primaryForeground} />
      }
      label={layout === "wide" ? (pulling ? t("catalogPulling") : t("catalogPull")) : undefined}
    />
  );

  return (
    <AppShell title={t("menuTitle")} subtitle={subtitle} headerActions={pullButton} aside={(l) => <CartPanel layout={l} />} bare scroll={false}>
      <View style={styles.fill}>
        <View style={[styles.toolbar, { borderBottomColor: colors.border }]}>
          <View style={styles.statusRow}>
            <SyncBadge />
            {pullError ? <Text size={13} color={colors.destructive} accessibilityRole="alert" style={{ flex: 1 }}>{pullError}</Text> : null}
          </View>
          {products.length > 0 ? (
            <View style={styles.searchRow}>
              <View style={{ flex: 1 }}>
                <TextField
                  value={filters.query}
                  onChangeText={(query) => patch({ query })}
                  placeholder={t("catalogSearchPlaceholder")}
                  accessibilityLabel={t("catalogSearch")}
                  autoCorrect={false}
                  returnKeyType="search"
                  left={<MagnifyingGlassIcon size={18} color={colors.mutedForeground} />}
                />
              </View>
              <Button
                variant={filterCount ? "default" : "outline"}
                accessibilityLabel={t("catalogFilters")}
                icon={<FunnelIcon size={18} weight={filterCount ? "fill" : "regular"} color={filterCount ? colors.primaryForeground : colors.foreground} />}
                label={filterCount ? `(${filterCount})` : undefined}
                onPress={() => setSheetOpen(true)}
              />
              <SegmentedControl
                compact
                value={view}
                onChange={(v) => prefs.setCatalogView(v)}
                segments={[
                  { value: "grid", accessibilityLabel: t("catalogViewGrid"), icon: (c) => <SquaresFourIcon size={18} color={c} /> },
                  { value: "list", accessibilityLabel: t("catalogViewList"), icon: (c) => <ListIcon size={18} color={c} /> },
                ]}
              />
            </View>
          ) : null}
        </View>

        {products.length === 0 ? (
          <Empty text={t("catalogEmpty")} sub={!online ? t("catalogEmptyOffline") : undefined} />
        ) : visible.length === 0 ? (
          <Empty
            text={t("catalogNoMatches")}
            action={<Button variant="secondary" label={t("catalogClearFilters")} onPress={() => { setFilters(defaultFilters(lang)); setPage(1); }} />}
          />
        ) : (
          <View style={styles.fill} onLayout={(e) => setGridWidth(e.nativeEvent.layout.width - 24)}>
            <FlatList
              key={`${view}-${cols}`}
              data={rows}
              numColumns={cols}
              keyExtractor={(p) => p.productId}
              columnWrapperStyle={cols > 1 ? { gap: GRID_GAP } : undefined}
              contentContainerStyle={{ padding: 12, gap: GRID_GAP }}
              keyboardShouldPersistTaps="handled"
              initialNumToRender={12}
              windowSize={7}
              renderItem={({ item }) => (
                <View style={cols > 1 ? styles.cell : undefined}>
                  <ProductCard
                    product={item}
                    view={view}
                    selectedQty={qtyById.get(item.productId) ?? 0}
                    imageUri={imageUris.get(item.productId)}
                    unpackable={canOfferUnpack(item, online, products) && tracksStock(item) && item.stockQty <= 0}
                    onPress={onPressProduct}
                  />
                </View>
              )}
              ListFooterComponent={
                totalPages > 1 ? (
                  <View style={[styles.pager, { borderTopColor: colors.border }]}>
                    <Button variant="secondary" size="sm" label={t("catalogPagePrev")} disabled={safePage <= 1} onPress={() => setPage(safePage - 1)} />
                    <Text size={13} muted>{t("catalogPageOf", { page: safePage, total: totalPages })}</Text>
                    <Button variant="secondary" size="sm" label={t("catalogPageNext")} disabled={safePage >= totalPages} onPress={() => setPage(safePage + 1)} />
                  </View>
                ) : null
              }
            />
          </View>
        )}
      </View>

      <CatalogFilterSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        filters={filters}
        categories={categories}
        onChange={patch}
        onClear={() => patch({ category: "", stock: "all", sort: "name-asc" })}
      />
      <UnpackDialog
        product={unpackTarget}
        busy={unpackBusy}
        error={unpackError}
        onCancel={() => {
          if (unpackBusy) return;
          setUnpackTarget(null);
          setUnpackError(null);
        }}
        onConfirm={confirmUnpack}
      />
    </AppShell>
  );
}

function Empty({ text, sub, action }: { text: string; sub?: string; action?: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.empty, { borderColor: colors.border, backgroundColor: `${colors.secondary}99` }]}>
      <Text muted style={{ textAlign: "center" }}>{text}</Text>
      {sub ? <Text size={13} muted style={{ textAlign: "center" }}>{sub}</Text> : null}
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  toolbar: { padding: 12, gap: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  cell: { flex: 1, maxWidth: "100%" },
  pager: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 12, marginTop: 4, borderTopWidth: 1 },
  empty: { flex: 1, margin: 12, borderWidth: 1, borderStyle: "dashed", borderRadius: radius.xl, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
});
