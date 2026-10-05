import { useMemo, useState } from "react";
import { View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { AppShell } from "@/components/layout";
import { Button, Card, Checkbox, StatusPill, Text } from "@/components/ui";
import { useContainer } from "@/core/di/container-context";
import { dayCloseGate, type DayCloseSummary } from "@/features/shift/domain/day-close";
import { localeFor, useT } from "@/i18n";
import type { AppNavigation } from "@/navigators/navigationTypes";
import { radius, useTheme } from "@/theme";
import { formatIdr } from "@/utils/money";
import { useStore } from "zustand";

type Step = "summary" | "report";

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexGrow: 1, flexBasis: 150, borderWidth: 1, borderColor: colors.border, backgroundColor: `${colors.background}b3`, borderRadius: radius.xl, padding: 14, gap: 4 }}>
      <Text size={13} muted>{label}</Text>
      <Text size={20} weight="semibold" tabular>{value}</Text>
      {sub ? <Text size={13} muted>{sub}</Text> : null}
    </View>
  );
}

/** Day close: summary + gate → report → confirm → end the account session (data stays on the device). */
export default function DayCloseScreen() {
  const container = useContainer();
  const navigation = useNavigation<AppNavigation>();
  const { colors } = useTheme();
  const { t, lang } = useT();
  const pendingCount = useStore(container.syncStatus, (s) => s.pending + s.dead);
  const shiftVersion = useStore(container.events, (s) => s.shift);
  const salesVersion = useStore(container.events, (s) => s.sales);
  // Outbox progress changes the unsynced list without any local write, hence `pendingCount`.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const live: DayCloseSummary = useMemo(() => container.useCases.dayClose.execute(), [container, pendingCount, shiftVersion, salesVersion]);
  const [step, setStep] = useState<Step>("summary");
  const [ack, setAck] = useState(false);
  const [ackError, setAckError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);

  const gate = dayCloseGate(live, ack);
  const gateMessage = (): string => {
    if (gate.ok) return "";
    if (gate.code === "DAY_CLOSE_SHIFT_OPEN") return t("dayCloseShiftOpen");
    if (gate.code === "DAY_CLOSE_SHIFT_REQUIRED") return t("dayCloseShiftRequired");
    return t("dayCloseAckRequired");
  };
  const shiftBlock = !gate.ok && (gate.code === "DAY_CLOSE_SHIFT_OPEN" || gate.code === "DAY_CLOSE_SHIFT_REQUIRED");
  const pendingSet = new Set(live.pendingSyncSaleIds);
  const time = (iso: string) => new Date(iso).toLocaleTimeString(localeFor(lang), { hour: "2-digit", minute: "2-digit" });

  function toReport() {
    if (!gate.ok) return setAckError(gateMessage());
    setAckError(null);
    setStep("report");
  }

  async function finish() {
    if (!gate.ok) {
      setAckError(gateMessage());
      setStep("summary");
      return;
    }
    setFinishing(true);
    // End Account + PIN session only — keep sales, outbox and PIN material (AD-8).
    await container.endAccountSession();
  }

  return (
    <AppShell title={t("dayClose")} subtitle={step === "summary" ? t("dayCloseSummary") : t("dayCloseReport")}>
      {step === "summary" ? (
        <View style={{ gap: 16, maxWidth: 640, width: "100%", alignSelf: "center" }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            <Stat label={t("dayCloseSalesTotal")} value={formatIdr(live.totalMinor, lang)} />
            <Stat label={t("dayCloseTxCount")} value={String(live.transactionCount)} />
            <Stat label={t("waitingUpload")} value={String(live.pendingSyncCount)} />
            <Stat label={t("dayCloseCash")} value={formatIdr(live.shiftCountedTotalMinor, lang)} />
            <Stat label={t("dayCloseQris")} value={formatIdr(live.qrisTotalMinor, lang)} sub={`${live.qrisTransactionCount} ${t("dayCloseTxCount").toLowerCase()}`} />
          </View>

          <Card style={{ gap: 8 }}>
            <Text weight="medium">{t("dayCloseCash")}</Text>
            {live.closedShifts.length === 0 ? (
              <Text size={14} muted>{t("dayCloseNoShifts")}</Text>
            ) : (
              live.closedShifts.map((row) => (
                <View key={row.shiftId} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 10, gap: 2 }}>
                  <Text size={13} muted>{time(row.closedAt)}</Text>
                  <Text size={14}>{t("dayCloseShiftExpected")}: {formatIdr(row.expectedCashMinor, lang)}</Text>
                  <Text size={14}>{t("dayCloseShiftCounted")}: {formatIdr(row.countedCashMinor, lang)}</Text>
                  <Text size={14}>{t("dayCloseShiftDiff")}: {formatIdr(row.differenceMinor, lang)}</Text>
                </View>
              ))
            )}
            {live.closedShifts.length > 1 ? (
              <Text size={14} weight="medium">
                {t("dayCloseShiftCounted")}: {formatIdr(live.shiftCountedTotalMinor, lang)} · {t("dayCloseShiftDiff")}: {formatIdr(live.shiftDifferenceTotalMinor, lang)}
              </Text>
            ) : null}
          </Card>

          <Card style={{ gap: 8 }}>
            <Text weight="medium">{t("dayCloseQris")}</Text>
            {live.qrisSales.length === 0 ? (
              <Text size={14} muted>{t("dayCloseQrisEmpty")}</Text>
            ) : (
              live.qrisSales.map((row) => (
                <View key={row.saleId} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 10 }}>
                  <Text size={13} muted>{time(row.completedAt)}</Text>
                  <Text weight="medium">{t("qris")}: {formatIdr(row.amountMinor, lang)}</Text>
                </View>
              ))
            )}
          </Card>

          {shiftBlock ? (
            <View style={{ borderWidth: 1, borderColor: `${colors.destructive}66`, backgroundColor: `${colors.destructive}0d`, borderRadius: radius.xl, padding: 14, gap: 10 }}>
              <Text weight="medium" color={colors.destructive} accessibilityRole="alert">{gateMessage()}</Text>
              <Button variant="outline" label={t("dayCloseGoShift")} onPress={() => navigation.navigate("Shift")} />
            </View>
          ) : live.pendingSyncCount === 0 ? (
            <Text size={14} muted>{t("dayCloseSyncOk")}</Text>
          ) : (
            <View style={{ gap: 8 }}>
              <Text size={14} muted>{live.pendingSyncCount} {t("dayCloseSyncPending")}</Text>
              <Checkbox checked={ack} onChange={(v) => { setAck(v); setAckError(null); }} label={t("dayCloseAckLabel", { count: live.pendingSyncCount })} />
            </View>
          )}
          {ackError && !shiftBlock ? <Text color={colors.destructive} accessibilityRole="alert">{ackError}</Text> : null}

          <Button size="lg" label={t("dayCloseContinue")} disabled={!gate.ok} onPress={toReport} />
        </View>
      ) : (
        <View style={{ gap: 12, maxWidth: 640, width: "100%", alignSelf: "center" }}>
          {live.sales.length === 0 ? (
            <Text muted>{t("dayCloseEmpty")}</Text>
          ) : (
            live.sales.map((sale) => {
              const waiting = pendingSet.has(sale.saleId);
              return (
                <View key={sale.saleId} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, padding: 12, gap: 6 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                    <Text size={13} muted>{time(sale.completedAt)} · {sale.saleId.slice(0, 8).toUpperCase()}</Text>
                    <Text weight="semibold" tabular>{formatIdr(sale.payment.amountMinor, lang)}</Text>
                  </View>
                  <Text size={14} numberOfLines={2}>{sale.lines.map((l) => `${l.name} ×${l.qty}`).join(", ")}</Text>
                  <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                    <StatusPill label={sale.voidedAt ? t("voided") : t("dayCloseStatusDone")} tone={sale.voidedAt ? "neutral" : "primary"} dot={false} />
                    <StatusPill label={waiting ? t("waitingUpload") : t("synced")} tone={waiting ? "warning" : "success"} dot={false} />
                  </View>
                </View>
              );
            })
          )}
          <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 }}>
            <Text weight="semibold">{t("total")}</Text>
            <Text weight="semibold" tabular>{formatIdr(live.totalMinor, lang)}</Text>
          </View>
          <Text size={14} muted>{t("dayCloseConfirmHint")}</Text>
          <Button size="lg" label={finishing ? t("pending") : t("dayCloseConfirm")} loading={finishing} onPress={() => void finish()} />
          <Button variant="ghost" label={t("dayCloseBack")} disabled={finishing} onPress={() => setStep("summary")} />
        </View>
      )}
    </AppShell>
  );
}
