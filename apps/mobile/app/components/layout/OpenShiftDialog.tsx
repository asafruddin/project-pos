import { useState } from "react";
import { View } from "react-native";
import { Button, Dialog, Text, TextField } from "@/components/ui";
import { useContainer } from "@/core/di/container-context";
import { formatGroupedInt, formatGroupedIntInput, parseGroupedInt } from "@/utils/money";
import { useT } from "@/i18n";
import { useTheme } from "@/theme";

const OPENING_CASH_PRESETS = [20_000, 50_000, 100_000] as const;

/** Blocking "open shift" dialog: nothing can be sold until a shift is open (FR-75). */
export function OpenShiftDialog({ onLogout }: { onLogout: () => void }) {
  const container = useContainer();
  const { t, lang } = useT();
  const { colors } = useTheme();
  const [cash, setCash] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const amount = parseGroupedInt(cash);

  function open() {
    if (busy) return;
    if (cash.trim() === "" || !Number.isInteger(amount) || amount < 0) {
      setError(t("shiftOpeningRequired"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      container.useCases.openShift.execute(amount);
    } catch {
      setError(t("shiftOpenFail"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open
      dismissable={false}
      title={t("shiftOpen")}
      description={t("shiftOpeningHint")}
      footer={
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", flex: 1, gap: 8 }}>
          <Button variant="ghost" label={t("logout")} disabled={busy} onPress={onLogout} />
          <Button label={busy ? t("pending") : t("shiftOpen")} loading={busy} onPress={open} style={{ minWidth: 128 }} />
        </View>
      }
    >
      <View style={{ gap: 8 }}>
        <TextField
          label={t("shiftOpeningCash")}
          value={cash}
          onChangeText={(v) => {
            setCash(formatGroupedIntInput(v, lang));
            setError(null);
          }}
          keyboardType="number-pad"
          autoFocus
          error={Boolean(error)}
        />
        <View style={{ flexDirection: "row", gap: 8 }} accessibilityRole="radiogroup">
          {OPENING_CASH_PRESETS.map((preset) => {
            const active = amount === preset;
            return (
              <Button
                key={preset}
                variant={active ? "default" : "secondary"}
                label={formatGroupedInt(preset, lang)}
                disabled={busy}
                accessibilityState={{ selected: active }}
                onPress={() => {
                  setCash(formatGroupedInt(preset, lang));
                  setError(null);
                }}
                style={{ flex: 1 }}
              />
            );
          })}
        </View>
        {error ? <Text color={colors.destructive} accessibilityRole="alert">{error}</Text> : null}
      </View>
    </Dialog>
  );
}
