import type { ReactNode } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { radius, useTheme } from "@/theme";
import { Text } from "./Text";

export type DialogProps = {
  open: boolean;
  /** Called on backdrop tap / hardware back. Omit (or set `dismissable={false}`) for blocking dialogs. */
  onClose?: () => void;
  dismissable?: boolean;
  title?: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  /** Max width in dp (PWA: `sm:max-w-md` = 448, receipt/parked: `max-w-lg` = 512). */
  maxWidth?: number;
};

/** Centered modal dialog (PWA `Dialog`). Scrolls when content is taller than the screen. */
export function Dialog({ open, onClose, dismissable = true, title, description, children, footer, maxWidth = 448 }: DialogProps) {
  const { colors } = useTheme();
  const close = dismissable ? onClose : undefined;
  return (
    <Modal visible={open} transparent animationType="fade" statusBarTranslucent onRequestClose={close}>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <Pressable style={[styles.backdrop, { backgroundColor: colors.overlay }]} onPress={close} accessibilityLabel="Close dialog" accessible={false} />
        <View style={styles.center} pointerEvents="box-none">
          <View
            accessibilityViewIsModal
            style={[
              styles.card,
              { maxWidth, backgroundColor: colors.popover, borderColor: colors.border, borderRadius: radius.xl },
            ]}
          >
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body} bounces={false}>
              {title || description ? (
                <View style={styles.header}>
                  {title ? <Text size={18} weight="semibold" color={colors.popoverForeground}>{title}</Text> : null}
                  {description ? <Text size={14} muted>{description}</Text> : null}
                </View>
              ) : null}
              {children}
            </ScrollView>
            {footer ? <View style={styles.footer}>{footer}</View> : null}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  backdrop: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 16 },
  card: { width: "100%", maxHeight: "90%", borderWidth: 1, overflow: "hidden" },
  body: { padding: 20, gap: 16 },
  header: { gap: 6 },
  footer: { flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end", gap: 8, paddingHorizontal: 20, paddingBottom: 20, paddingTop: 4 },
});
