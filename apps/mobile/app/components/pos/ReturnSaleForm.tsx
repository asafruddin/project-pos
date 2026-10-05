import { useState } from "react";
import { View } from "react-native";
import type { ReturnDecision, SaleLookupResponse } from "@pos-apps/types";
import { Button, Select, Text, TextField } from "@/components/ui";
import { useContainer } from "@/core/di/container-context";
import { isAppError } from "@/core/errors/app-error";
import { buildReturnRequest, initialReturnDraft, remainingQty } from "@/features/returns/domain/return";
import { localeFor, useT } from "@/i18n";
import { radius, useTheme } from "@/theme";
import { formatIdr } from "@/utils/money";

/** Return lines of a synced sale (online only): per-line quantity + stock decision, reason, optional exchange sale. */
export function ReturnSaleForm({ sale, onCancel, onSuccess }: { sale: SaleLookupResponse; onCancel: () => void; onSuccess: () => void }) {
  const container = useContainer();
  const { colors } = useTheme();
  const { t, lang } = useT();
  const [draft, setDraft] = useState(() => initialReturnDraft(sale));
  const [reason, setReason] = useState("");
  const [exchangeId, setExchangeId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (sale.voided_at) {
    return (
      <View style={{ gap: 12 }}>
        <Text muted>{t("returnVoided")}</Text>
        <Button variant="ghost" label={t("txBack")} onPress={onCancel} />
      </View>
    );
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await container.remotes.returns.create(sale.sale_id, buildReturnRequest(draft, reason, exchangeId));
      onSuccess();
    } catch (e) {
      if (isAppError(e) && (e.code === "AUTH_UNAUTHORIZED" || e.code === "AUTH_SESSION_EXPIRED")) return;
      setError(isAppError(e) && e.code === "API" && e.message ? e.message : t("returnFail"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: 16, maxWidth: 560, width: "100%", alignSelf: "center" }}>
      <Text weight="medium">
        {formatIdr(sale.amount_minor, lang)} · {new Date(sale.completed_at).toLocaleString(localeFor(lang))}
      </Text>
      {error ? (
        <View accessibilityRole="alert" style={{ borderWidth: 1, borderColor: `${colors.destructive}4d`, backgroundColor: `${colors.destructive}1a`, borderRadius: radius.xl, padding: 10 }}>
          <Text color={colors.destructive}>{error}</Text>
        </View>
      ) : null}
      {sale.lines.map((line, index) => {
        const remaining = remainingQty(line);
        const row = draft[index];
        return (
          <View key={line.product_id} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, padding: 12, gap: 10 }}>
            <View>
              <Text weight="medium">{line.name ?? line.product_id}</Text>
              <Text size={13} muted>
                {line.qty} · {t("returnRemaining")} {remaining} · {formatIdr(line.price_minor, lang)}
              </Text>
            </View>
            {remaining <= 0 ? (
              <Text size={14} muted>{t("returnAlready")}</Text>
            ) : (
              <View style={{ gap: 10 }}>
                <TextField
                  label={t("returnQty")}
                  value={row.qty}
                  keyboardType="number-pad"
                  onChangeText={(qty) => setDraft((d) => d.map((r, i) => (i === index ? { ...r, qty: qty.replace(/\D/g, "") } : r)))}
                />
                <Select<ReturnDecision>
                  label={t("returnDecision")}
                  value={row.decision}
                  onChange={(decision) => setDraft((d) => d.map((r, i) => (i === index ? { ...r, decision } : r)))}
                  options={[
                    { value: "resellable", label: t("returnResellable") },
                    { value: "damaged", label: t("returnDamaged") },
                    { value: "warranty", label: t("returnWarranty") },
                  ]}
                />
              </View>
            )}
          </View>
        );
      })}
      <TextField label={t("returnReason")} value={reason} onChangeText={setReason} placeholder={t("returnReasonPh")} />
      <TextField label={t("returnExchange")} value={exchangeId} onChangeText={setExchangeId} autoCapitalize="none" autoCorrect={false} />
      <Button size="lg" label={t("returnSubmit")} loading={busy} onPress={() => void submit()} />
      <Button variant="ghost" label={t("txBack")} disabled={busy} onPress={onCancel} />
    </View>
  );
}
