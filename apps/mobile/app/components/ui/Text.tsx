import { Text as RNText, type TextProps as RNTextProps } from "react-native";
import { fontFamily, useTheme, type FontWeightName } from "@/theme";

export type TextProps = RNTextProps & {
  /** Font size in dp. Default 14 (Tailwind `text-sm`). */
  size?: number;
  weight?: FontWeightName;
  muted?: boolean;
  color?: string;
  tabular?: boolean;
};

/** Inter text. Weight selects the font file (RN cannot synthesise Inter weights). */
export function Text({ size = 14, weight = "regular", muted, color, tabular, style, ...rest }: TextProps) {
  const { colors } = useTheme();
  return (
    <RNText
      {...rest}
      style={[
        {
          fontFamily: fontFamily[weight],
          fontSize: size,
          lineHeight: Math.round(size * 1.4),
          color: color ?? (muted ? colors.mutedForeground : colors.foreground),
        },
        tabular && { fontVariant: ["tabular-nums"] },
        style,
      ]}
    />
  );
}
