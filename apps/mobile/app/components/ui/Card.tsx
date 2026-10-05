import type { ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { radius, useTheme } from "@/theme";

/** `rounded-xl border bg-card shadow-[var(--shadow-card)]` */
export function Card({ children, style, padded = true }: { children: ReactNode; style?: StyleProp<ViewStyle>; padded?: boolean }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: radius.xl,
          padding: padded ? 16 : 0,
          shadowColor: "#101828",
          shadowOpacity: 0.06,
          shadowRadius: 3,
          shadowOffset: { width: 0, height: 1 },
          elevation: 1,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
