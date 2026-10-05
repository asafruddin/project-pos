import { useEffect, useState } from "react";
import { Animated, type DimensionValue, type StyleProp, type ViewStyle } from "react-native";
import { radius, useTheme } from "@/theme";

export function Skeleton({ width = "100%", height = 16, style }: { width?: DimensionValue; height?: number; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  const [opacity] = useState(() => new Animated.Value(0.5));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return <Animated.View style={[{ width, height, borderRadius: radius.lg, backgroundColor: colors.muted, opacity }, style]} />;
}
