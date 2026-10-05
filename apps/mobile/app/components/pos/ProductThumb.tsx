import { Image } from "expo-image";
import { View, type DimensionValue, type StyleProp, type ViewStyle } from "react-native";
import { ImageSquareIcon } from "@/components/ui";
import { useTheme } from "@/theme";

/** Cached product photo (file URI from the offline image cache) or a neutral placeholder. */
export function ProductThumb({ uri, size, aspectSquare = true, style }: { uri?: string | null; size?: DimensionValue; aspectSquare?: boolean; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  const frame: ViewStyle = { width: size ?? "100%", aspectRatio: aspectSquare ? 1 : undefined, backgroundColor: colors.muted, overflow: "hidden" };
  if (!uri) {
    return (
      <View style={[frame, { alignItems: "center", justifyContent: "center", backgroundColor: colors.secondary }, style]} accessibilityElementsHidden>
        <ImageSquareIcon size={28} weight="duotone" color={`${colors.mutedForeground}8c`} />
      </View>
    );
  }
  return (
    <View style={[frame, style]}>
      <Image source={{ uri }} style={{ width: "100%", height: "100%" }} contentFit="cover" transition={120} recyclingKey={uri} accessibilityIgnoresInvertColors />
    </View>
  );
}
