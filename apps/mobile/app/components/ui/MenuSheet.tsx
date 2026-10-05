import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { radius, TOUCH_MIN, useTheme } from "@/theme";
import { BottomSheet } from "./BottomSheet";
import { Separator } from "./Separator";
import { Text } from "./Text";

export type MenuItem =
  | { type: "item"; key: string; label: string; icon?: ReactNode; destructive?: boolean; onPress: () => void }
  | { type: "separator"; key: string };

/** Dropdown-menu replacement: a bottom sheet of actions (PWA `DropdownMenu` on touch). */
export function MenuSheet({
  open,
  onClose,
  header,
  items,
}: {
  open: boolean;
  onClose: () => void;
  header?: ReactNode;
  items: MenuItem[];
}) {
  const { colors } = useTheme();
  return (
    <BottomSheet open={open} onClose={onClose}>
      {header}
      {header ? <Separator /> : null}
      <View style={{ gap: 2 }}>
        {items.map((item) =>
          item.type === "separator" ? (
            <View key={item.key} style={{ marginVertical: 4 }}><Separator /></View>
          ) : (
            <Pressable
              key={item.key}
              accessibilityRole="menuitem"
              onPress={() => {
                onClose();
                item.onPress();
              }}
              style={({ pressed }) => ({
                minHeight: TOUCH_MIN + 4,
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                paddingHorizontal: 12,
                borderRadius: radius.lg,
                backgroundColor: pressed ? colors.secondary : "transparent",
              })}
            >
              {item.icon}
              <Text color={item.destructive ? colors.destructive : colors.foreground} weight="medium">{item.label}</Text>
            </Pressable>
          ),
        )}
      </View>
    </BottomSheet>
  );
}
