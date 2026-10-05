import { useRef, useState } from "react";
import { View } from "react-native";
import { PinPad } from "@/components/layout";
import { BottomSheet, Button, Dialog, Text } from "@/components/ui";
import { useT } from "@/i18n";
import { useTheme } from "@/theme";

/** PIN sheet for voiding a sale: enrol a manager PIN the first time, then unlock with it. */
export function ManagerPinSheet({
  mode,
  error,
  busy,
  onSubmit,
  onCancel,
}: {
  mode: "enroll" | "unlock" | null;
  error: string | null;
  busy: boolean;
  onSubmit: (pin: string) => void;
  onCancel: () => void;
}) {
  const { t } = useT();
  const { colors } = useTheme();
  const [pin, setPin] = useState("");
  const last = useRef<string | null>(null);
  const cancel = () => {
    setPin("");
    last.current = null;
    onCancel();
  };

  return (
    <BottomSheet open={mode !== null} onClose={cancel} locked={busy} title={t("voidNeedPin")} description={mode === "enroll" ? t("voidPinEnroll") : t("voidPinUnlock")}>
      {error ? <Text color={colors.destructive} accessibilityRole="alert">{error}</Text> : null}
      <PinPad
        value={pin}
        label={t("pinInputLabel")}
        disabled={busy}
        onChange={(next) => {
          setPin(next);
          if (next.length === 6 && last.current !== next) {
            last.current = next;
            onSubmit(next);
            // Start clean for the next attempt (wrong PIN / lock) — the parent shows the result.
            setPin("");
            last.current = null;
          }
          if (next.length < 6) last.current = null;
        }}
      />
      <Button variant="ghost" size="lg" label={t("voidPinCancel")} disabled={busy} onPress={cancel} />
    </BottomSheet>
  );
}

/** Plain confirmation for users who may void without a PIN (sales:void_unattended). */
export function ConfirmVoidDialog({ open, busy, onConfirm, onCancel }: { open: boolean; busy: boolean; onConfirm: () => void; onCancel: () => void }) {
  const { t } = useT();
  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onCancel}
      title={t("voidTitle")}
      description={t("voidHint")}
      footer={
        <>
          <Button variant="secondary" label={t("cancel")} disabled={busy} onPress={onCancel} />
          <Button variant="destructive" label={busy ? t("pending") : t("voidAction")} loading={busy} onPress={onConfirm} />
        </>
      }
    >
      <View />
    </Dialog>
  );
}
