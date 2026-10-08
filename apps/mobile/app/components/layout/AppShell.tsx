import { useNavigation, useRoute } from "@react-navigation/native";
import { useState, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Button,
  CalendarCheckIcon,
  GearIcon,
  HouseIcon,
  MenuSheet,
  ReceiptIcon,
  ShoppingCartIcon,
  SignOutIcon,
  Text,
  UserCircleIcon,
  type MenuItem,
} from "@/components/ui";
import { useAuth, useContainer, useEventValue, usePrefs } from "@/core/di/container-context";
import { useLayout, type Layout } from "@/hooks/useBreakpoint";
import { useSignOut } from "@/hooks/useSignOut";
import { useT } from "@/i18n";
import type { AppNavigation, RootStackParamList } from "@/navigators/navigationTypes";
import { radius, useTheme } from "@/theme";
import { nextTheme } from "@/features/settings/domain/preferences";
import { cartItemCount } from "@/features/cart/domain/cart";
import { ROLE_LABELS, type Role } from "@pos-apps/types";
import { useStore } from "zustand";
import { ConnectivityBanner } from "./ConnectivityBanner";
import { OpenShiftDialog } from "./OpenShiftDialog";
import { PrefControls, themeIcon, themeLabel } from "./PrefControls";
import { PrinterIndicator } from "./PrinterBadge";
import { StoreLogo } from "./StoreLogo";

type NavItem = { route: keyof RootStackParamList; label: string; icon: (color: string, active: boolean) => ReactNode; bottom?: boolean };
type NavSection = { label: string; items: NavItem[] };

/** Routes where the open-shift dialog must not cover the screen (PWA: shift, day-close, settings). */
const NO_SHIFT_GATE: (keyof RootStackParamList)[] = ["Shift", "DayClose", "Settings"];

/** Height reserved for the collapsed cart bar on phones. */
export const CART_BAR_HEIGHT = 56;

export type AppShellProps = {
  title: string;
  subtitle?: ReactNode;
  headerActions?: ReactNode;
  children: ReactNode;
  /** Right-hand column (cart). Rendered as a side panel on tablet/wide; on phone the panel positions itself. */
  aside?: (layout: Layout) => ReactNode;
  /** Scroll the content card (default) or let the child manage its own scrolling. */
  scroll?: boolean;
  /** Extra bottom padding for content that scrolls under a floating bar. */
  bare?: boolean;
};

export function AppShell({ title, subtitle, headerActions, children, aside, scroll = true, bare }: AppShellProps) {
  const container = useContainer();
  const { colors } = useTheme();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const { layout } = useLayout();
  const navigation = useNavigation<AppNavigation>();
  const route = useRoute();
  const { session, logoUri } = useAuth();
  const prefs = usePrefs();
  const cartLines = useStore(container.cart, (s) => s.lines);
  const [menuOpen, setMenuOpen] = useState(false);
  const hasShift = useEventValue(["shift"], (c) => c.repositories.shifts.getOpen() !== null);

  const storeName = session?.storeName ?? "POS Apps";
  const roleLabel = session?.role && session.role in ROLE_LABELS ? ROLE_LABELS[session.role as Role] : t("brand");
  const initials = roleLabel.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
  const wide = layout === "wide";
  const showAside = Boolean(aside) && layout !== "phone";

  const sections: NavSection[] = [
    { label: t("navCashier"), items: [{ route: "Menu", label: t("menuTitle"), icon: (c, a) => <HouseIcon size={20} weight={a ? "fill" : "duotone"} color={c} />, bottom: true }] },
    { label: t("navSales"), items: [{ route: "Transactions", label: t("txTitle"), icon: (c, a) => <ReceiptIcon size={20} weight={a ? "fill" : "duotone"} color={c} />, bottom: true }] },
    {
      label: t("navStore"),
      items: [
        { route: "Customers", label: t("customerTitle"), icon: (c, a) => <UserCircleIcon size={20} weight={a ? "fill" : "duotone"} color={c} />, bottom: true },
        { route: "DayClose", label: t("dayClose"), icon: (c, a) => <CalendarCheckIcon size={20} weight={a ? "fill" : "duotone"} color={c} />, bottom: true },
        { route: "Settings", label: t("settings"), icon: (c, a) => <GearIcon size={20} weight={a ? "fill" : "duotone"} color={c} /> },
      ],
    },
  ];

  const go = (name: keyof RootStackParamList) => {
    if (route.name !== name) navigation.navigate(name);
  };
  const signOut = useSignOut();

  const menuItems: MenuItem[] = [
    {
      type: "item",
      key: "theme",
      label: `${t("theme")}: ${themeLabel(prefs.theme, t)}`,
      icon: themeIcon(prefs.theme, colors.foreground, 18),
      onPress: () => prefs.setTheme(nextTheme(prefs.theme)),
    },
    {
      type: "item",
      key: "lang",
      label: `${t("language")}: ${prefs.lang === "id" ? "Indonesia" : "English"}`,
      onPress: () => prefs.setLang(prefs.lang === "id" ? "en" : "id"),
    },
    { type: "item", key: "settings", label: t("settings"), icon: <GearIcon size={18} weight="duotone" color={colors.foreground} />, onPress: () => go("Settings") },
    { type: "separator", key: "sep" },
    { type: "item", key: "logout", label: t("logout"), destructive: true, icon: <SignOutIcon size={18} weight="bold" color={colors.destructive} />, onPress: signOut.request },
  ];

  const cartCount = cartItemCount({ lines: cartLines });
  const bottomItems = sections.flatMap((s) => s.items).filter((i) => i.bottom);
  const content = (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, bare && { padding: 0 }]}>{children}</View>
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={styles.row}>
        {wide ? (
          <View style={[styles.side, { backgroundColor: colors.card, borderColor: colors.border, paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.brand}>
              <StoreLogo uri={logoUri} />
              <View style={{ flex: 1 }}>
                <Text weight="semibold" numberOfLines={1}>{storeName}</Text>
                <Text size={12} muted numberOfLines={1}>{t("brand")}</Text>
              </View>
            </View>
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
              {sections.map((section) => (
                <View key={section.label} style={{ gap: 4, marginBottom: 16 }}>
                  <Text size={11} weight="semibold" muted style={styles.sectionLabel}>{section.label.toUpperCase()}</Text>
                  {section.items.map((item) => {
                    const active = route.name === item.route;
                    const fg = active ? colors.primaryForeground : colors.mutedForeground;
                    return (
                      <Pressable
                        key={item.route}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        onPress={() => go(item.route)}
                        style={({ pressed }) => [styles.navItem, { backgroundColor: active ? colors.primary : pressed ? colors.secondary : "transparent" }]}
                      >
                        {item.icon(fg, active)}
                        <Text weight="medium" color={fg}>{item.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </ScrollView>
            <View style={{ gap: 8 }}>
              <PrefControls />
              <Button variant="ghost" label={t("logout")} onPress={signOut.request} icon={<SignOutIcon size={18} weight="bold" color={colors.destructive} />} style={{ justifyContent: "flex-start" }} />
            </View>
          </View>
        ) : null}

        <View style={styles.main}>
          <View style={[styles.header, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <Text size={wide ? 20 : 16} weight="semibold" numberOfLines={1}>{title}</Text>
              {wide && subtitle ? <Text size={14} muted numberOfLines={1}>{subtitle}</Text> : null}
            </View>
            <View style={styles.actions}>
              <PrinterIndicator />
              {headerActions}
              {aside && layout === "phone" ? (
                <Button
                  variant="outline"
                  size="iconSm"
                  accessibilityLabel={t("cart")}
                  icon={<ShoppingCartIcon size={16} weight="bold" color={colors.foreground} />}
                  onPress={() => container.cartUi.getState().toggle()}
                >
                  {cartCount > 0 ? <CountBadge count={cartCount} /> : null}
                </Button>
              ) : null}
              {!wide ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={storeName}
                  onPress={() => setMenuOpen(true)}
                  style={[styles.avatar, { borderColor: colors.border, backgroundColor: colors.card }]}
                >
                  {logoUri ? <StoreLogo uri={logoUri} size="sm" /> : <Text size={10} weight="semibold">{initials || "POS"}</Text>}
                </Pressable>
              ) : (
                <View style={[styles.chip, { borderColor: colors.border, backgroundColor: `${colors.muted}80` }]}>
                  <StoreLogo uri={logoUri} size="sm" />
                  <View>
                    <Text size={14} weight="medium" numberOfLines={1}>{storeName}</Text>
                    <Text size={12} muted numberOfLines={1}>{roleLabel}</Text>
                  </View>
                </View>
              )}
            </View>
          </View>
          <ConnectivityBanner />

          <View style={[styles.body, { paddingBottom: (layout === "wide" ? insets.bottom + 12 : 8) + (aside && layout === "phone" ? CART_BAR_HEIGHT + 8 : 0) }]}>
            {showAside ? (
              <View style={styles.split}>
                <View style={[styles.fill, { minWidth: 0 }]}>{content}</View>
                <View style={{ width: wide ? 384 : 352 }}>{aside?.(layout)}</View>
              </View>
            ) : scroll ? (
              <ScrollView contentContainerStyle={styles.scrollBody} keyboardShouldPersistTaps="handled">{content}</ScrollView>
            ) : (
              content
            )}
          </View>

          {!wide ? (
            <View style={[styles.bottomNav, { backgroundColor: colors.card, borderColor: colors.border, paddingBottom: Math.max(insets.bottom, 6) }]}>
              {bottomItems.map((item) => {
                const active = route.name === item.route;
                return (
                  <Pressable key={item.route} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => go(item.route)} style={styles.bottomItem}>
                    <View style={[styles.bottomIcon, { backgroundColor: active ? colors.primary : "transparent" }]}>
                      {item.icon(active ? colors.primaryForeground : colors.mutedForeground, active)}
                    </View>
                    <Text size={11} weight="medium" color={active ? colors.primary : colors.mutedForeground} numberOfLines={1}>{item.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>
      </View>

      {aside && layout === "phone" ? aside(layout) : null}

      <MenuSheet
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        header={
          <View>
            <Text weight="medium" numberOfLines={1}>{storeName}</Text>
            <Text size={12} muted numberOfLines={1}>{roleLabel}</Text>
          </View>
        }
        items={menuItems}
      />
      {signOut.dialog}
      {!hasShift && !NO_SHIFT_GATE.includes(route.name as keyof RootStackParamList) ? <OpenShiftDialog onLogout={signOut.request} /> : null}
    </View>
  );
}

function CountBadge({ count }: { count: number }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.badge, { backgroundColor: colors.primary }]}>
      <Text size={10} weight="bold" color={colors.primaryForeground}>{count > 99 ? "99+" : count}</Text>
    </View>
  );
}


const styles = StyleSheet.create({
  root: { flex: 1 },
  row: { flex: 1, flexDirection: "row" },
  main: { flex: 1, minWidth: 0 },
  side: { width: 256, borderRightWidth: 1, paddingHorizontal: 16, paddingTop: 16 },
  brand: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20, paddingHorizontal: 4 },
  sectionLabel: { paddingHorizontal: 12, paddingBottom: 4, letterSpacing: 1.4 },
  navItem: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 44, paddingHorizontal: 12, borderRadius: radius.lg },
  header: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, minHeight: 52 },
  actions: { flexDirection: "row", alignItems: "center", gap: 6 },
  avatar: { width: 36, height: 36, borderRadius: radius.md, borderWidth: 1, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  chip: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: radius.lg, paddingVertical: 4, paddingRight: 12, paddingLeft: 4 },
  body: { flex: 1, padding: 12 },
  split: { flex: 1, flexDirection: "row", gap: 16 },
  fill: { flex: 1 },
  scrollBody: { flexGrow: 1 },
  card: { flex: 1, borderWidth: 1, borderRadius: radius.xl, padding: 12, overflow: "hidden" },
  bottomNav: { flexDirection: "row", borderTopWidth: 1, paddingTop: 6, paddingHorizontal: 4 },
  bottomItem: { flex: 1, alignItems: "center", gap: 2, paddingVertical: 2 },
  bottomIcon: { width: 36, height: 36, borderRadius: radius.lg, alignItems: "center", justifyContent: "center" },
  badge: { position: "absolute", top: -6, right: -6, minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 3, alignItems: "center", justifyContent: "center" },
});
