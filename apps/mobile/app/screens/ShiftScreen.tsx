import { useEffect, useMemo, useRef, useState } from "react";
import { View } from "react-native";
import { useStore } from "zustand";
import { useNavigation } from "@react-navigation/native";
import { AppShell } from "@/components/layout";
import { Button, Card, Dialog, Skeleton, Text, TextField } from "@/components/ui";
import type { Shift } from "@/features/shift/domain/shift";
import { useContainer } from "@/core/di/container-context";
import { useT } from "@/i18n";
import type { AppNavigation } from "@/navigators/navigationTypes";
import { useTheme } from "@/theme";
import { formatGroupedIntInput, formatIdr, parseGroupedInt } from "@/utils/money";

/**
 * Open shift: system-computed recap, manual cash out, one-tap close. Closing creates the recap PDF, which can be
 * shared. `intent` (logout / close-then-open) routes afterwards.
 */
export default function ShiftScreen() {
  const container = useContainer();
  const navigation = useNavigation<AppNavigation>();
  const { colors } = useTheme();
  const { t, lang } = useT();
  const intent = useStore(container.auth, (s) => s.shiftIntent);
  const shiftVersion = useStore(container.events, (s) => s.shift);
  const salesVersion = useStore(container.events, (s) => s.sales);
  const [refunds, setRefunds] = useState(0);
  const [outAmount, setOutAmount] = useState("");
  const [outReason, setOutReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ shift: Shift; uri: string | null; shareError: string | null } | null>(null);
  const [sharing, setSharing] = useState(false);

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

  // A cash out typed but not yet saved: the amount is required, the reason is optional.
  const typedAmount = parseGroupedInt(outAmount);
  const hasPendingOut = outAmount.trim() !== "" || outReason.trim() !== "";
  const pendingOutMinor = Number.isInteger(typedAmount) && typedAmount > 0 ? typedAmount : 0;

  // Sales so far this shift by payment method (same totals as the PDF; voided sales excluded).
  const methodTotals = useMemo(
    () => (summary ? container.useCases.shiftReport.build(summary.shift, { minor: summary.cashRefundsMinor, known: true }).totals : null),
    [container, summary, shiftVersion, salesVersion], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const methodRows: [string, number][] = methodTotals
    ? [
        [t("shiftMethodCash"), methodTotals.cashMinor],
        [t("qris"), methodTotals.qrisMinor],
        // Store credit only when it was used, to keep the card short.
        ...(methodTotals.storeCreditMinor > 0 ? ([[t("storeCredit"), methodTotals.storeCreditMinor]] as [string, number][]) : []),
      ]
    : [];

  // Opening + every non-voided sale (all methods) + cash in − cash out (saved and typed) − refunds.
  const grandTotalMinor = summary
    ? summary.expected.opening_cash_minor + (methodTotals?.totalMinor ?? 0) + summary.expected.cash_in_minor - summary.expected.cash_out_minor - pendingOutMinor - summary.expected.cash_refunds_minor
    : 0;

  // Cash out entered this shift (the only manual entry).
  const cashOuts = useMemo(
    () => (summary ? container.repositories.shifts.listMovements().filter((m) => m.shiftId === summary.shift.shiftId && m.kind === "out") : []),
    [container, summary, shiftVersion], // eslint-disable-line react-hooks/exhaustive-deps
  );

  /** Save the typed cash out. A blank reason is stored as "Kas keluar" (the server requires a non-empty reason). */
  function saveCashOut(): boolean {
    if (pendingOutMinor < 1) {
      setError(t("shiftCashAmountRequired"));
      return false;
    }
    try {
      container.useCases.recordCash.execute({ kind: "out", amountMinor: pendingOutMinor, reason: outReason.trim() || t("shiftCashOut") });
      setOutAmount("");
      setOutReason("");
      return true;
    } catch {
      setError(t("shiftCashFail"));
      return false;
    }
  }

  function cash() {
    if (busy) return;
    setError(null);
    saveCashOut();
  }

  function requestClose() {
    if (busy) return;
    setError(null);
    if (hasPendingOut && pendingOutMinor < 1) return setError(t("shiftCashAmountRequired"));
    setConfirmClose(true);
  }

  async function close() {
    if (!summary || busy) return;
    setConfirmClose(false);
    setBusy(true);
    setError(null);
    // Auto-save a cash out that was typed but not submitted, so the final cash includes it.
    if (hasPendingOut && !saveCashOut()) {
      setBusy(false);
      return;
    }
    let closed: Shift;
    try {
      // Counted cash = the system's expected cash: nothing is typed at close.
      closed = container.useCases.closeShift.executeAuto(summary.cashRefundsMinor);
    } catch {
      setError(t("shiftCloseFail"));
      setBusy(false);
      return;
    }
    // The shift is closed for good; a PDF problem must not undo it, only show a retry-able message.
    let uri: string | null = null;
    let shareError: string | null = null;
    try {
      const report = container.useCases.shiftReport.build(closed, { minor: summary.cashRefundsMinor, known: container.isOnline() });
      uri = await container.shiftPdf.create(report, lang);
    } catch {
      shareError = t("shiftPdfFail");
    }
    setResult({ shift: closed, uri, shareError });
    setBusy(false);
  }

  async function sharePdf() {
    if (!result?.uri || sharing) return;
    setSharing(true);
    try {
      await container.shiftPdf.share(result.uri);
      setResult({ ...result, shareError: null });
    } catch {
      setResult({ ...result, shareError: t("shiftShareFail") });
    } finally {
      setSharing(false);
    }
  }

  async function finish() {
    setResult(null);
    if (intent === "logout") {
      await container.endAccountSession();
      return;
    }
    container.clearShiftIntent();
    navigation.replace(intent === "close-then-open" ? "Menu" : "DayClose");
  }

  const subtitle = intent === "logout" ? t("shiftLogoutHint") : intent === "close-then-open" ? t("shiftResumeHint") : t("shiftActive");
  const closeLabel = intent === "logout" ? t("shiftLogoutClose") : intent === "close-then-open" ? t("shiftResumeClose") : t("shiftClose");

  const rows = useMemo(() => {
    if (!summary) return [];
    const e = summary.expected;
    return [
      [t("shiftOpening"), formatIdr(e.opening_cash_minor, lang)],
      ...(e.cash_in_minor > 0 ? ([[t("shiftCashIn"), formatIdr(e.cash_in_minor, lang)]] as [string, string][]) : []),
      [t("shiftCashOut"), `−${formatIdr(e.cash_out_minor + pendingOutMinor, lang)}`],
      [t("shiftRefunds"), `−${formatIdr(e.cash_refunds_minor, lang)}`],
      [t("shiftVoids"), `−${formatIdr(e.cash_voids_minor, lang)}`],
    ] as [string, string][];
  }, [summary, t, lang, pendingOutMinor]);

  if (result) {
    return (
      <AppShell title={t("shiftTitle")} subtitle={t("shiftClosedTitle")}>
        <View style={{ gap: 16, maxWidth: 560, width: "100%", alignSelf: "center" }}>
          <Card style={{ gap: 8 }}>
            <Text weight="semibold" size={18}>{t("shiftClosedTitle")}</Text>
            <Text muted>{t("shiftFinalCash")}</Text>
            <Text weight="bold" size={28} tabular>{formatIdr(result.shift.expectedCashMinor ?? 0, lang)}</Text>
            <Text size={14} muted>{result.uri ? t("shiftPdfReady") : ""}</Text>
            {result.shareError ? <Text color={colors.destructive} accessibilityRole="alert">{result.shareError}</Text> : null}
          </Card>
          {result.uri ? <Button size="lg" label={sharing ? t("pending") : t("shiftSharePdf")} loading={sharing} onPress={() => void sharePdf()} /> : null}
          <Button variant="secondary" size="lg" label={t("shiftDone")} onPress={() => void finish()} />
        </View>
      </AppShell>
    );
  }

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
          <Card style={{ gap: 14 }}>
            <Text size={22} weight="bold">{t("shiftSummary")}</Text>

            <View style={{ gap: 10 }}>
              <Text size={14} weight="semibold" muted>{t("shiftSectionCash")}</Text>
              {rows.map(([label, value]) => (
                <View key={label} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 }}>
                  <Text size={17}>{label}</Text>
                  <Text size={17} tabular>{value}</Text>
                </View>
              ))}
            </View>

            <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 14, gap: 10 }}>
              <Text size={14} weight="semibold" muted>{t("shiftSectionSales")}</Text>
              {methodRows.map(([label, amount]) => (
                <View key={label} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 }}>
                  <Text size={17}>{label}</Text>
                  <Text size={17} tabular>{formatIdr(amount, lang)}</Text>
                </View>
              ))}
            </View>

            <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 14, gap: 8 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <Text size={17} weight="semibold" style={{ flex: 1 }}>{t("shiftGrandTotal")}</Text>
                <Text weight="bold" size={30} tabular>{formatIdr(grandTotalMinor, lang)}</Text>
              </View>
              <Text size={15} muted>{t("shiftGrandTotalHint")}</Text>
            </View>
          </Card>
          <Text size={13} muted>{t("shiftAutoNote")}</Text>

          <CashForm title={t("shiftCashOut")} amount={outAmount} reason={outReason} setAmount={setOutAmount} setReason={setOutReason} busy={busy} onSubmit={cash} />

          <Card style={{ gap: 6 }}>
            <Text weight="medium">{t("shiftCashOutList")}</Text>
            {cashOuts.length === 0 ? <Text size={14} muted>{t("shiftCashOutEmpty")}</Text> : null}
            {cashOuts.map((m) => (
              <View key={m.movementId} style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                <Text size={14} muted style={{ flex: 1 }} numberOfLines={2}>{m.reason}</Text>
                <Text size={14} tabular>−{formatIdr(m.amountMinor, lang)}</Text>
              </View>
            ))}
          </Card>

          {error ? <Text color={colors.destructive} accessibilityRole="alert">{error}</Text> : null}
          <Button size="lg" label={busy ? t("pending") : closeLabel} loading={busy} onPress={requestClose} />
          {!intent ? <Button variant="secondary" size="lg" label={t("shiftToMenu")} onPress={() => navigation.navigate("Menu")} /> : null}
        </View>
      )}

      <Dialog
        open={confirmClose}
        onClose={() => setConfirmClose(false)}
        title={t("shiftClose")}
        description={t("shiftCloseConfirm")}
        footer={
          <>
            <Button variant="secondary" label={t("cancel")} onPress={() => setConfirmClose(false)} />
            <Button label={closeLabel} onPress={() => void close()} />
          </>
        }
      >
        {summary ? <Text weight="semibold">{t("shiftFinalCash")}: {formatIdr(summary.expected.expected_cash_minor - pendingOutMinor, lang)}</Text> : null}
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
