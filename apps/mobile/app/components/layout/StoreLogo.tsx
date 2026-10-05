import { Image } from "expo-image";
import { View } from "react-native";
import { radius, useTheme } from "@/theme";
import { CoffeeIcon } from "@/components/ui/Icon";

const BOX = { sm: 32, md: 40, lg: 64 } as const;
const ICON = { sm: 16, md: 22, lg: 28 } as const;

/** Store logo (cached file URI from the API) or the PWA's orange coffee mark. */
export function StoreLogo({ uri, size = "md", rounded = radius.lg }: { uri?: string | null; size?: keyof typeof BOX; rounded?: number }) {
  const { colors } = useTheme();
  const box = BOX[size];
  if (uri) {
    return <Image source={{ uri }} accessibilityIgnoresInvertColors style={{ width: box, height: box, borderRadius: rounded }} contentFit="cover" />;
  }
  return (
    <View
      accessibilityElementsHidden
      style={{ width: box, height: box, borderRadius: rounded, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" }}
    >
      <CoffeeIcon size={ICON[size]} weight="fill" color={colors.primaryForeground} />
    </View>
  );
}
