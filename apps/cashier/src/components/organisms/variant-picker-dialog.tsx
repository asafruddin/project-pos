"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@pos-apps/ui/molecules";
import {
  isValidSellablePrice,
  tracksCatalogStock,
  variantDisplayLabel,
  type CatalogProductRecord,
} from "@pos-apps/local-db";
import { formatIdr } from "@/lib/money";
import type { LangPref } from "@/lib/preferences";
import { copy } from "@/lib/preferences";

export function VariantPickerDialog({
  lang,
  parent,
  variants,
  quantities,
  onPick,
  onClose,
}: {
  lang: LangPref;
  parent: CatalogProductRecord | null;
  variants: CatalogProductRecord[];
  /** productId → qty currently in the cart. */
  quantities: Record<string, number>;
  onPick: (variant: CatalogProductRecord) => void;
  onClose: () => void;
}) {
  const t = copy(lang);
  if (!parent) return null;
  const group = parent.variantGroups?.join(" / ");

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{parent.name}</DialogTitle>
          <DialogDescription>
            {group ? `${t.variantChoose} · ${group}` : t.variantChoose}
          </DialogDescription>
        </DialogHeader>
        <ul className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto">
          {variants.map((v) => {
            const unlimited = !tracksCatalogStock(v);
            const available =
              isValidSellablePrice(v.priceMinor) && (unlimited || v.stockQty > 0);
            const inCart = quantities[v.productId] ?? 0;
            return (
              <li key={v.productId}>
                <button
                  type="button"
                  disabled={!available}
                  onClick={() => onPick(v)}
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-border px-4 py-3 text-left transition-colors hover:border-primary/40 hover:bg-accent/40 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">
                      {variantDisplayLabel(v, parent)}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {available
                        ? unlimited
                          ? t.stockUnlimited
                          : `${t.stock} ${v.stockQty}`
                        : t.stockOut}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {inCart > 0 ? (
                      <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">
                        {inCart}
                      </span>
                    ) : null}
                    <span className="font-medium">{formatIdr(v.priceMinor, lang)}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
