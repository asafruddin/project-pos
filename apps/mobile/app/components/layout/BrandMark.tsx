import { View } from "react-native";
import { StoreLogo } from "./StoreLogo";
import { Text } from "@/components/ui/Text";

/** Centered mark + title (+ subtitle) used on login and PIN. */
export function BrandMark({ title, subtitle, logoUri, size = "lg" }: { title: string; subtitle?: string; logoUri?: string | null; size?: "md" | "lg" }) {
  return (
    <View style={{ alignItems: "center", gap: 8 }}>
      <StoreLogo uri={logoUri} size={size} />
      <View style={{ alignItems: "center" }}>
        <Text size={16} weight="semibold">{title}</Text>
        {subtitle ? <Text size={12} muted style={{ marginTop: 2 }}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}
