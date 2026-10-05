import { useCallback, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { useStore } from "zustand";
import type { CustomerHistoryResponse } from "@pos-apps/types";
import { AppShell } from "@/components/layout";
import {
  BottomSheet,
  Button,
  EnvelopeSimpleIcon,
  MagnifyingGlassIcon,
  PhoneIcon,
  PlusIcon,
  Text,
  TextField,
} from "@/components/ui";
import { useContainer } from "@/core/di/container-context";
import { isAppError } from "@/core/errors/app-error";
import { matchCustomers, type Customer } from "@/features/customers/domain/customer";
import type { CompletedSale } from "@/features/checkout/domain/sale";
import { useOnline } from "@/hooks/useOnline";
import { useT } from "@/i18n";
import { radius, useTheme } from "@/theme";
import { formatIdr } from "@/utils/money";

/** Customers: search, add (works offline, queued), detail with server history online / today's local sales offline. */
export default function CustomersScreen() {
  const container = useContainer();
  const { colors } = useTheme();
  const { t, lang } = useT();
  const online = useOnline();
  const version = useStore(container.customersEvents, (s) => s.version);
  const salesVersion = useStore(container.events, (s) => s.sales);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Customer | null>(null);
  const [history, setHistory] = useState<CustomerHistoryResponse | null>(null);
  const [localSales, setLocalSales] = useState<CompletedSale[]>([]);
  const [historyOffline, setHistoryOffline] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [createWarn, setCreateWarn] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const rows: Customer[] = useMemo(() => container.repositories.customers.list(), [container, version]); // eslint-disable-line react-hooks/exhaustive-deps

  const shown = useMemo(() => matchCustomers(rows, query), [rows, query]);

  const select = useCallback(
    async (row: Customer) => {
      setSelected(row);
      setHistory(null);
      setLocalSales(container.repositories.sales.listForLocalDay(new Date()).filter((s) => s.customerId === row.customerId));
      if (!container.isOnline()) return setHistoryOffline(true);
      setHistoryOffline(false);
      try {
        setHistory(await container.remotes.customers.history(row.customerId));
      } catch {
        setHistoryOffline(true);
      }
    },
    [container, salesVersion], // eslint-disable-line react-hooks/exhaustive-deps
  );

  async function create() {
    if (busy || !name.trim()) return;
    setBusy(true);
    setCreateError(null);
    setCreateWarn(null);
    try {
      const { customer, duplicatePhone } = await container.useCases.createCustomer.execute({ name, phone, email });
      setName("");
      setPhone("");
      setEmail("");
      setCreateOpen(false);
      container.customersEvents.setState((s) => ({ version: s.version + 1 }));
      await select(customer);
      if (duplicatePhone) setCreateWarn(t("customerDupPhone"));
    } catch (e) {
      setCreateError(isAppError(e) ? t("customerCreateFail") : t("customerCreateFail"));
    } finally {
      setBusy(false);
    }
  }

  const serverSales = history?.sales ?? [];
  const serverIds = new Set(serverSales.map((s) => s.sale_id));
  const extraLocal = localSales.filter((s) => !serverIds.has(s.saleId));
  const spend = (history?.total_spend_minor ?? 0) + extraLocal.filter((s) => !s.voidedAt).reduce((sum, s) => sum + s.payment.amountMinor, 0);

  const card = { borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, paddingHorizontal: 12, paddingVertical: 10 } as const;

  return (
    <AppShell title={t("customerTitle")} subtitle={t("customerHistory")}>
      <View style={{ gap: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={{ flex: 1 }}>
            <TextField
              value={query}
              onChangeText={setQuery}
              placeholder={t("customerSearchPh")}
              accessibilityLabel={t("customerSearch")}
              autoCorrect={false}
              left={<MagnifyingGlassIcon size={18} color={colors.mutedForeground} />}
            />
          </View>
          <Button
            label={t("customerAdd")}
            icon={<PlusIcon size={16} weight="bold" color={colors.primaryForeground} />}
            onPress={() => {
              setCreateError(null);
              setCreateWarn(null);
              setCreateOpen(true);
            }}
          />
        </View>

        {createWarn ? <Text size={14} muted accessibilityRole="summary">{createWarn}</Text> : null}

        {rows.length === 0 ? (
          <Text muted>{t("customerEmpty")}</Text>
        ) : shown.length === 0 ? (
          <Text muted>{t("customerNoMatches")}</Text>
        ) : (
          shown.map((row) => (
            <Pressable
              key={row.customerId}
              accessibilityRole="button"
              onPress={() => void select(row)}
              style={({ pressed }) => [card, { backgroundColor: pressed ? colors.accent : colors.card, borderColor: selected?.customerId === row.customerId ? colors.primary : colors.border }]}
            >
              <Text weight="medium">{row.name}</Text>
              <Text size={13} muted>
                {row.phone ?? row.email ?? "—"}
                {row.groupName ? ` · ${row.groupName}` : ""}
                {` · ${formatIdr(row.storeCreditMinor, lang)}`}
                {row.loyaltyPoints > 0 ? ` · ${t("loyaltyPoints")} ${row.loyaltyPoints}` : ""}
              </Text>
            </Pressable>
          ))
        )}

        {selected ? (
          <View style={{ gap: 10, marginTop: 8 }}>
            <Text size={18} weight="semibold">{selected.name}</Text>
            <Text size={14} muted>
              {t("customerSpend")}: {formatIdr(spend, lang)}
              {selected.loyaltyPoints > 0 || selected.loyaltyTier
                ? ` · ${t("loyaltyPoints")} ${selected.loyaltyPoints}${selected.loyaltyTier ? ` (${selected.loyaltyTier})` : ""}`
                : ""}
            </Text>
            {historyOffline || !online ? <Text size={14} muted>{t("customerHistoryOffline")}</Text> : null}
            {serverSales.length || extraLocal.length ? (
              <View style={{ gap: 8 }}>
                {serverSales.map((s) => (
                  <View key={s.sale_id} style={card}>
                    <Text size={14}>{formatIdr(s.amount_minor, lang)}{s.voided_at ? ` · ${t("customerVoided")}` : ""}</Text>
                  </View>
                ))}
                {extraLocal.map((s) => (
                  <View key={s.saleId} style={card}>
                    <Text size={14}>{formatIdr(s.payment.amountMinor, lang)}{s.voidedAt ? ` · ${t("customerVoided")}` : ""}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text size={14} muted>{t("customerNoHistory")}</Text>
            )}
            {history?.returns.length ? (
              <View style={{ gap: 8 }}>
                {history.returns.map((r) => (
                  <View key={r.return_id} style={card}>
                    <Text size={14}>{t("customerReturned")}: {formatIdr(r.amount_minor, lang)} · {r.status}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}
      </View>

      <BottomSheet
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        locked={busy}
        title={t("customerAdd")}
        description={t("customerCreateHint")}
        maxHeightRatio={0.85}
        footer={<Button size="lg" label={t("customerCreate")} loading={busy} disabled={!name.trim()} onPress={() => void create()} style={{ flex: 1 }} />}
      >
        <TextField label={t("customerName")} value={name} onChangeText={setName} placeholder={t("customerName")} autoFocus />
        <TextField
          label={t("customerPhone")}
          value={phone}
          onChangeText={setPhone}
          placeholder={t("customerPhone")}
          keyboardType="phone-pad"
          left={<PhoneIcon size={18} color={colors.mutedForeground} />}
        />
        <TextField
          label={t("customerEmail")}
          value={email}
          onChangeText={setEmail}
          placeholder={t("customerEmail")}
          keyboardType="email-address"
          autoCapitalize="none"
          left={<EnvelopeSimpleIcon size={18} color={colors.mutedForeground} />}
        />
        {createError ? <Text color={colors.destructive} accessibilityRole="alert">{createError}</Text> : null}
      </BottomSheet>
    </AppShell>
  );
}
