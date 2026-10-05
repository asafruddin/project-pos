import { Button, Dialog, Text } from "@/components/ui";
import type { CatalogProduct } from "@/features/catalog/domain/product";
import { useT } from "@/i18n";
import { useTheme } from "@/theme";

/** Confirm opening one pack into pieces (online). Shows the server's message if it refuses. */
export function UnpackDialog({
  product,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  product: CatalogProduct | null;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useT();
  const { colors } = useTheme();
  const conversion = product?.unitConversion;
  if (!product || !conversion) return null;
  const packUnit = conversion.fromUnitName || t("unpackPackFallback");
  const pcsUnit = product.unitName || t("unpackPcsFallback");
  return (
    <Dialog
      open
      onClose={busy ? undefined : onCancel}
      title={t("unpackTitle")}
      description={t("unpackBody", {
        pcsUnit,
        fromQty: conversion.fromQty,
        packUnit,
        name: conversion.fromProductName,
        toQty: conversion.toQty,
      })}
      footer={
        <>
          <Button variant="secondary" label={t("unpackCancel")} disabled={busy} onPress={onCancel} />
          <Button label={busy ? t("pending") : t("unpackConfirm")} loading={busy} onPress={onConfirm} />
        </>
      }
    >
      {error ? <Text color={colors.destructive} accessibilityRole="alert">{error}</Text> : null}
    </Dialog>
  );
}
