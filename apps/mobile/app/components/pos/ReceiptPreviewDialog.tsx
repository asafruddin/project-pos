import { ScrollView, View } from "react-native";
import { useState } from "react";
import { Button, Dialog, Separator, Text } from "@/components/ui";
import { StoreLogo } from "@/components/layout/StoreLogo";
import { useAuth, useContainer } from "@/core/di/container-context";
import type { CompletedSale } from "@/features/checkout/domain/sale";
import { saleSubtotal } from "@/features/checkout/domain/sale";
import { discountRows, queueNumberForDay } from "@/features/receipt/domain/receipt-encoder";
import { localeFor, useT } from "@/i18n";
import { radius, useTheme } from "@/theme";
import { formatIdr } from "@/utils/money";

export function shortSaleId(saleId: string): string {
  return saleId.slice(0, 8).toUpperCase();
}

function Row({ left, right, bold, muted }: { left: string; right: string; bold?: boolean; muted?: boolean }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
      <Text weight={bold ? "semibold" : "regular"} muted={muted} style={{ flexShrink: 1 }}>{left}</Text>
      <Text weight={bold ? "semibold" : "regular"} muted={muted} tabular>{right}</Text>
    </View>
  );
}

/** On-screen customer copy (PWA `SaleReceiptCopy`), 58 mm-style card. */
export function ReceiptCopy({ sale, customerName, queueNumber }: { sale: CompletedSale; customerName: string | null; queueNumber: number }) {
  const { colors } = useTheme();
  const { t, lang } = useT();
  const { session, logoUri } = useAuth();
  const storeName = session?.storeName ?? "POS";
  const payable = sale.payment.amountMinor;
  const labels = { promoDiscount: t("promoDiscount"), voucher: t("voucher"), managerDiscount: t("managerDiscount") };
  const time = new Date(sale.completedAt).toLocaleString(localeFor(lang), { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const guest = customerName?.trim() || sale.guestName?.trim() || t("txWalkIn");
  return (
    <View style={{ borderWidth: 1, borderStyle: "dashed", borderColor: colors.border, borderRadius: radius.xl, padding: 16, gap: 12, backgroundColor: colors.card }}>
      <View style={{ alignItems: "center", gap: 6 }}>
        <StoreLogo uri={logoUri} size="lg" />
        <Text size={16} weight="bold">{storeName}</Text>
        <Text size={12} muted style={{ letterSpacing: 1.6 }}>{t("receiptCustomerCopy").toUpperCase()}</Text>
        <Text size={12} muted>{t("receiptQueue")}</Text>
        <Text size={28} weight="bold" style={{ fontVariant: ["tabular-nums"] }}>#{queueNumber}</Text>
        <Text size={14} weight="semibold">{t("receiptGuest")}: {guest}</Text>
        <Text size={12}>{time}</Text>
        <Text size={12} style={{ fontVariant: ["tabular-nums"] }}>{shortSaleId(sale.saleId)}</Text>
        {sale.voidedAt ? <Text size={12} weight="semibold">{t("voided")}</Text> : null}
      </View>
      <Separator />
      <View style={{ gap: 6 }}>
        {sale.lines.map((line) => (
          <View key={line.productId} style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text>{line.name}</Text>
              <Text size={12} muted>{line.qty} × {formatIdr(line.priceMinor, lang)}</Text>
            </View>
            <Text weight="medium" tabular>{formatIdr(line.qty * line.priceMinor, lang)}</Text>
          </View>
        ))}
      </View>
      <Separator />
      <View style={{ gap: 4 }}>
        <Row left={t("total")} right={formatIdr(saleSubtotal(sale), lang)} />
        {discountRows(sale, labels).map((row) => (
          <Row key={row.label} left={row.label} right={`−${formatIdr(row.amountMinor, lang)}`} />
        ))}
        {sale.payment.tenders.map((tender, i) => (
          <Row
            key={`${tender.method}-${i}`}
            left={tender.method === "store_credit" ? t("storeCredit") : tender.method === "qris" ? t("qris") : t("cashTender")}
            right={formatIdr(tender.amountMinor, lang)}
          />
        ))}
        <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8, marginTop: 4 }}>
          <Row left={t("total")} right={formatIdr(payable, lang)} bold />
        </View>
      </View>
      <Text size={12} style={{ textAlign: "center" }}>{t("receiptThanks", { store: storeName.trim() || "POS" })}</Text>
    </View>
  );
}

/** Receipt dialog: Print sends one customer copy, waits 5s, then two kitchen tickets. */
export function ReceiptPreviewDialog({ sale, customerName, onClose }: { sale: CompletedSale | null; customerName: string | null; onClose: () => void }) {
  const container = useContainer();
  const { t } = useT();
  const { colors } = useTheme();
  const [status, setStatus] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  const queueNumber = sale
    ? (sale.queueNumber ?? queueNumberForDay(sale.saleId, container.repositories.sales.listForLocalDay(new Date(sale.completedAt))))
    : 1;

  async function print() {
    if (!sale || printing) return;
    setPrinting(true);
    setStatus(t("printerPrinting"));
    try {
      await container.useCases.printReceipt.printNow(sale, customerName);
      setStatus(t("receiptPrinted"));
    } catch {
      setStatus(t("printerTestFail"));
    } finally {
      setPrinting(false);
    }
  }

  return (
    <Dialog
      open={Boolean(sale)}
      onClose={printing ? undefined : () => {
        setStatus(null);
        onClose();
      }}
      dismissable={!printing}
      title={t("receiptPreviewTitle")}
      description={t("receiptPreviewHint")}
      maxWidth={512}
      footer={
        <>
          <Button
            variant="secondary"
            label={t("receiptClose")}
            disabled={printing}
            onPress={() => {
              if (printing) return;
              setStatus(null);
              onClose();
            }}
          />
          <Button
            label={printing ? t("printerPrinting") : t("printReceipt")}
            loading={printing}
            onPress={() => void print()}
          />
        </>
      }
    >
      {sale ? (
        <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false}>
          <ReceiptCopy sale={sale} customerName={customerName} queueNumber={queueNumber} />
        </ScrollView>
      ) : null}
      {status ? <Text size={13} color={colors.mutedForeground} accessibilityRole="summary">{status}</Text> : null}
    </Dialog>
  );
}
