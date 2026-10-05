import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "@/components/ui";
import { useLayout } from "@/hooks/useBreakpoint";
import { radius, useTheme } from "@/theme";
import { BrandMark } from "./BrandMark";

export type AuthShellProps = {
  brandTitle: string;
  brandSubtitle?: string;
  heading: string;
  description: string;
  quoteBy?: string;
  logoUri?: string | null;
  topRight?: ReactNode;
  children: ReactNode;
};

const QUOTE =
  "Serve customers the best food with prompt and friendly service in a welcoming atmosphere, and they’ll keep coming back.";

/** Login/PIN layout: brand hero on the left for wide screens, centered form otherwise (PWA `AuthSplitShell`). */
export function AuthShell({ brandTitle, brandSubtitle, heading, description, quoteBy, logoUri, topRight, children }: AuthShellProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { layout } = useLayout();
  const wide = layout === "wide";
  return (
    <View style={[styles.root, { backgroundColor: colors.background, flexDirection: wide ? "row" : "column" }]}>
      {wide ? (
        <View style={[styles.hero, { backgroundColor: "#2a1a0c" }]}>
          <View style={[styles.glow, { backgroundColor: colors.primary, top: -180, left: -140, width: 560, height: 560 }]} />
          <View style={[styles.glow, { backgroundColor: "#f59e0b", bottom: -220, right: -160, width: 520, height: 520, opacity: 0.18 }]} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.heroOverlay }]} />
          <View style={styles.quote}>
            <Text size={20} color="rgba(255,255,255,0.95)" style={{ lineHeight: 30 }}>“{QUOTE}”</Text>
            <View style={styles.quoteBy}>
              <Text size={14} color="#fff">{quoteBy ?? brandTitle}</Text>
            </View>
          </View>
        </View>
      ) : null}
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {topRight ? <View style={[styles.topRight, { top: insets.top + 12 }]}>{topRight}</View> : null}
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 56, paddingBottom: insets.bottom + 24 }]}
        >
          <View style={styles.column}>
            <BrandMark title={brandTitle} subtitle={brandSubtitle} logoUri={logoUri} />
            <View style={{ gap: 12, marginTop: 28 }}>
              <Text size={wide ? 36 : 28} weight="semibold" style={styles.center}>{heading}</Text>
              <Text size={14} muted style={styles.center}>{description}</Text>
            </View>
            <View style={{ marginTop: 28 }}>{children}</View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

export function AuthLoading({ message }: { message: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.fill, styles.loading, { backgroundColor: colors.background }]}>
      <Text muted>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fill: { flex: 1 },
  hero: { width: "48%", overflow: "hidden", justifyContent: "flex-end" },
  glow: { position: "absolute", borderRadius: 999, opacity: 0.42 },
  quote: { padding: 48, gap: 16, maxWidth: 560 },
  quoteBy: { alignSelf: "flex-start", paddingHorizontal: 16, paddingVertical: 6, borderRadius: radius.sm, borderWidth: 1, borderColor: "rgba(255,255,255,0.7)" },
  topRight: { position: "absolute", right: 16, zIndex: 20 },
  scroll: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 20 },
  column: { width: "100%", maxWidth: 448, alignSelf: "center" },
  center: { textAlign: "center" },
  loading: { alignItems: "center", justifyContent: "center" },
});
