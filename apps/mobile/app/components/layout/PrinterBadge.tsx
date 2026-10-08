import { ActivityIndicator, Pressable, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useContainer } from "@/core/di/container-context";
import type { PrinterState } from "@/features/receipt/domain/printer";
import { usePrinterStatus } from "@/infrastructure/printer/use-printer-status";
import { useT, type TranslationKey } from "@/i18n";
import type { AppNavigation } from "@/navigators/navigationTypes";
import { radius, useTheme } from "@/theme";
import { PrinterIcon, StatusPill, type Tone } from "@/components/ui";

const view: Record<PrinterState, { label: TranslationKey; tone: Tone }> = {
  unconfigured: { label: "printerNone", tone: "neutral" },
  disconnected: { label: "printerDisconnected", tone: "danger" },
  connecting: { label: "printerConnecting", tone: "warning" },
  connected: { label: "printerConnected", tone: "success" },
  printing: { label: "printerPrinting", tone: "success" },
  error: { label: "printerError", tone: "danger" },
};

export function PrinterBadge() {
  const status = usePrinterStatus(useContainer().printer);
  const { t } = useT();
  const { label, tone } = view[status.state];
  return <StatusPill label={t(label)} tone={tone} />;
}

/** Compact header control: print icon + status dot. Tap opens Settings. */
export function PrinterIndicator() {
  const container = useContainer();
  const navigation = useNavigation<AppNavigation>();
  const status = usePrinterStatus(container.printer);
  const { t } = useT();
  const { colors } = useTheme();
  const { label, tone } = view[status.state];
  const fg = {
    success: colors.success,
    warning: colors.warning,
    danger: colors.destructive,
    neutral: colors.mutedForeground,
    primary: colors.primary,
  }[tone];
  const connecting = status.state === "connecting" || status.state === "printing";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t(label)}
      onPress={() => navigation.navigate("Settings")}
      style={({ pressed }) => ({
        width: 36,
        height: 36,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: pressed ? colors.secondary : colors.card,
        alignItems: "center",
        justifyContent: "center",
      })}
    >
      {connecting ? (
        <ActivityIndicator size="small" color={fg} />
      ) : (
        <PrinterIcon size={16} weight="bold" color={fg} />
      )}
      <View
        style={{
          position: "absolute",
          right: 5,
          bottom: 5,
          width: 7,
          height: 7,
          borderRadius: 4,
          backgroundColor: fg,
          borderWidth: 1,
          borderColor: colors.card,
        }}
      />
    </Pressable>
  );
}
