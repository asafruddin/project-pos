import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { useStore } from "zustand";
import { AppShell, PrinterBadge, SyncBadge, themeIcon, themeLabel } from "@/components/layout";
import { BluetoothIcon, BottomSheet, Button, Card, SegmentedControl, Text, useToast } from "@/components/ui";
import { useAuth, useContainer, usePrefs } from "@/core/di/container-context";
import { isAppError } from "@/core/errors/app-error";
import type { ThemePref } from "@/features/settings/domain/preferences";
import { hasPrinterDiscovery, type PrinterDevice } from "@/features/receipt/domain/printer";
import { useSignOut } from "@/hooks/useSignOut";
import { localeFor, useT, type Translate } from "@/i18n";
import { requestBluetoothPermissions } from "@/infrastructure/printer/bluetooth-permissions";
import { usePrinterQueue } from "@/infrastructure/printer/use-printer-queue";
import { usePrinterStatus } from "@/infrastructure/printer/use-printer-status";
import { radius, useTheme } from "@/theme";
import Constants from "expo-constants";

function printerErrorMessage(error: unknown, t: Translate): string {
  const code = isAppError(error) ? error.message : "";
  if (code === "BT_OFF") return t("printerBluetoothOff");
  if (code === "BT_PERMISSION") return t("printerNeedPermission");
  if (code === "PRINTER_UNCONFIGURED") return t("printerNone");
  return t("printerTestFail");
}

/** Theme, language, sync and Bluetooth receipt printer. */
export default function SettingsScreen() {
  const container = useContainer();
  const { colors } = useTheme();
  const { t, lang } = useT();
  const toast = useToast();
  const prefs = usePrefs();
  const { session } = useAuth();
  const sync = useStore(container.syncStatus);
  const pendingReceipts = usePrinterQueue(container.printQueue);
  const printer = container.printer;
  const status = usePrinterStatus(printer);
  const discovery = hasPrinterDiscovery(printer) ? printer : null;
  const [devices, setDevices] = useState<PrinterDevice[]>([]);
  const [scanned, setScanned] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  const lastSync = sync.lastSyncAt ? new Date(sync.lastSyncAt).toLocaleString(localeFor(lang)) : t("never");
  const signOut = useSignOut();
  const savedName = status.name;

  useEffect(() => {
    if (!scanOpen || !discovery) return;
    void scan();
    // Scan once each time the sheet opens; scan() reads latest discovery/toast itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanOpen]);

  async function scan() {
    if (!discovery || scanning) return;
    setScanning(true);
    try {
      const list = await discovery.scan();
      setDevices(list);
      setScanned(true);
    } catch (error) {
      toast.show(printerErrorMessage(error, t), "error");
    } finally {
      setScanning(false);
    }
  }

  async function openScan() {
    if (!discovery) return;
    const permission = await requestBluetoothPermissions();
    if (permission !== "granted") {
      toast.show(permission === "denied" ? t("printerNeedPermission") : t("printerTestFail"), "error");
      return;
    }
    setScanned(false);
    setDevices([]);
    setScanOpen(true);
  }

  async function pair(device: PrinterDevice) {
    if (!discovery || busyId) return;
    setBusyId(device.id);
    try {
      await discovery.pair(device);
      toast.show(t("printerConnected"), "success");
      setScanOpen(false);
    } catch (error) {
      toast.show(printerErrorMessage(error, t), "error");
    } finally {
      setBusyId(null);
    }
  }

  async function testPrint() {
    if (testing) return;
    setTesting(true);
    try {
      await container.useCases.printReceipt.testNow();
      toast.show(t("printerTestOk"), "success");
    } catch (error) {
      toast.show(printerErrorMessage(error, t), "error");
    } finally {
      setTesting(false);
    }
  }

  async function forget() {
    if (!discovery) return;
    await discovery.forget();
    setDevices([]);
    setScanned(false);
  }

  return (
    <>
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
          <Text size={14} muted>
            {savedName ? t("printerReady", { name: savedName }) : t("printerNone")}
          </Text>
          <Text size={14} muted>{t("pendingReceipts")}: {pendingReceipts}</Text>
          {discovery ? (
            <Button
              variant="secondary"
              label={t("printerScan")}
              icon={<BluetoothIcon size={18} weight="bold" color={colors.foreground} />}
              onPress={() => void openScan()}
            />
          ) : null}
          <Button
            variant="outline"
            label={testing ? t("printerPrinting") : t("printerTest")}
            loading={testing}
            onPress={() => void testPrint()}
          />
          {discovery && savedName ? (
            <Button variant="ghost" label={t("printerForget")} onPress={() => void forget()} />
          ) : null}
        </Card>

        <Card style={{ gap: 6 }}>
          <Text weight="semibold">{t("queueResetLabel")}</Text>
          <Text size={14}>
            {t(
              ({ daily: "queueResetDaily", shift: "queueResetShift", manual: "queueResetManual" } as const)[container.queueSettings.get().mode],
            )}
          </Text>
          <Text size={13} muted>{t("queueResetHint")}</Text>
        </Card>

        <Card style={{ gap: 6 }}>
          <Text weight="semibold">{t("aboutSection")}</Text>
          <Text size={14} muted>{session?.storeName ?? "—"}</Text>
          <Text size={14} muted>{t("versionLabel")}: {Constants.expoConfig?.version ?? "0.0.0"}</Text>
        </Card>

        <Button variant="destructive" size="lg" label={t("logout")} onPress={signOut.request} />
      </View>
    </AppShell>

      {discovery ? (
        <BottomSheet
          open={scanOpen}
          onClose={() => !busyId && setScanOpen(false)}
          title={t("printerScan")}
          description={t("printerHint")}
          locked={Boolean(busyId)}
          footer={
            <>
              <Button variant="secondary" label={t("close")} onPress={() => setScanOpen(false)} disabled={Boolean(busyId)} />
              <Button
                label={scanning ? t("printerScanning") : t("printerScan")}
                loading={scanning}
                onPress={() => void scan()}
              />
            </>
          }
        >
          <View style={{ gap: 10 }}>
            {scanning ? (
              <View style={{ alignItems: "center", paddingVertical: 24, gap: 12 }}>
                <ActivityIndicator color={colors.primary} />
                <Text muted>{t("printerScanning")}</Text>
              </View>
            ) : null}
            {scanned && devices.length === 0 && !scanning ? (
              <Text size={14} muted>{t("printerScanEmpty")}</Text>
            ) : null}
            {devices.map((device) => {
              const selected = status.name === device.name || savedName === device.name;
              const connecting = busyId === device.id;
              return (
                <Pressable
                  key={device.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${device.name} ${device.id}`}
                  onPress={() => void pair(device)}
                  disabled={Boolean(busyId)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    paddingVertical: 12,
                    paddingHorizontal: 12,
                    borderWidth: 1,
                    borderColor: selected ? colors.primary : colors.border,
                    backgroundColor: selected ? `${colors.primary}14` : colors.secondary,
                    borderRadius: radius.lg,
                  }}
                >
                  <BluetoothIcon size={20} weight="duotone" color={selected ? colors.primary : colors.mutedForeground} />
                  <View style={{ flex: 1 }}>
                    <Text weight="medium">{device.name}</Text>
                    <Text size={12} muted>{device.id}</Text>
                    <Text size={12} muted>{device.bonded ? t("printerPaired") : t("printerNearby")}</Text>
                  </View>
                  {connecting ? <ActivityIndicator color={colors.primary} /> : null}
                </Pressable>
              );
            })}
          </View>
        </BottomSheet>
      ) : null}

      {signOut.dialog}
    </>
  );
}