import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import {
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type KeyboardEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "@/components/ui";
import { useLayout } from "@/hooks/useBreakpoint";
import { radius, useTheme } from "@/theme";
import { BrandMark } from "./BrandMark";

export type AuthShellProps = {
  brandTitle: string;
  brandSubtitle?: string;
  heading: string;
  description: string;
  quoteBy?: string;
  logoUri?: string | null;
  topRight?: ReactNode;
  children: ReactNode;
};

const QUOTE =
  "Serve customers the best food with prompt and friendly service in a welcoming atmosphere, and they’ll keep coming back.";

type Measurable = {
  measureInWindow: (callback: (x: number, y: number, width: number, height: number) => void) => void;
};

function focusedInput(): Measurable | null {
  const input = TextInput.State.currentlyFocusedInput() as unknown as Measurable | null;
  if (!input || typeof input.measureInWindow !== "function") return null;
  return input;
}

/** Scroll just enough for the form, or the focused field, to clear the keyboard. */
function liftAboveKeyboard(
  scrollRef: RefObject<ScrollView | null>,
  columnRef: RefObject<View | null>,
  scrollY: RefObject<number>,
  keyboardTop: number,
) {
  const column = columnRef.current;
  if (!column || keyboardTop <= 0) return;
  const margin = 12;
  column.measureInWindow((_x, y, _width, height) => {
    const formFits = height <= keyboardTop - margin * 2;
    const scrollBy = (overlap: number) => {
      if (overlap <= 0) return;
      scrollRef.current?.scrollTo({ y: Math.max(0, scrollY.current + overlap), animated: true });
    };
    if (formFits) {
      scrollBy(y + height + margin - keyboardTop);
      return;
    }
    const field = focusedInput();
    if (!field) {
      scrollBy(y + height + margin - keyboardTop);
      return;
    }
    field.measureInWindow((_fx, fy, _fw, fh) => {
      scrollBy(fy + fh + margin - keyboardTop);
    });
  });
}

/** Login/PIN layout: brand hero on the left for wide screens, centered form otherwise (PWA `AuthSplitShell`). */
export function AuthShell({ brandTitle, brandSubtitle, heading, description, quoteBy, logoUri, topRight, children }: AuthShellProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { layout } = useLayout();
  const wide = layout === "wide";
  const scrollRef = useRef<ScrollView>(null);
  const columnRef = useRef<View>(null);
  const scrollY = useRef(0);
  const keyboardTopRef = useRef(0);
  const liftedRef = useRef(false);
  const restingHeight = useRef(Dimensions.get("window").height);
  const [lifted, setLifted] = useState(false);
  const [keyboardPad, setKeyboardPad] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const onShow = (event: KeyboardEvent) => {
      liftedRef.current = true;
      keyboardTopRef.current = event.endCoordinates.screenY;
      const windowHeight = Dimensions.get("window").height;
      const resized = restingHeight.current - windowHeight > 80;
      // iOS padding comes from KeyboardAvoidingView. Android adds padding only when the window did not resize.
      setKeyboardPad(Platform.OS === "ios" || resized ? 0 : event.endCoordinates.height);
      setLifted(true);
    };
    const onHide = () => {
      liftedRef.current = false;
      keyboardTopRef.current = 0;
      setLifted(false);
      setKeyboardPad(0);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    };
    const onDimensions = ({ window }: { window: { height: number } }) => {
      const drop = restingHeight.current - window.height;
      if (drop > 80) {
        if (liftedRef.current) setKeyboardPad(0);
        return;
      }
      if (!liftedRef.current) restingHeight.current = window.height;
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
    if (!lifted) return;
    const frame = requestAnimationFrame(() => {
      liftAboveKeyboard(scrollRef, columnRef, scrollY, keyboardTopRef.current);
    });
    return () => cancelAnimationFrame(frame);
  }, [lifted, keyboardPad]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background, flexDirection: wide ? "row" : "column" }]}>
      {wide ? (
        <View style={[styles.hero, { backgroundColor: "#2a1a0c" }]}>
          <View style={[styles.glow, { backgroundColor: colors.primary, top: -180, left: -140, width: 560, height: 560 }]} />
          <View style={[styles.glow, { backgroundColor: "#f59e0b", bottom: -220, right: -160, width: 520, height: 520, opacity: 0.18 }]} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.heroOverlay }]} />
          <View style={styles.quote}>
            <Text size={20} color="rgba(255,255,255,0.95)" style={{ lineHeight: 30 }}>“{QUOTE}”</Text>
            <View style={styles.quoteBy}>
              <Text size={14} color="#fff">{quoteBy ?? brandTitle}</Text>
            </View>
          </View>
        </View>
      ) : null}
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {topRight ? <View style={[styles.topRight, { top: insets.top + 12 }]}>{topRight}</View> : null}
        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          onScroll={(event) => {
            scrollY.current = event.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
          contentContainerStyle={[
            styles.scroll,
            lifted ? styles.scrollLifted : null,
            {
              paddingTop: insets.top + (lifted ? 48 : 56),
              paddingBottom: (lifted ? 16 : insets.bottom + 24) + keyboardPad,
            },
          ]}
        >
          <View ref={columnRef} style={styles.column}>
            <BrandMark title={brandTitle} subtitle={brandSubtitle} logoUri={logoUri} size={lifted ? "md" : "lg"} />
            <View style={{ gap: lifted ? 8 : 12, marginTop: lifted ? 16 : 28 }}>
              <Text size={wide && !lifted ? 36 : lifted ? 22 : 28} weight="semibold" style={styles.center}>{heading}</Text>
              <Text size={14} muted style={styles.center}>{description}</Text>
            </View>
            <View style={{ marginTop: lifted ? 16 : 28 }}>{children}</View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

export function AuthLoading({ message }: { message: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.fill, styles.loading, { backgroundColor: colors.background }]}>
      <Text muted>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fill: { flex: 1 },
  hero: { width: "48%", overflow: "hidden", justifyContent: "flex-end" },
  glow: { position: "absolute", borderRadius: 999, opacity: 0.42 },
  quote: { padding: 48, gap: 16, maxWidth: 560 },
  quoteBy: { alignSelf: "flex-start", paddingHorizontal: 16, paddingVertical: 6, borderRadius: radius.sm, borderWidth: 1, borderColor: "rgba(255,255,255,0.7)" },
  topRight: { position: "absolute", right: 16, zIndex: 20 },
  scroll: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 20 },
  scrollLifted: { justifyContent: "flex-start" },
  column: { width: "100%", maxWidth: 448, alignSelf: "center" },
  center: { textAlign: "center" },
  loading: { alignItems: "center", justifyContent: "center" },
});
