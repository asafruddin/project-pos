"use client";

import { Button } from "@pos-apps/ui/atoms";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@pos-apps/ui/molecules";
import type { CatalogProductRecord } from "@pos-apps/local-db";
import type { LangPref } from "@/lib/preferences";
import { copy } from "@/lib/preferences";

export function UnpackConfirmDialog({
  lang,
  product,
  open,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  lang: LangPref;
  product: CatalogProductRecord | null;
  open: boolean;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const t = copy(lang);
  const conversion = product?.unitConversion;
  if (!product || !conversion) return null;

  const packUnit = conversion.fromUnitName || t.unpackPackFallback;
  const pcsUnit = product.unitName || t.unpackPcsFallback;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !busy) onCancel();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.unpackTitle}</DialogTitle>
          <DialogDescription>
            {t.unpackBody
              .replaceAll("{pcsUnit}", pcsUnit)
              .replaceAll("{fromQty}", String(conversion.fromQty))
              .replaceAll("{packUnit}", packUnit)
              .replaceAll("{name}", conversion.fromProductName)
              .replaceAll("{toQty}", String(conversion.toQty))}
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={onCancel}
          >
            {t.unpackCancel}
          </Button>
          <Button type="button" disabled={busy} onClick={onConfirm}>
            {busy ? t.pending : t.unpackConfirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
