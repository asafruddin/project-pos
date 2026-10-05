import { Pressable, StyleSheet, View } from "react-native";
import { radius, useTheme } from "@/theme";
import { BackspaceIcon, Text, XIcon } from "@/components/ui";

type Key = "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "back" | "0" | "clear";
const KEYS: Key[] = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "back", "0", "clear"];
const LENGTH = 6;

export type PinPadProps = {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  /** Accessibility label for the whole pad. */
  label?: string;
};

/** 6-dot display + 3×4 keypad. Calls `onChange` for every key; the caller submits at 6 digits. */
export function PinPad({ value, onChange, disabled, label }: PinPadProps) {
  const { colors } = useTheme();

  function press(key: Key) {
    if (disabled) return;
    if (key === "back") return onChange(value.slice(0, -1));
    if (key === "clear") return onChange("");
    if (value.length >= LENGTH) return;
    onChange(value + key);
  }

  return (
    <View style={styles.root} accessibilityLabel={label}>
      <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {Array.from({ length: LENGTH }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              { backgroundColor: colors.secondary, borderColor: i < value.length ? colors.primary : colors.border },
            ]}
          >
            {i < value.length ? <View style={[styles.fill, { backgroundColor: colors.foreground }]} /> : null}
          </View>
        ))}
      </View>
      <View style={styles.grid}>
        {KEYS.map((key) => (
          <Pressable
            key={key}
            accessibilityRole="button"
            accessibilityLabel={key === "back" ? "Backspace" : key === "clear" ? "Clear" : key}
            disabled={disabled}
            onPress={() => press(key)}
            style={({ pressed }) => [styles.key, { backgroundColor: pressed ? colors.accent : "transparent", opacity: disabled ? 0.5 : 1 }]}
          >
            {key === "back" ? (
              <BackspaceIcon size={24} weight="bold" color={colors.foreground} />
            ) : key === "clear" ? (
              <XIcon size={22} weight="bold" color={colors.foreground} />
            ) : (
              <Text size={22} weight="medium">{key}</Text>
            )}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignSelf: "center", width: "100%", maxWidth: 320, gap: 20 },
  dots: { flexDirection: "row", justifyContent: "center", gap: 8 },
  dot: { width: 44, height: 44, borderRadius: radius.lg, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  fill: { width: 10, height: 10, borderRadius: 5 },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 12 },
  key: { width: "31%", height: 56, borderRadius: radius.xl, alignItems: "center", justifyContent: "center" },
});
