import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { radius, TOUCH_MIN, useTheme } from "@/theme";
import { Text } from "./Text";

export type Segment<T extends string> = { value: T; label?: string; icon?: (color: string) => ReactNode; accessibilityLabel?: string };

/** `rounded-xl border p-1` toggle group (PWA cash/QRIS and grid/list switches). */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  segments,
  disabled,
  compact,
}: {
  value: T;
  onChange: (next: T) => void;
  segments: Segment<T>[];
  disabled?: boolean;
  compact?: boolean;
}) {
  const { colors } = useTheme();
  const height = compact ? 36 : TOUCH_MIN;
  return (
    <View
      accessibilityRole="radiogroup"
      style={{ flexDirection: "row", borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, borderRadius: radius.lg, padding: 4, gap: 4 }}
    >
      {segments.map((segment) => {
        const active = segment.value === value;
        const fg = active ? colors.primaryForeground : colors.foreground;
        return (
          <Pressable
            key={segment.value}
            accessibilityRole="radio"
            accessibilityLabel={segment.accessibilityLabel ?? segment.label}
            accessibilityState={{ selected: active, disabled }}
            disabled={disabled}
            onPress={() => onChange(segment.value)}
            style={{
              flex: segment.label ? 1 : undefined,
              minWidth: height,
              minHeight: height - 8,
              borderRadius: radius.md,
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              gap: 6,
              paddingHorizontal: 12,
              backgroundColor: active ? colors.primary : "transparent",
              opacity: disabled ? 0.5 : 1,
            }}
          >
            {segment.icon?.(fg)}
            {segment.label ? <Text weight="medium" color={fg}>{segment.label}</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );
}
