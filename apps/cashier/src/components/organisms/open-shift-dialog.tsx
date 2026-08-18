"use client";

import { Button, Input, Label } from "@pos-apps/ui/atoms";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@pos-apps/ui/molecules";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { openLocalShift } from "@pos-apps/local-db";
import { flushSalesAndVoids } from "@/lib/flush-sync";
import { requestLogout } from "@/lib/logout";
import { copy, type LangPref } from "@/lib/preferences";
import { parseGroupedInt } from "@/lib/money";
import { notifyShiftChanged } from "@/lib/shift-events";

export function OpenShiftDialog({
  lang,
  onOpened,
}: {
  lang: LangPref;
  onOpened?: () => void;
}) {
  const t = copy(lang);
  const router = useRouter();
  const [cash, setCash] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onOpen(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const opening = parseGroupedInt(cash);
    if (cash.trim() === "" || !Number.isInteger(opening) || opening < 0) {
      setError(t.shiftOpeningRequired);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await openLocalShift(opening);
      await flushSalesAndVoids();
      notifyShiftChanged();
      onOpened?.();
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      if (code === "SHIFT_ALREADY_OPEN") {
        notifyShiftChanged();
        onOpened?.();
        return;
      }
      setError(t.shiftOpenFail);
    } finally {
      setBusy(false);
    }
  }

  function logout() {
    void requestLogout(router);
  }

  return (
    <Dialog open onOpenChange={() => undefined}>
      <DialogContent
        showCloseButton={false}
        onPointerDownOutside={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => event.preventDefault()}
        className="sm:max-w-md"
      >
        <form onSubmit={(e) => void onOpen(e)} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{t.shiftOpen}</DialogTitle>
            <DialogDescription>{t.shiftOpeningHint}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="opening-cash">{t.shiftOpeningCash}</Label>
            <Input
              id="opening-cash"
              inputMode="numeric"
              value={cash}
              onChange={(e) => {
                setCash(e.target.value);
                setError(null);
              }}
              required
              autoFocus
              aria-invalid={error ? true : undefined}
            />
          </div>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <DialogFooter className="sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={logout}
              disabled={busy}
            >
              {t.logout}
            </Button>
            <Button type="submit" disabled={busy} className="min-w-32">
              {busy ? t.pending : t.shiftOpen}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
