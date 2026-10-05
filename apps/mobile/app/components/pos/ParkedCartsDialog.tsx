import { View } from "react-native";
import { Button, Dialog, PlayIcon, Text, TrashSimpleIcon } from "@/components/ui";
import type { ParkedCart } from "@/features/cart/domain/parked-cart";
import { useT } from "@/i18n";
import { radius, useTheme } from "@/theme";
import { formatIdr } from "@/utils/money";

function label(parked: ParkedCart): string {
  const first = parked.lines[0]?.name ?? "";
  const extra = parked.lines.length - 1;
  return extra > 0 ? `${first} +${extra}` : first;
}

export function ParkedCartsDialog({
  open,
  carts,
  busy,
  onClose,
  onResume,
  onDiscard,
}: {
  open: boolean;
  carts: ParkedCart[];
  busy: boolean;
  onClose: () => void;
  onResume: (parkId: string) => void;
  onDiscard: (parkId: string) => void;
}) {
  const { t, lang } = useT();
  const { colors } = useTheme();
  return (
    <Dialog open={open} onClose={onClose} title={t("parked")} description={t("parkedDialogHint")} maxWidth={512}>
      <View style={{ gap: 8 }}>
        {carts.map((row) => (
          <View key={row.parkId} style={{ borderWidth: 1, borderColor: colors.border, backgroundColor: `${colors.secondary}66`, borderRadius: radius.xl, padding: 12, gap: 8 }}>
            <View>
              <Text weight="medium" numberOfLines={1}>{label(row)}</Text>
              <Text size={13} muted>
                {formatIdr(row.totalMinor, lang)} · {t("holdLineCount", { count: row.lines.reduce((s, l) => s + l.qty, 0) })}
                {row.customerName ? ` · ${row.customerName}` : ""}
              </Text>
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Button
                variant="outline"
                label={t("resumeHold")}
                disabled={busy}
                icon={<PlayIcon size={16} weight="bold" color={colors.foreground} />}
                onPress={() => onResume(row.parkId)}
                style={{ flex: 1, minHeight: 48 }}
              />
              <Button
                variant="ghost"
                size="icon"
                disabled={busy}
                accessibilityLabel={`${t("discardHold")} ${label(row)}`}
                icon={<TrashSimpleIcon size={18} weight="bold" color={colors.destructive} />}
                onPress={() => onDiscard(row.parkId)}
                style={{ minHeight: 48, minWidth: 48 }}
              />
            </View>
          </View>
        ))}
      </View>
    </Dialog>
  );
}
