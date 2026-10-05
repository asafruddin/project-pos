import { useNavigation } from "@react-navigation/native";
import { useState } from "react";
import { useStore } from "zustand";
import { Button, Dialog } from "@/components/ui";
import { useContainer } from "@/core/di/container-context";
import { useT } from "@/i18n";
import type { AppNavigation } from "@/navigators/navigationTypes";

/**
 * One sign-out path for every entry point (account sheet, sidebar, settings, open-shift dialog):
 * an open shift must be closed first (Shift screen, intent `logout`), and unsynced data gets a warning
 * because it cannot upload from this device until the next login.
 */
export function useSignOut() {
  const container = useContainer();
  const navigation = useNavigation<AppNavigation>();
  const { t } = useT();
  const pending = useStore(container.syncStatus, (s) => s.pending + s.dead);
  const [confirm, setConfirm] = useState(false);

  function proceed() {
    setConfirm(false);
    if (container.requestLogout() === "needs-shift-close") navigation.navigate("Shift");
  }

  const request = () => {
    // With an open shift the warning is premature: closing the shift comes first.
    if (pending > 0 && container.repositories.shifts.getOpen() === null) setConfirm(true);
    else proceed();
  };

  const dialog = (
    <Dialog
      open={confirm}
      onClose={() => setConfirm(false)}
      title={t("logoutUnsyncedTitle")}
      description={t("logoutUnsyncedBody", { n: pending })}
      footer={
        <>
          <Button variant="secondary" label={t("cancel")} onPress={() => setConfirm(false)} />
          <Button variant="destructive" label={t("logoutAnyway")} onPress={proceed} />
        </>
      }
    />
  );

  return { request, dialog };
}
