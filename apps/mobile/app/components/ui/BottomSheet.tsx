import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type KeyboardEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { radius, useTheme } from "@/theme";
import { Text } from "./Text";

export type BottomSheetProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  /** Fraction of window height, default 0.85 (PWA: `max-h-[80vh]`). */
  maxHeightRatio?: number;
  /** Disable drag-to-dismiss (e.g. while a request is in flight). */
  locked?: boolean;
  /** Use a non-scrolling body (caller manages its own scroll view). */
  noScroll?: boolean;
};

const DISMISS_DISTANCE = 90;

/**
 * Bottom sheet on RN `Modal` + `Animated` (no Reanimated/gesture-handler).
 * `rounded-t-3xl`, drag handle, backdrop tap and Android back to dismiss.
 */
export function BottomSheet({ open, onClose, title, description, children, footer, maxHeightRatio = 0.85, locked, noScroll }: BottomSheetProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(open);
  const [windowHeight, setWindowHeight] = useState(() => Dimensions.get("window").height);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const restingHeight = useRef(Dimensions.get("window").height);
  const [translateY] = useState(() => new Animated.Value(Dimensions.get("window").height));
  const [backdrop] = useState(() => new Animated.Value(0));
  // The pan responder is created once; it reads the latest props through this ref.
  const latest = useRef({ locked, onClose });
  useEffect(() => {
    latest.current = { locked, onClose };
  });

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const onShow = (event: KeyboardEvent) => {
      const resized = restingHeight.current - Dimensions.get("window").height > 80;
      // iOS already lifts through KeyboardAvoidingView. Android pads only when the window stays full height.
      setKeyboardInset(Platform.OS === "ios" || resized ? 0 : event.endCoordinates.height);
    };
    const onHide = () => setKeyboardInset(0);
    const onDimensions = ({ window }: { window: { height: number } }) => {
      setWindowHeight(window.height);
      if (restingHeight.current - window.height > 80) {
        setKeyboardInset(0);
        return;
      }
      restingHeight.current = window.height;
    };
    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);
    const dimensionsSub = Dimensions.addEventListener("change", onDimensions);
    return () => {
      showSub.remove();
      hideSub.remove();
      dimensionsSub.remove();
    };
  }, []);

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMounted(true);
      translateY.setValue(Dimensions.get("window").height);
      Animated.parallel([
        Animated.timing(translateY, { toValue: 0, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(backdrop, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(translateY, { toValue: Dimensions.get("window").height, duration: 200, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        Animated.timing(backdrop, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start(({ finished }) => finished && setMounted(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // The handlers only run on touch events (never during render); the lint rule cannot see that.
  /* eslint-disable react-hooks/refs */
  const [pan] = useState(() =>
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => !latest.current.locked && g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_e, g) => {
        if (g.dy > 0) translateY.setValue(g.dy);
      },
      onPanResponderRelease: (_e, g) => {
        if (g.dy > DISMISS_DISTANCE || g.vy > 0.9) {
          latest.current.onClose();
        } else {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
        }
      },
    }),
  );
  /* eslint-enable react-hooks/refs */

  if (!mounted) return null;
  const visibleHeight = Math.max(240, windowHeight - keyboardInset - insets.top - 12);
  const maxHeight = Math.min(windowHeight * maxHeightRatio, visibleHeight);
  const Body = noScroll ? View : ScrollView;

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={locked ? undefined : onClose}>
      <View style={styles.fill} collapsable={false}>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Animated.View style={[styles.backdrop, { backgroundColor: colors.overlay, opacity: backdrop }]}>
          <Pressable style={styles.fill} onPress={locked ? undefined : onClose} accessible={false} />
        </Animated.View>
        <View style={styles.bottom} pointerEvents="box-none">
          <Animated.View
            accessibilityViewIsModal
            style={[
              styles.sheet,
              {
                // A non-scrolling body (cart) needs a definite height for its inner flex layout.
                ...(noScroll ? { height: maxHeight } : { maxHeight }),
                marginBottom: keyboardInset,
                backgroundColor: colors.popover,
                borderColor: colors.border,
                borderTopLeftRadius: radius["3xl"],
                borderTopRightRadius: radius["3xl"],
                paddingBottom: Math.max(insets.bottom, 12),
                transform: [{ translateY }],
              },
            ]}
          >
            <View {...pan.panHandlers} style={styles.handleArea}>
              <View style={[styles.handle, { backgroundColor: colors.border }]} />
            </View>
            {title || description ? (
              <View style={[styles.header, { borderBottomColor: colors.border }]}>
                {title ? <Text size={18} weight="semibold" color={colors.popoverForeground}>{title}</Text> : null}
                {description ? <Text size={14} muted>{description}</Text> : null}
              </View>
            ) : null}
            <Body
              style={noScroll ? styles.bodyFlex : undefined}
              {...(noScroll ? {} : { keyboardShouldPersistTaps: "handled" as const, contentContainerStyle: styles.body })}
            >
              {children}
            </Body>
            {footer ? <View style={[styles.footer, { borderTopColor: colors.border }]}>{footer}</View> : null}
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  backdrop: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  bottom: { flex: 1, justifyContent: "flex-end" },
  sheet: { borderWidth: 1, borderBottomWidth: 0, overflow: "hidden" },
  handleArea: { alignItems: "center", paddingTop: 8, paddingBottom: 6 },
  handle: { width: 40, height: 5, borderRadius: 3 },
  header: { paddingHorizontal: 16, paddingBottom: 12, gap: 4, borderBottomWidth: StyleSheet.hairlineWidth },
  body: { padding: 16, gap: 16 },
  bodyFlex: { flex: 1, minHeight: 0 },
  footer: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
});
