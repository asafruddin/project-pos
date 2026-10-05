import { View } from "react-native";
import { useStore } from "zustand";
import { AppShell, PrinterBadge, SyncBadge, themeIcon, themeLabel } from "@/components/layout";
import { Button, Card, SegmentedControl, Text, useToast } from "@/components/ui";
import { useAuth, useContainer, usePrefs } from "@/core/di/container-context";
import type { ThemePref } from "@/features/settings/domain/preferences";
import { useSignOut } from "@/hooks/useSignOut";
import { localeFor, useT } from "@/i18n";
import { useTheme } from "@/theme";
import Constants from "expo-constants";

/** Theme, language, sync and printer status. (Printer pairing arrives with the native Bluetooth module.) */
export default function SettingsScreen() {
  const container = useContainer();
  const { colors } = useTheme();
  const { t, lang } = useT();
  const toast = useToast();
  const prefs = usePrefs();
  const { session } = useAuth();
  const sync = useStore(container.syncStatus);
  const pendingReceipts = container.printQueue.pendingCount();

  const lastSync = sync.lastSyncAt ? new Date(sync.lastSyncAt).toLocaleString(localeFor(lang)) : t("never");

  const signOut = useSignOut();

  return (
    <AppShell title={t("settings")} subtitle={t("settingsHint")}>
      <View style={{ gap: 16, maxWidth: 560, width: "100%", alignSelf: "center" }}>
        <Card style={{ gap: 12 }}>
          <Text weight="semibold">{t("theme")}</Text>
          <SegmentedControl<ThemePref>
            value={prefs.theme}
            onChange={prefs.setTheme}
            segments={(["system", "light", "dark"] as ThemePref[]).map((pref) => ({
              value: pref,
              label: themeLabel(pref, t),
              icon: (c: string) => themeIcon(pref, c, 16),
            }))}
          />
          <Text weight="semibold" style={{ marginTop: 4 }}>{t("language")}</Text>
          <SegmentedControl
            value={prefs.lang}
            onChange={prefs.setLang}
            segments={[
              { value: "id", label: "Indonesia" },
              { value: "en", label: "English" },
            ]}
          />
        </Card>

        <Card style={{ gap: 10 }}>
          <Text weight="semibold">{t("syncSection")}</Text>
          <SyncBadge />
          <Text size={14} muted>{t("syncPending")}: {sync.pending} · {t("syncFailedItems")}: {sync.dead}</Text>
          <Text size={14} muted>{t("lastSync")}: {lastSync}</Text>
          {sync.lastError ? <Text size={13} color={colors.destructive}>{sync.lastError}</Text> : null}
          <Button variant="secondary" label={t("syncNow")} onPress={() => void container.scheduler.syncNow("manual")} />
          {sync.dead > 0 ? (
            <Button
              variant="secondary"
              label={t("syncRetryFailed")}
              onPress={() => {
                container.repositories.outbox.reviveDead();
                void container.scheduler.syncNow("manual");
              }}
            />
          ) : null}
        </Card>

        <Card style={{ gap: 10 }}>
          <Text weight="semibold">{t("printerSection")}</Text>
          <Text size={14} muted>{t("printerHint")}</Text>
          <PrinterBadge />
          <Text size={14} muted>{t("pendingReceipts")}: {pendingReceipts}</Text>
          <Button variant="outline" label={t("printerTest")} onPress={() => {
            container.useCases.printReceipt.testPage();
            toast.show(container.printQueue.pendingCount() > 0 ? t("receiptQueued") : t("printerTestOk"), "info");
          }} />
          <Text size={12} muted>{t("printerStubNote")}</Text>
        </Card>

        <Card style={{ gap: 6 }}>
          <Text weight="semibold">{t("aboutSection")}</Text>
          <Text size={14} muted>{session?.storeName ?? "—"}</Text>
          <Text size={14} muted>{t("versionLabel")}: {Constants.expoConfig?.version ?? "0.0.0"}</Text>
        </Card>

        <Button variant="destructive" size="lg" label={t("logout")} onPress={signOut.request} />
      </View>

      {signOut.dialog}
    </AppShell>
  );
}
