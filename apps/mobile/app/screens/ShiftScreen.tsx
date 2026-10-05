import { useEffect, useMemo, useRef, useState } from "react";
import { View } from "react-native";
import { useStore } from "zustand";
import { useNavigation } from "@react-navigation/native";
import { AppShell } from "@/components/layout";
import { Button, Card, Dialog, Skeleton, Text, TextField } from "@/components/ui";
import { useContainer } from "@/core/di/container-context";
import { useT } from "@/i18n";
import type { AppNavigation } from "@/navigators/navigationTypes";
import { radius, useTheme } from "@/theme";
import { formatGroupedIntInput, formatIdr, parseGroupedInt } from "@/utils/money";

/** Open shift: expected cash, cash in/out, count + close. `intent` (logout / close-then-open) routes afterwards. */
export default function ShiftScreen() {
  const container = useContainer();
  const navigation = useNavigation<AppNavigation>();
  const { colors } = useTheme();
  const { t, lang } = useT();
  const intent = useStore(container.auth, (s) => s.shiftIntent);
  const shiftVersion = useStore(container.events, (s) => s.shift);
  const salesVersion = useStore(container.events, (s) => s.sales);
  const [refunds, setRefunds] = useState(0);
  const [counted, setCounted] = useState("");
  const [inAmount, setInAmount] = useState("");
  const [inReason, setInReason] = useState("");
  const [outAmount, setOutAmount] = useState("");
  const [outReason, setOutReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmDiff, setConfirmDiff] = useState(false);
  const [busy, setBusy] = useState(false);

  // Instant local summary; server refunds (online only) are folded in when they arrive.
  const summary = useMemo(() => container.useCases.shiftSummary.local(refunds), [container, refunds, shiftVersion, salesVersion]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    let cancelled = false;
    void container.useCases.shiftSummary.refunds().then((value) => {
      if (!cancelled) setRefunds(value);
    });
    return () => {
      cancelled = true;
    };
  }, [container, shiftVersion]);

  // No open shift: nothing to do here (PWA redirects to /menu, or finishes the logout).
  const checked = useRef(false);
  useEffect(() => {
    if (checked.current) return;
    checked.current = true; // only the initial load decides; later changes are handled by close()
    if (summary) return;
    if (intent === "logout") void container.endAccountSession();
    else {
      container.clearShiftIntent();
      navigation.replace("Menu");
    }
  }, [summary, intent, container, navigation]);

  const countedMinor = parseGroupedInt(counted);
  const difference = summary && Number.isInteger(countedMinor) ? countedMinor - summary.expected.expected_cash_minor : null;

  function cash(kind: "in" | "out") {
    if (busy) return;
    const amount = parseGroupedInt(kind === "in" ? inAmount : outAmount);
    const reason = kind === "in" ? inReason : outReason;
    setBusy(true);
    setError(null);
    try {
      container.useCases.recordCash.execute({ kind, amountMinor: Number.isFinite(amount) ? amount : 0, reason });
      if (kind === "in") {
        setInAmount("");
        setInReason("");
      } else {
        setOutAmount("");
        setOutReason("");
      }
    } catch {
      setError(t("shiftCashFail"));
    } finally {
      setBusy(false);
    }
  }

  function requestClose() {
    if (busy || !summary) return;
    if (!Number.isInteger(countedMinor) || countedMinor < 0) return setError(t("shiftCloseFail"));
    if (difference !== 0) return setConfirmDiff(true);
    void close();
  }

  async function close() {
    if (!summary) return;
    setConfirmDiff(false);
    setBusy(true);
    setError(null);
    try {
      container.useCases.closeShift.execute(countedMinor, summary.cashRefundsMinor);
      setCounted("");
      if (intent === "logout") {
        await container.endAccountSession();
        return;
      }
      container.clearShiftIntent();
      navigation.replace(intent === "close-then-open" ? "Menu" : "DayClose");
    } catch {
      setError(t("shiftCloseFail"));
    } finally {
      setBusy(false);
    }
  }

  const subtitle = intent === "logout" ? t("shiftLogoutHint") : intent === "close-then-open" ? t("shiftResumeHint") : t("shiftActive");
  const closeLabel = intent === "logout" ? t("shiftLogoutClose") : intent === "close-then-open" ? t("shiftResumeClose") : t("shiftClose");

  const rows = useMemo(() => {
    if (!summary) return [];
    const e = summary.expected;
    return [
      [t("shiftOpening"), formatIdr(e.opening_cash_minor, lang)],
      [t("shiftCashSales"), formatIdr(e.cash_sales_minor, lang)],
      [t("shiftCashIn"), formatIdr(e.cash_in_minor, lang)],
      [t("shiftCashOut"), `−${formatIdr(e.cash_out_minor, lang)}`],
      [t("shiftRefunds"), `−${formatIdr(e.cash_refunds_minor, lang)}`],
      [t("shiftVoids"), `−${formatIdr(e.cash_voids_minor, lang)}`],
    ] as [string, string][];
  }, [summary, t, lang]);

  return (
    <AppShell title={t("shiftTitle")} subtitle={subtitle}>
      {!summary ? (
        <View style={{ gap: 12 }} accessibilityLabel={t("loading")}>
          <Skeleton height={160} />
          <Skeleton height={112} />
          <Skeleton height={112} />
        </View>
      ) : (
        <View style={{ gap: 16, maxWidth: 560, width: "100%", alignSelf: "center" }}>
          <Text size={14} muted>{subtitle}</Text>
          <View style={{ borderWidth: 1, borderColor: colors.border, backgroundColor: `${colors.secondary}80`, borderRadius: radius.xl, padding: 12, gap: 6 }}>
            {rows.map(([label, value]) => (
              <View key={label} style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text muted>{label}</Text>
                <Text tabular>{value}</Text>
              </View>
            ))}
            <View style={{ flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8, marginTop: 4 }}>
              <Text weight="semibold">{t("shiftExpected")}</Text>
              <Text weight="semibold" tabular>{formatIdr(summary.expected.expected_cash_minor, lang)}</Text>
            </View>
          </View>

          <CashForm title={t("shiftCashIn")} amount={inAmount} reason={inReason} setAmount={setInAmount} setReason={setInReason} busy={busy} onSubmit={() => cash("in")} />
          <CashForm title={t("shiftCashOut")} amount={outAmount} reason={outReason} setAmount={setOutAmount} setReason={setOutReason} busy={busy} onSubmit={() => cash("out")} />

          <Card style={{ gap: 8 }}>
            <TextField
              label={t("shiftCounted")}
              value={counted}
              onChangeText={(v) => setCounted(formatGroupedIntInput(v, lang))}
              keyboardType="number-pad"
            />
            {difference !== null ? (
              <Text size={14} color={difference === 0 ? colors.mutedForeground : difference < 0 ? colors.destructive : colors.warning}>
                {t("shiftDifference")}: {formatIdr(difference, lang)}
              </Text>
            ) : null}
            <Button size="lg" label={busy ? t("pending") : closeLabel} loading={busy} onPress={requestClose} />
          </Card>

          {error ? <Text color={colors.destructive} accessibilityRole="alert">{error}</Text> : null}
          {!intent ? <Button variant="secondary" size="lg" label={t("shiftToMenu")} onPress={() => navigation.navigate("Menu")} /> : null}
        </View>
      )}

      <Dialog
        open={confirmDiff}
        onClose={() => setConfirmDiff(false)}
        title={t("shiftClose")}
        description={t("shiftCloseWarn")}
        footer={
          <>
            <Button variant="secondary" label={t("cancel")} onPress={() => setConfirmDiff(false)} />
            <Button label={closeLabel} onPress={() => void close()} />
          </>
        }
      >
        {difference !== null ? <Text weight="semibold">{t("shiftDifference")}: {formatIdr(difference, lang)}</Text> : null}
      </Dialog>
    </AppShell>
  );
}

function CashForm({
  title,
  amount,
  reason,
  setAmount,
  setReason,
  busy,
  onSubmit,
}: {
  title: string;
  amount: string;
  reason: string;
  setAmount: (v: string) => void;
  setReason: (v: string) => void;
  busy: boolean;
  onSubmit: () => void;
}) {
  const { t, lang } = useT();
  return (
    <Card style={{ gap: 8 }}>
      <Text weight="medium">{title}</Text>
      <TextField value={amount} onChangeText={(v) => setAmount(formatGroupedIntInput(v, lang))} keyboardType="number-pad" placeholder={t("shiftCashAmount")} />
      <TextField value={reason} onChangeText={setReason} placeholder={t("shiftCashReason")} />
      <Button variant="secondary" label={title} disabled={busy} onPress={onSubmit} />
    </Card>
  );
}
