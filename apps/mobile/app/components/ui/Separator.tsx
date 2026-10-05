import { View } from "react-native";
import { useTheme } from "@/theme";

export function Separator({ vertical }: { vertical?: boolean }) {
  const { colors } = useTheme();
  return <View style={vertical ? { width: 1, alignSelf: "stretch", backgroundColor: colors.border } : { height: 1, backgroundColor: colors.border }} />;
}
