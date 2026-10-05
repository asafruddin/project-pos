import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import { radius, TOUCH_MIN, useTheme } from "@/theme";
import { Text } from "./Text";

export type ButtonVariant = "default" | "secondary" | "outline" | "ghost" | "destructive" | "link";
export type ButtonSize = "default" | "sm" | "lg" | "icon" | "iconSm";

export type ButtonProps = Omit<PressableProps, "children" | "style"> & {
  label?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  loading?: boolean;
  /** `true` for the PWA's `rounded-xl` controls (default), `false` for `rounded-md`. */
  rounded?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
};

const HEIGHT: Record<ButtonSize, number> = { default: TOUCH_MIN, sm: 36, lg: 48, icon: TOUCH_MIN, iconSm: 36 };

/** Variants and sizes follow packages/ui `buttonVariants`, with PWA touch sizing. */
export function Button({
  label,
  variant = "default",
  size = "default",
  icon,
  loading,
  rounded = true,
  disabled,
  style,
  children,
  ...rest
}: ButtonProps) {
  const { colors } = useTheme();
  const inactive = disabled || loading;
  const palette = {
    default: { bg: colors.primary, fg: colors.primaryForeground, border: "transparent" },
    secondary: { bg: colors.secondary, fg: colors.secondaryForeground, border: "transparent" },
    outline: { bg: colors.card, fg: colors.foreground, border: colors.border },
    ghost: { bg: "transparent", fg: colors.foreground, border: "transparent" },
    destructive: { bg: colors.destructive, fg: colors.destructiveForeground, border: "transparent" },
    link: { bg: "transparent", fg: colors.primary, border: "transparent" },
  }[variant];
  const isIcon = size === "icon" || size === "iconSm";
  const height = HEIGHT[size];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rest.accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      hitSlop={size === "sm" || size === "iconSm" ? 4 : 0}
      {...rest}
      style={({ pressed }) => [
        styles.base,
        {
          minHeight: height,
          minWidth: isIcon ? height : undefined,
          paddingHorizontal: isIcon ? 0 : size === "sm" ? 12 : 16,
          borderRadius: rounded ? radius.lg : radius.sm,
          backgroundColor: pressed && !inactive ? pressedBg(variant, colors, palette.bg) : palette.bg,
          borderColor: palette.border,
          borderWidth: variant === "outline" ? 1 : 0,
          opacity: inactive ? 0.5 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <View style={styles.row}>
          {icon}
          {label ? (
            <Text weight="medium" size={size === "lg" ? 16 : 14} color={palette.fg} style={variant === "link" && styles.link}>
              {label}
            </Text>
          ) : null}
          {children}
        </View>
      )}
    </Pressable>
  );
}

function pressedBg(variant: ButtonVariant, c: ReturnType<typeof useTheme>["colors"], base: string): string {
  if (variant === "default") return `${c.primary}e6`;
  if (variant === "destructive") return `${c.destructive}e6`;
  if (variant === "secondary") return c.muted;
  if (variant === "link") return "transparent";
  return variant === "ghost" || variant === "outline" ? c.accent : base;
}

const styles = StyleSheet.create({
  base: { alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  link: { textDecorationLine: "underline" },
});
