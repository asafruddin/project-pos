import { Pressable, View } from "react-native";
import { BottomSheet, Button, Select, Text } from "@/components/ui";
import type { CatalogFilters, CatalogSort, StockFilter } from "@/features/catalog/domain/catalog-view";
import { useT } from "@/i18n";
import { radius, useTheme } from "@/theme";

export function CatalogFilterSheet({
  open,
  onClose,
  filters,
  categories,
  onChange,
  onClear,
}: {
  open: boolean;
  onClose: () => void;
  filters: CatalogFilters;
  categories: string[];
  onChange: (patch: Partial<CatalogFilters>) => void;
  onClear: () => void;
}) {
  const { t } = useT();
  const { colors } = useTheme();
  const chip = (label: string, active: boolean, onPress: () => void) => (
    <Pressable
      key={label || "all"}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={{
        minHeight: 36,
        maxWidth: 200,
        paddingHorizontal: 14,
        borderRadius: radius.full,
        borderWidth: 1,
        borderColor: active ? colors.primary : colors.border,
        backgroundColor: active ? colors.primary : colors.card,
        justifyContent: "center",
      }}
    >
      <Text size={14} weight="medium" numberOfLines={1} color={active ? colors.primaryForeground : colors.foreground}>{label}</Text>
    </Pressable>
  );
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t("catalogFilters")}
      maxHeightRatio={0.8}
      footer={
        <>
          <Button variant="secondary" label={t("catalogClearFilters")} onPress={onClear} style={{ flex: 1 }} />
          <Button label={t("catalogFilterDone")} onPress={onClose} style={{ flex: 1 }} />
        </>
      }
    >
      <View style={{ gap: 8 }}>
        <Text weight="medium">{t("catalogFilterCategory")}</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {chip(t("catalogFilterAllCategories"), filters.category === "", () => onChange({ category: "" }))}
          {categories.map((name) => chip(name, filters.category === name, () => onChange({ category: name })))}
        </View>
      </View>
      <Select<StockFilter>
        label={t("catalogFilterStock")}
        value={filters.stock}
        onChange={(stock) => onChange({ stock })}
        options={[
          { value: "all", label: t("catalogFilterAllStock") },
          { value: "in", label: t("catalogFilterInStock") },
          { value: "out", label: t("catalogFilterOutOfStock") },
        ]}
      />
      <Select<CatalogSort>
        label={t("catalogSort")}
        value={filters.sort}
        onChange={(sort) => onChange({ sort })}
        options={[
          { value: "name-asc", label: t("catalogSortNameAsc") },
          { value: "name-desc", label: t("catalogSortNameDesc") },
          { value: "price-asc", label: t("catalogSortPriceAsc") },
          { value: "price-desc", label: t("catalogSortPriceDesc") },
          { value: "stock-desc", label: t("catalogSortStockDesc") },
        ]}
      />
    </BottomSheet>
  );
}
