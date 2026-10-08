import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useStore } from "zustand";
import { CART_BAR_HEIGHT } from "@/components/layout/AppShell";
import {
  ArchiveTrayIcon,
  BottomSheet,
  Button,
  CaretDownIcon,
  CaretUpIcon,
  Card,
  MinusIcon,
  PlusIcon,
  SegmentedControl,
  ShoppingCartIcon,
  Text,
  TextField,
  TrashSimpleIcon,
  XIcon,
} from "@/components/ui";
import { useContainer } from "@/core/di/container-context";
import { cartItemCount } from "@/features/cart/domain/cart";
import { useCheckout } from "@/features/checkout/presentation/useCheckout";
import type { Layout } from "@/hooks/useBreakpoint";
import { useT } from "@/i18n";
import { radius, useTheme } from "@/theme";
import { cashPresets, formatGroupedInt, formatGroupedIntInput, formatIdr, parseGroupedInt } from "@/utils/money";
import { ParkedCartsDialog } from "./ParkedCartsDialog";
import { ReceiptPreviewDialog } from "./ReceiptPreviewDialog";

/** Bottom nav height on phones (icon 36 + label + padding), kept in sync with AppShell. */
const BOTTOM_NAV = 64;

/**
 * The cart + pay step. Tablet/wide: a card beside the catalog. Phone: a collapsed bar above the
 * bottom nav that expands into a sheet (PWA mobile cart panel). Same body in both.
 */
export function CartPanel({ layout }: { layout: Layout }) {
  const container = useContainer();
  const { colors } = useTheme();
  const { t, lang } = useT();
  const insets = useSafeAreaInsets();
  const c = useCheckout();
  const open = useStore(container.cartUi, (s) => s.open);
  const [parkedOpen, setParkedOpen] = useState(false);
  const itemCount = cartItemCount({ lines: c.cart.lines });

  // Show the pay step / receipt immediately on phones.
  useEffect(() => {
    if (c.cart.paying) container.cartUi.getState().set(true);
  }, [c.cart.paying, container]);

  const parkedButton =
    c.parked.length > 0 ? (
      <Button
        variant="outline"
        size="icon"
        accessibilityLabel={`${t("parked")}: ${c.parked.length}`}
        icon={<ArchiveTrayIcon size={19} weight="duotone" color={colors.foreground} />}
        onPress={() => setParkedOpen(true)}
      >
        <View style={[styles.badge, { backgroundColor: colors.primary }]}>
          <Text size={11} weight="bold" color={colors.primaryForeground}>{c.parked.length > 99 ? "99+" : c.parked.length}</Text>
        </View>
      </Button>
    ) : null;

  const dialogs = (
    <>
      <ReceiptPreviewDialog sale={c.completed?.sale ?? null} customerName={c.completed?.name ?? null} onClose={c.clearCompleted} />
      <ParkedCartsDialog
        open={parkedOpen && c.parked.length > 0}
        carts={c.parked}
        busy={c.busy}
        onClose={() => setParkedOpen(false)}
        onResume={(id) => {
          if (c.resume(id)) {
            setParkedOpen(false);
            container.cartUi.getState().set(true);
          }
        }}
        onDiscard={c.discard}
      />
    </>
  );

  if (layout !== "phone") {
    return (
      <Card padded={false} style={styles.sideCard}>
        <View style={[styles.sideHeader, { borderBottomColor: colors.border }]}>
          <View style={styles.titleRow}>
            <ShoppingCartIcon size={22} weight="duotone" color={colors.primary} />
            <Text size={18} weight="semibold">{t("cart")}</Text>
          </View>
          {parkedButton}
        </View>
        <CartBody c={c} />
        {dialogs}
      </Card>
    );
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={open ? t("cartCollapse") : t("cartExpand")}
        onPress={() => container.cartUi.getState().toggle()}
        style={[
          styles.bar,
          { bottom: BOTTOM_NAV + Math.max(insets.bottom, 6), height: CART_BAR_HEIGHT, backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <View style={[styles.cartIcon, { backgroundColor: `${colors.primary}1a` }]}>
          <ShoppingCartIcon size={20} weight="duotone" color={colors.primary} />
          {itemCount > 0 ? (
            <View style={[styles.badge, { backgroundColor: colors.primary }]}>
              <Text size={10} weight="bold" color={colors.primaryForeground}>{itemCount > 99 ? "99+" : itemCount}</Text>
            </View>
          ) : null}
        </View>
        <View style={{ flex: 1 }}>
          <Text weight="semibold" numberOfLines={1}>{t("cart")}</Text>
          <Text size={12} muted numberOfLines={1}>{itemCount > 0 ? t("cartItemCount", { count: itemCount }) : t("cartEmpty")}</Text>
        </View>
        {itemCount > 0 ? <Text weight="semibold" tabular>{formatIdr(c.pricing.payableMinor, lang)}</Text> : null}
        <CaretUpIcon size={18} weight="bold" color={colors.mutedForeground} />
      </Pressable>
      <BottomSheet
        open={open}
        onClose={() => container.cartUi.getState().set(false)}
        maxHeightRatio={0.92}
        noScroll
        locked={c.busy}
      >
        <View style={[styles.sheetHeader, { borderBottomColor: colors.border }]}>
          <View style={styles.titleRow}>
            <ShoppingCartIcon size={22} weight="duotone" color={colors.primary} />
            <Text size={18} weight="semibold">{t("cart")}</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {parkedButton}
            <Button variant="ghost" size="iconSm" accessibilityLabel={t("cartCollapse")} icon={<CaretDownIcon size={18} weight="bold" color={colors.mutedForeground} />} onPress={() => container.cartUi.getState().set(false)} />
          </View>
        </View>
        <CartBody c={c} />
      </BottomSheet>
      {dialogs}
    </>
  );
}

type Checkout = ReturnType<typeof useCheckout>;

function CartBody({ c }: { c: Checkout }) {
  const { colors } = useTheme();
  const { t, lang } = useT();
  const { cart, pricing } = c;
  const empty = cart.lines.length === 0;

  return (
    <View style={styles.body}>
      {c.error ? (
        <View accessibilityRole="alert" style={[styles.alert, { borderColor: `${colors.destructive}4d`, backgroundColor: `${colors.destructive}1a` }]}>
          <Text size={14} color={colors.destructive}>{c.error}</Text>
        </View>
      ) : null}

      {cart.paying ? (
        <PaySection c={c} />
      ) : (
        <>
          <View style={styles.nameBlock}>
            <Text weight="medium" style={{ marginBottom: 6 }}>{t("receiptName")}</Text>
            <TextField
              value={cart.guestName}
              onChangeText={(v) => cart.set({ guestName: v })}
              placeholder={t("receiptNamePh")}
              maxLength={80}
              autoComplete="name"
              editable={!c.busy}
              right={
                cart.guestName ? (
                  <Button variant="ghost" size="iconSm" accessibilityLabel={t("receiptNameClear")} icon={<XIcon size={16} weight="bold" color={colors.mutedForeground} />} onPress={() => cart.set({ guestName: "" })} />
                ) : undefined
              }
              hint={t("receiptNameHint")}
            />
          </View>
          <ScrollView style={styles.fill} contentContainerStyle={empty ? styles.emptyWrap : styles.lines} keyboardShouldPersistTaps="handled">
            {empty ? (
              <View style={styles.empty}>
                <ShoppingCartIcon size={40} weight="duotone" color={`${colors.mutedForeground}80`} />
                <Text muted>{t("cartEmpty")}</Text>
              </View>
            ) : (
              cart.lines.map((line) => (
                <View key={line.productId} style={[styles.line, { borderBottomColor: colors.border }]}>
                  <Text weight="medium" numberOfLines={2}>{line.name}</Text>
                  <View style={styles.lineRow}>
                    <Text size={14} style={{ flex: 1 }} tabular>
                      {formatIdr(line.priceMinor, lang)} × {line.qty} = {formatIdr(line.priceMinor * line.qty, lang)}
                    </Text>
                    <View style={styles.stepper}>
                      <Button variant="outline" size="iconSm" accessibilityLabel={`${t("qtyDown")} ${line.name}`} icon={<MinusIcon size={16} weight="bold" color={colors.foreground} />} onPress={() => cart.setQty(line.productId, line.qty - 1)} />
                      <Text weight="semibold" tabular style={{ minWidth: 24, textAlign: "center" }}>{line.qty}</Text>
                      <Button
                        variant="outline"
                        size="iconSm"
                        accessibilityLabel={`${t("qtyUp")} ${line.name}`}
                        disabled={line.maxQty !== null && line.qty >= line.maxQty}
                        icon={<PlusIcon size={16} weight="bold" color={colors.foreground} />}
                        onPress={() => cart.setQty(line.productId, line.qty + 1)}
                      />
                      <Button variant="ghost" size="iconSm" accessibilityLabel={`${t("removeLine")} ${line.name}`} icon={<TrashSimpleIcon size={16} weight="bold" color={colors.destructive} />} onPress={() => cart.setQty(line.productId, 0)} />
                    </View>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
          {empty ? null : (
            <View style={[styles.footer, { borderTopColor: colors.border }]}>
              <View style={styles.totalRow}>
                <Text size={16} weight="semibold">{t("total")}</Text>
                <Text size={18} weight="bold" tabular>{formatIdr(pricing.payableMinor, lang)}</Text>
              </View>
              {!c.hasShift ? <Text size={13} color={colors.warning}>{t("shiftNeedOpen")}</Text> : null}
              <Button size="lg" label={c.busy ? t("pending") : t("pay")} loading={c.busy} disabled={!c.hasShift} onPress={c.startPay} />
              <Button variant="outline" size="lg" label={t("hold")} icon={<ArchiveTrayIcon size={18} weight="duotone" color={colors.foreground} />} disabled={c.busy} onPress={c.hold} />
            </View>
          )}
        </>
      )}
    </View>
  );
}

function PaySection({ c }: { c: Checkout }) {
  const { colors } = useTheme();
  const { t, lang } = useT();
  const { cart, pricing, cash } = c;
  const qris = cart.payMethod === "qris";
  const received = parseGroupedInt(cart.cashReceived);
  const presets = cashPresets(pricing.payableMinor);
  const activePreset = presets.find((amount) => received === amount);
  const presetRows = [presets.slice(0, 2), presets.slice(2)].filter((row) => row.length > 0);

  return (
    <View style={styles.fill}>
      <View style={[styles.payHeader, { borderBottomColor: colors.border }]}>
        <Text weight="medium">
          {qris ? t("qrisPayment") : t("cashPayment")} {formatIdr(pricing.payableMinor, lang)}
        </Text>
        {pricing.payableMinor > 0 ? (
          <SegmentedControl
            value={cart.payMethod}
            disabled={c.busy}
            onChange={(method) => cart.set({ payMethod: method, ...(method === "qris" ? { cashReceived: "" } : {}) })}
            segments={[
              { value: "cash", label: t("cashTender") },
              { value: "qris", label: t("qris") },
            ]}
          />
        ) : null}
      </View>
      <ScrollView style={styles.fill} contentContainerStyle={styles.lines} keyboardShouldPersistTaps="handled">
        {!qris && pricing.payableMinor > 0 ? (
          <View style={[styles.cashCard, { borderColor: colors.border, backgroundColor: `${colors.muted}4d` }]}>
            <View style={styles.totalRow}>
              <Text weight="medium">{t("cashReceived")}</Text>
              <Text size={12} muted>
                {t("total")} {formatIdr(pricing.payableMinor, lang)}
              </Text>
            </View>
            <View style={{ gap: 8 }}>
              {presetRows.map((row) => (
                <View key={row[0]} style={styles.presetRow}>
                  {row.map((amount) => (
                    <Button
                      key={amount}
                      variant={activePreset === amount ? "default" : "secondary"}
                      label={formatGroupedInt(amount, lang)}
                      accessibilityLabel={`${t("cashReceived")} ${formatIdr(amount, lang)}`}
                      disabled={c.busy}
                      onPress={() => cart.set({ cashReceived: formatGroupedInt(amount, lang) })}
                      style={styles.preset}
                    />
                  ))}
                  {row.length === 1 ? <View style={styles.preset} /> : null}
                </View>
              ))}
            </View>
            <TextField
              value={cart.cashReceived}
              onChangeText={(v) => cart.set({ cashReceived: formatGroupedIntInput(v, lang) })}
              keyboardType="number-pad"
              accessibilityLabel={t("cashReceived")}
              placeholder="0"
              editable={!c.busy}
              left={<Text size={14} weight="medium" muted>Rp</Text>}
              style={styles.cashInput}
            />
            <View
              style={[
                styles.cashStatus,
                { backgroundColor: c.cashShort ? `${colors.destructive}1a` : `${colors.primary}1a` },
              ]}
            >
              <Text weight="medium" color={c.cashShort ? colors.destructive : colors.primary}>
                {c.cashShort ? t("cashShortLabel") : t("cashChange")}
              </Text>
              <Text size={16} weight="semibold" color={c.cashShort ? colors.destructive : colors.primary} tabular>
                {formatIdr(c.cashShort ? cash.shortMinor : cash.changeMinor, lang)}
              </Text>
            </View>
          </View>
        ) : null}
      </ScrollView>
      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <Text size={13} muted>{t("receiptHint")}</Text>
        <Button size="lg" label={c.busy ? t("pending") : t("confirmReceipt")} loading={c.busy} disabled={c.cashShort} onPress={() => void c.confirm()} />
        <Button variant="ghost" size="lg" label={t("cancelCheckout")} disabled={c.busy} onPress={c.cancelPay} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sideCard: { flex: 1, overflow: "hidden" },
  sideHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  bar: { position: "absolute", left: 12, right: 12, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, borderWidth: 1, borderRadius: radius.xl, shadowColor: "#101828", shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  cartIcon: { width: 36, height: 36, borderRadius: radius.lg, alignItems: "center", justifyContent: "center" },
  badge: { position: "absolute", top: -6, right: -6, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  body: { flex: 1, minHeight: 0 },
  fill: { flex: 1 },
  alert: { marginHorizontal: 16, marginTop: 12, borderWidth: 1, borderRadius: radius.xl, paddingHorizontal: 12, paddingVertical: 8 },
  nameBlock: { paddingHorizontal: 16, paddingTop: 16 },
  lines: { padding: 16, gap: 12 },
  emptyWrap: { flexGrow: 1, justifyContent: "center" },
  empty: { alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 24 },
  line: { gap: 8, borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: 12 },
  lineRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  stepper: { flexDirection: "row", alignItems: "center", gap: 4 },
  footer: { padding: 16, gap: 8, borderTopWidth: StyleSheet.hairlineWidth },
  totalRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  payHeader: { gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  cashCard: { gap: 12, borderWidth: 1, borderRadius: radius.xl, padding: 12 },
  presetRow: { flexDirection: "row", gap: 8 },
  preset: { flex: 1 },
  cashInput: { textAlign: "right", fontSize: 18 },
  cashStatus: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, borderRadius: radius.lg, paddingHorizontal: 12, paddingVertical: 8 },
});
