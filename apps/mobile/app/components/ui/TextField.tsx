import { forwardRef, useState, type ReactNode } from "react";
import { StyleSheet, TextInput, View, type TextInputProps } from "react-native";
import { fontFamily, radius, TOUCH_MIN, useTheme } from "@/theme";
import { Text } from "./Text";

export type TextFieldProps = TextInputProps & {
  label?: string;
  error?: boolean;
  left?: ReactNode;
  right?: ReactNode;
  /** `h-12` (48) is the PWA login/PIN control height; default is 44. */
  height?: number;
  hint?: string;
};

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, error, left, right, height = TOUCH_MIN, hint, style, onFocus, onBlur, editable = true, ...rest },
  ref,
) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.wrap}>
      {label ? (
        <Text size={14} weight="medium">
          {label}
        </Text>
      ) : null}
      <View
        style={[
          styles.field,
          {
            minHeight: height,
            borderRadius: radius.lg,
            borderColor: error ? colors.destructive : focused ? colors.ring : colors.input,
            backgroundColor: colors.card,
            opacity: editable ? 1 : 0.6,
          },
          focused && { borderWidth: 1.5 },
        ]}
      >
        {left ? <View style={styles.adorn}>{left}</View> : null}
        <TextInput
          ref={ref}
          editable={editable}
          accessibilityLabel={label ?? rest.placeholder}
          placeholderTextColor={colors.mutedForeground}
          selectionColor={colors.primary}
          {...rest}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[styles.input, { color: colors.foreground, fontFamily: fontFamily.regular, paddingLeft: left ? 0 : 12, paddingRight: right ? 0 : 12 }, style]}
        />
        {right ? <View style={styles.adorn}>{right}</View> : null}
      </View>
      {hint ? (
        <Text size={12} muted>
          {hint}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  field: { flexDirection: "row", alignItems: "center", borderWidth: 1 },
  input: { flex: 1, fontSize: 16, paddingVertical: 8 },
  adorn: { paddingHorizontal: 10, alignItems: "center", justifyContent: "center" },
});
