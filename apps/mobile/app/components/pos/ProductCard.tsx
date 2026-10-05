import { memo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "@/components/ui";
import { isValidSellablePrice, tracksStock, type CatalogProduct } from "@/features/catalog/domain/product";
import { useT } from "@/i18n";
import { radius, useTheme } from "@/theme";
import { formatIdr } from "@/utils/money";
import { ProductThumb } from "./ProductThumb";

export type ProductCardProps = {
  product: CatalogProduct;
  view: "grid" | "list";
  selectedQty: number;
  imageUri?: string | null;
  /** Out-of-stock pack product that can be opened into pieces (online). */
  unpackable: boolean;
  onPress: (product: CatalogProduct) => void;
};

/** Menu tile in grid or list form (PWA catalog button), memoised for long lists. */
export const ProductCard = memo(function ProductCard({ product, view, selectedQty, imageUri, unpackable, onPress }: ProductCardProps) {
  const { colors } = useTheme();
  const { t, lang } = useT();
  const priceOk = isValidSellablePrice(product.priceMinor);
  const unlimited = !tracksStock(product);
  const inStock = priceOk && (unlimited || product.stockQty > 0);
  const clickable = inStock || unpackable;
  const stockLabel = unlimited ? t("stockUnlimited") : `${t("stock")} ${product.stockQty}`;
  const priceLabel = clickable ? formatIdr(product.priceMinor, lang) : product.stockQty <= 0 ? t("stockOut") : t("catalogBlockedPrice");
  const selected = selectedQty > 0;
  const border = selected ? colors.primary : colors.border;
  const bg = selected ? `${colors.accent}` : colors.card;

  const badge = selected ? (
    <View style={[styles.badge, { backgroundColor: colors.primary }]} accessibilityLabel={`${selectedQty}`}>
      <Text size={12} weight="bold" color={colors.primaryForeground}>{selectedQty}</Text>
    </View>
  ) : null;
  const unpackTag = unpackable ? (
    <View style={[styles.tag, { backgroundColor: `${colors.primary}1a` }]}>
      <Text size={10} weight="medium" color={colors.primary}>{t("unpackTitle")}</Text>
    </View>
  ) : null;

  if (view === "list") {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${product.name}, ${priceLabel}, ${stockLabel}`}
        accessibilityState={{ disabled: !clickable }}
        disabled={!clickable}
        onPress={() => onPress(product)}
        style={({ pressed }) => [styles.listRow, { borderColor: border, backgroundColor: pressed ? colors.accent : bg, opacity: clickable ? 1 : 0.55 }]}
      >
        <ProductThumb uri={imageUri} size={64} style={{ borderRadius: radius.lg }} />
        <View style={styles.listBody}>
          <Text size={16} weight="semibold" numberOfLines={1}>{product.name}</Text>
          <View style={styles.meta}>
            {product.unitName ? (
              <View style={[styles.tag, { backgroundColor: colors.secondary }]}><Text size={12} weight="medium" color={colors.secondaryForeground}>{product.unitName}</Text></View>
            ) : null}
            <Text weight="medium" color={colors.primary}>{priceLabel}</Text>
            <Text muted>{stockLabel}</Text>
            {unpackTag}
          </View>
        </View>
        {badge}
      </Pressable>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${product.name}, ${priceLabel}, ${stockLabel}`}
      accessibilityState={{ disabled: !clickable }}
      disabled={!clickable}
      onPress={() => onPress(product)}
      style={({ pressed }) => [styles.card, { borderColor: border, backgroundColor: pressed ? colors.accent : bg, opacity: clickable ? 1 : 0.55 }]}
    >
      <View>
        <ProductThumb uri={imageUri} />
        <View style={styles.stockChip}><Text size={10} weight="medium" color="#fff">{stockLabel}</Text></View>
        {badge}
      </View>
      <View style={styles.cardBody}>
        <Text size={13} weight="semibold" numberOfLines={2} style={{ minHeight: 36 }}>{product.name}</Text>
        <View style={styles.meta}>
          <Text size={13} weight="semibold" color={colors.primary}>{priceLabel}</Text>
          {unpackTag}
        </View>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: { flex: 1, borderWidth: 1, borderRadius: radius.xl, overflow: "hidden" },
  cardBody: { padding: 8, gap: 2 },
  listRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 10, borderWidth: 1, borderRadius: radius.xl },
  listBody: { flex: 1, gap: 4 },
  meta: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 },
  badge: { position: "absolute", top: 6, right: 6, minWidth: 22, height: 22, paddingHorizontal: 6, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  stockChip: { position: "absolute", left: 4, bottom: 4, borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1, backgroundColor: "rgba(0,0,0,0.65)" },
  tag: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
});
