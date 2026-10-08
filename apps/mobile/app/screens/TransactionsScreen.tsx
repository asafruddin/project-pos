import { useCallback, useMemo, useState } from "react";
import { View } from "react-native";
import { useStore } from "zustand";
import type { SaleLookupResponse } from "@pos-apps/types";
import { AppShell } from "@/components/layout";
import { ReceiptPreviewDialog, shortSaleId } from "@/components/pos/ReceiptPreviewDialog";
import { ReturnSaleForm } from "@/components/pos/ReturnSaleForm";
import { ConfirmVoidDialog, ManagerPinSheet } from "@/components/pos/VoidDialogs";
import { Button, Card, StatusPill, Text, useToast } from "@/components/ui";
import { useContainer, useEventValue } from "@/core/di/container-context";
import { isAppError } from "@/core/errors/app-error";
import { saleDiscountMinor, type CompletedSale } from "@/features/checkout/domain/sale";
import type { VoidAuth } from "@/features/checkout/domain/void-sale";
import { useOnline } from "@/hooks/useOnline";
import { localeFor, useT, type Translate } from "@/i18n";
import { radius, useTheme } from "@/theme";
import { formatIdr } from "@/utils/money";

function payLabel(sale: CompletedSale, t: Translate): string {
  const m = sale.payment.method;
  return m === "store_credit" ? t("storeCredit") : m === "qris" ? t("qris") : m === "split" ? t("txPaySplit") : t("cashTender");
}

function voidErrorMessage(error: unknown, t: Translate): string {
  const code = isAppError(error) ? error.message : "";
  if (code === "VOID_PIN_SAME") return t("voidPinSame");
  if (code === "VOID_PIN_WRONG" || code === "VOID_PIN_REQUIRED") return t("pinWrong");
  if (code === "VOID_PIN_LOCKED") return t("pinLocked", { seconds: 30 });
  return t("voidFail");
}

/** Today's sales: receipt preview, return (online) and same-day void (manager PIN or unattended permission). */
export default function TransactionsScreen() {
  const container = useContainer();
  const { colors } = useTheme();
  const { t, lang } = useT();
  const toast = useToast();
  const online = useOnline();
  const salesVersion = useStore(container.events, (s) => s.sales);
  const pending = useStore(container.syncStatus, (s) => s.pending);
  const sales = useEventValue(["sales"], (c) => c.repositories.sales.listForLocalDay(new Date()));
  const customerNames = useMemo(() => new Map(container.repositories.customers.list().map((c) => [c.customerId, c.name])), [container, salesVersion]); // eslint-disable-line react-hooks/exhaustive-deps
  void pending;

  const [preview, setPreview] = useState<CompletedSale | null>(null);
  const [returnSale, setReturnSale] = useState<SaleLookupResponse | null>(null);
  const [voidTarget, setVoidTarget] = useState<CompletedSale | null>(null);
  const [voidMode, setVoidMode] = useState<VoidAuth | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const receiptName = (sale: CompletedSale) => sale.guestName?.trim() || (sale.customerId ? customerNames.get(sale.customerId) : undefined) || null;

  const startVoid = useCallback(
    async (sale: CompletedSale) => {
      if (sale.voidedAt) return;
      setError(null);
      setStatus(null);
      setVoidTarget(sale);
      setVoidMode(await container.useCases.voidSale.authMode());
    },
    [container],
  );

  async function runVoid(pin?: string) {
    if (!voidTarget || busy) return;
    setBusy(true);
    setError(null);
    try {
      await container.useCases.voidSale.execute(voidTarget.saleId, pin);
      setVoidTarget(null);
      setVoidMode(null);
      toast.show(t("voidOk"), "success");
      setStatus(t("voidOk"));
    } catch (e) {
      setError(voidErrorMessage(e, t));
    } finally {
      setBusy(false);
    }
  }

  async function startReturn(sale: CompletedSale) {
    if (sale.voidedAt) return;
    setError(null);
    setStatus(null);
    if (!online) return setError(t("returnOffline"));
    if (!container.auth.getState().session?.accessToken) return setError(t("catalogNeedLogin"));
    setBusy(true);
    try {
      setReturnSale(await container.remotes.returns.lookup(sale.saleId));
    } catch (e) {
      if (isAppError(e) && (e.code === "AUTH_UNAUTHORIZED" || e.code === "AUTH_SESSION_EXPIRED")) return;
      setError(isAppError(e) && e.code === "API" && e.message ? e.message : t("returnFail"));
    } finally {
      setBusy(false);
    }
  }

  const total = sales.filter((s) => !s.voidedAt).reduce((sum, s) => sum + s.payment.amountMinor, 0);
  const time = (iso: string) =>
    new Date(iso).toLocaleTimeString(localeFor(lang), { hour: "2-digit", minute: "2-digit" });

  return (
    <AppShell title={returnSale ? t("returnTitle") : t("txTitle")} subtitle={returnSale ? t("returnHint") : t("txHint")}>
      {status ? (
        <View style={{ marginBottom: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: `${colors.secondary}b3`, borderRadius: radius.xl, padding: 10 }} accessibilityRole="summary">
          <Text size={14}>{status}</Text>
        </View>
      ) : null}
      {error && voidMode === null && !returnSale ? (
        <View accessibilityRole="alert" style={{ marginBottom: 12, borderWidth: 1, borderColor: `${colors.destructive}4d`, backgroundColor: `${colors.destructive}1a`, borderRadius: radius.xl, padding: 10 }}>
          <Text size={14} color={colors.destructive}>{error}</Text>
        </View>
      ) : null}

      {returnSale ? (
        <ReturnSaleForm
          sale={returnSale}
          onCancel={() => {
            setReturnSale(null);
            setError(null);
          }}
          onSuccess={() => {
            setReturnSale(null);
            setStatus(`${t("returnOk")} ${t("returnWaitingRefund")}`.trim());
          }}
        />
      ) : sales.length === 0 ? (
        <Text size={14} muted>{t("voidEmpty")}</Text>
      ) : (
        <View style={{ gap: 10 }}>
          {sales.map((sale) => {
            const voided = Boolean(sale.voidedAt);
            const discount = saleDiscountMinor(sale);
            const items = sale.lines.map((l) => `${l.name} ×${l.qty}`).join(", ");
            const qty = sale.lines.reduce((s, l) => s + l.qty, 0);
            return (
              <Card key={sale.saleId} style={{ gap: 10, opacity: voided ? 0.75 : 1 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text size={13} muted tabular>{sale.queueNumber ? `#${sale.queueNumber} · ` : ""}{time(sale.completedAt)} · {shortSaleId(sale.saleId)}</Text>
                    <Text weight="medium" numberOfLines={2}>{items || "—"}</Text>
                    <Text size={12} muted>{t("holdLineCount", { count: qty })} · {receiptName(sale) ?? t("txWalkIn")} · {payLabel(sale, t)}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 4 }}>
                    <Text weight="semibold" tabular style={voided ? { textDecorationLine: "line-through" } : undefined}>{formatIdr(sale.payment.amountMinor, lang)}</Text>
                    {discount > 0 ? <Text size={12} muted>−{formatIdr(discount, lang)}</Text> : null}
                    <StatusPill label={voided ? t("voided") : t("dayCloseStatusDone")} tone={voided ? "neutral" : "primary"} dot={false} />
                  </View>
                </View>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  <Button variant="outline" label={t("receipt")} disabled={busy} onPress={() => setPreview(sale)} style={{ flex: 1 }} />
                  {voided ? null : (
                    <>
                      <Button variant="outline" label={t("returnTitle")} disabled={busy} onPress={() => void startReturn(sale)} style={{ flex: 1 }} />
                      <Button variant="secondary" label={t("voidAction")} disabled={busy} onPress={() => void startVoid(sale)} style={{ flex: 1 }} />
                    </>
                  )}
                </View>
              </Card>
            );
          })}
          <View style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 4, paddingVertical: 4 }}>
            <Text muted>{t("dayCloseTxCount")}: {sales.length} · {t("txDayTotal")}</Text>
            <Text weight="semibold" tabular>{formatIdr(total, lang)}</Text>
          </View>
        </View>
      )}

      <ManagerPinSheet
        mode={voidMode === "enroll" || voidMode === "unlock" ? voidMode : null}
        error={error}
        busy={busy}
        onSubmit={(pin) => void runVoid(pin)}
        onCancel={() => {
          setVoidTarget(null);
          setVoidMode(null);
          setError(null);
        }}
      />
      <ConfirmVoidDialog
        open={voidMode === "unattended"}
        busy={busy}
        onConfirm={() => void runVoid()}
        onCancel={() => {
          setVoidTarget(null);
          setVoidMode(null);
        }}
      />
      <ReceiptPreviewDialog sale={preview} customerName={preview ? receiptName(preview) : null} onClose={() => setPreview(null)} />
    </AppShell>
  );
}
