import { useState } from "react";
import { Pressable, View } from "react-native";
import { radius, TOUCH_MIN, useTheme } from "@/theme";
import { BottomSheet } from "./BottomSheet";
import { CaretDownIcon, CheckIcon } from "./Icon";
import { Text } from "./Text";

export type SelectOption<T extends string> = { value: T; label: string };

/** Field that opens a bottom-sheet list (replaces the PWA's Radix `Select` on touch). */
export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
  placeholder,
  title,
  disabled,
}: {
  label?: string;
  value: T;
  options: SelectOption<T>[];
  onChange: (next: T) => void;
  placeholder?: string;
  title?: string;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  return (
    <View style={{ gap: 6 }}>
      {label ? <Text weight="medium">{label}</Text> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label ?? title}
        accessibilityState={{ disabled, expanded: open }}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={{
          minHeight: TOUCH_MIN,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          paddingHorizontal: 12,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.input,
          backgroundColor: colors.card,
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <Text style={{ flex: 1 }} numberOfLines={1} color={current ? colors.foreground : colors.mutedForeground}>
          {current?.label ?? placeholder ?? ""}
        </Text>
        <CaretDownIcon size={16} color={colors.mutedForeground} />
      </Pressable>
      <BottomSheet open={open} onClose={() => setOpen(false)} title={title ?? label}>
        <View style={{ gap: 4 }}>
          {options.map((option) => {
            const active = option.value === value;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                onPress={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                style={({ pressed }) => ({
                  minHeight: TOUCH_MIN + 4,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingHorizontal: 12,
                  borderRadius: radius.lg,
                  backgroundColor: active ? colors.accent : pressed ? colors.secondary : "transparent",
                })}
              >
                <Text weight={active ? "semibold" : "regular"} color={active ? colors.accentForeground : colors.foreground}>
                  {option.label}
                </Text>
                {active ? <CheckIcon size={18} weight="bold" color={colors.primary} /> : null}
              </Pressable>
            );
          })}
        </View>
      </BottomSheet>
    </View>
  );
}
