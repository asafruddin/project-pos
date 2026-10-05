import { View } from "react-native";
import { radius, useTheme } from "@/theme";
import { Text } from "./Text";

export type Tone = "success" | "warning" | "danger" | "neutral" | "primary";

export function StatusPill({ label, tone, dot = true }: { label: string; tone: Tone; dot?: boolean }) {
  const { colors } = useTheme();
  const map = {
    success: { bg: `${colors.success}26`, fg: colors.success },
    warning: { bg: `${colors.warning}33`, fg: colors.warning },
    danger: { bg: `${colors.destructive}26`, fg: colors.destructive },
    neutral: { bg: colors.secondary, fg: colors.mutedForeground },
    primary: { bg: `${colors.primary}26`, fg: colors.primary },
  }[tone];
  return (
    <View
      accessibilityRole="text"
      style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full, backgroundColor: map.bg, alignSelf: "flex-start" }}
    >
      {dot ? <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: map.fg }} /> : null}
      <Text size={12} weight="medium" color={map.fg}>{label}</Text>
    </View>
  );
}
