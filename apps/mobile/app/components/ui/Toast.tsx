import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { radius, useTheme } from "@/theme";
import { CheckCircleIcon, InfoIcon, WarningIcon } from "./Icon";
import { Text } from "./Text";

type Kind = "success" | "error" | "info";
type ToastItem = { id: number; kind: Kind; message: string };
type ToastApi = { show: (message: string, kind?: Kind) => void };

const ToastContext = createContext<ToastApi>({ show: () => undefined });

/** Sonner-style toast (PWA `Toaster`): one at a time, auto-dismiss after 3 s. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [item, setItem] = useState<ToastItem | null>(null);
  const counter = useRef(0);
  const show = useCallback((message: string, kind: Kind = "info") => {
    counter.current += 1;
    setItem({ id: counter.current, kind, message });
  }, []);
  const api = useMemo(() => ({ show }), [show]);
  return (
    <ToastContext.Provider value={api}>
      {children}
      {item ? <ToastView key={item.id} item={item} onDone={() => setItem((cur) => (cur?.id === item.id ? null : cur))} /> : null}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  return useContext(ToastContext);
}

function ToastView({ item, onDone }: { item: ToastItem; onDone: () => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [opacity] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }).start();
    const timer = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(onDone);
    }, 3000);
    return () => clearTimeout(timer);
  }, [opacity, onDone]);

  const tint = item.kind === "success" ? colors.success : item.kind === "error" ? colors.destructive : colors.mutedForeground;
  const Icon = item.kind === "success" ? CheckCircleIcon : item.kind === "error" ? WarningIcon : InfoIcon;
  return (
    <View pointerEvents="none" style={[styles.host, { top: insets.top + 12 }]}>
      <Animated.View
        accessibilityLiveRegion="polite"
        style={[styles.toast, { opacity, backgroundColor: colors.popover, borderColor: colors.border, borderRadius: radius.lg }]}
      >
        <Icon size={18} weight="fill" color={tint} />
        <Text size={14} color={colors.popoverForeground} style={styles.text}>{item.message}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: "absolute", left: 16, right: 16, alignItems: "center", zIndex: 1000 },
  toast: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, maxWidth: 480, shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 8, elevation: 6 },
  text: { flexShrink: 1 },
});
