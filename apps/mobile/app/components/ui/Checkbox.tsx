import { Pressable, View } from "react-native";
import { radius, useTheme } from "@/theme";
import { CheckIcon } from "./Icon";
import { Text } from "./Text";

export function Checkbox({ checked, onChange, label, disabled }: { checked: boolean; onChange: (next: boolean) => void; label?: string; disabled?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={() => onChange(!checked)}
      style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, minHeight: 44, opacity: disabled ? 0.5 : 1 }}
    >
      <View
        style={{
          marginTop: 2,
          width: 22,
          height: 22,
          borderRadius: radius.sm - 2,
          borderWidth: 1.5,
          borderColor: checked ? colors.primary : colors.input,
          backgroundColor: checked ? colors.primary : colors.card,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {checked ? <CheckIcon size={14} weight="bold" color={colors.primaryForeground} /> : null}
      </View>
      {label ? <View style={{ flex: 1 }}><Text>{label}</Text></View> : null}
    </Pressable>
  );
}
