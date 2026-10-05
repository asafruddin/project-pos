import { useSyncExternalStore } from "react";
import { StyleSheet, View } from "react-native";
import { useStore } from "zustand";
import { Button, Text } from "@/components/ui";
import { useAuth, useContainer } from "@/core/di/container-context";
import { useT } from "@/i18n";
import { useTheme } from "@/theme";

/** Slim banner: offline/degraded notice, or a re-login prompt when the token died mid-shift. */
export function ConnectivityBanner() {
  const container = useContainer();
  const { colors } = useTheme();
  const { t } = useT();
  const { reauth } = useAuth();
  const phase = useStore(container.syncStatus, (s) => s.phase);
  const snapshot = useSyncExternalStore(
    (cb) => container.connectivity.subscribe(cb),
    () => container.connectivity.getSnapshot(),
  );

  if (reauth || phase === "auth_required") {
    return (
      <View style={[styles.bar, { backgroundColor: `${colors.destructive}1f` }]}>
        <View style={styles.grow}>
          <Text size={13} weight="medium" color={colors.destructive}>{t("reauthTitle")}</Text>
          <Text size={12} color={colors.destructive}>{t("reauthBody")}</Text>
        </View>
        <Button label={t("signInAgain")} size="sm" onPress={() => container.openReauth()} />
      </View>
    );
  }
  if (snapshot.state === "online") return null;
  return (
    <View style={[styles.bar, { backgroundColor: `${colors.warning}2e` }]}>
      <Text size={13} color={colors.foreground}>
        {snapshot.state === "offline" ? t("offlineBanner") : t("degradedBanner")}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 8 },
  grow: { flex: 1 },
});
