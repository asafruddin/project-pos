import { Pressable, StyleSheet, View } from "react-native";
import { BottomSheet, Text } from "@/components/ui";
import { isValidSellablePrice, tracksStock, type CatalogProduct } from "@/features/catalog/domain/product";
import { variantDisplayLabel } from "@/features/catalog/domain/variants";
import { useT } from "@/i18n";
import { radius, useTheme } from "@/theme";
import { formatIdr } from "@/utils/money";

export type VariantSheetProps = {
  open: boolean;
  /** Kept while the sheet animates closed. */
  parent: CatalogProduct | null;
  variants: CatalogProduct[];
  /** productId → qty already in the cart. */
  quantities: Map<string, number>;
  onPick: (variant: CatalogProduct) => void;
  onClose: () => void;
};

/** Bottom sheet listing a product's variants; picking one adds it to the cart. */
export function VariantSheet({ open, parent, variants, quantities, onPick, onClose }: VariantSheetProps) {
  const { colors } = useTheme();
  const { t, lang } = useT();

  return (
    <BottomSheet open={open && Boolean(parent)} onClose={onClose} title={parent?.name} description={t("variantChoose")}>
      <View style={styles.list}>
        {parent
          ? variants.map((v) => {
              const unlimited = !tracksStock(v);
              const available = isValidSellablePrice(v.priceMinor) && (unlimited || v.stockQty > 0);
              const inCart = quantities.get(v.productId) ?? 0;
              const label = variantDisplayLabel(v, parent);
              const stockLabel = !available ? t("stockOut") : unlimited ? t("stockUnlimited") : `${t("stock")} ${v.stockQty}`;
              return (
                <Pressable
                  key={v.productId}
                  accessibilityRole="button"
                  accessibilityLabel={`${label}, ${formatIdr(v.priceMinor, lang)}, ${stockLabel}`}
                  accessibilityState={{ disabled: !available }}
                  disabled={!available}
                  onPress={() => onPick(v)}
                  style={({ pressed }) => [
                    styles.row,
                    { borderColor: inCart > 0 ? colors.primary : colors.border, backgroundColor: pressed ? colors.accent : colors.card, opacity: available ? 1 : 0.5 },
                  ]}
                >
                  <View style={styles.info}>
                    <Text size={16} weight="semibold" numberOfLines={1}>{label}</Text>
                    <Text size={12} muted>{stockLabel}</Text>
                  </View>
                  {inCart > 0 ? (
                    <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                      <Text size={12} weight="bold" color={colors.primaryForeground}>{inCart}</Text>
                    </View>
                  ) : null}
                  <Text weight="semibold" color={colors.primary}>{formatIdr(v.priceMinor, lang)}</Text>
                </Pressable>
              );
            })
          : null}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  list: { gap: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderWidth: 1, borderRadius: radius.xl },
  info: { flex: 1, gap: 2 },
  badge: { minWidth: 22, height: 22, paddingHorizontal: 6, borderRadius: 11, alignItems: "center", justifyContent: "center" },
});
