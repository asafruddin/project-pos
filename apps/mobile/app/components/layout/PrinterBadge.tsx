import { useContainer } from "@/core/di/container-context";
import type { PrinterState } from "@/features/receipt/domain/printer";
import { usePrinterStatus } from "@/infrastructure/printer/use-printer-status";
import { useT, type TranslationKey } from "@/i18n";
import { StatusPill, type Tone } from "@/components/ui";

const view: Record<PrinterState, { label: TranslationKey; tone: Tone }> = {
  unconfigured: { label: "printerNone", tone: "neutral" },
  disconnected: { label: "printerDisconnected", tone: "danger" },
  connecting: { label: "printerConnecting", tone: "warning" },
  connected: { label: "printerConnected", tone: "success" },
  printing: { label: "printerConnected", tone: "success" },
  error: { label: "printerError", tone: "danger" },
};

export function PrinterBadge() {
  const status = usePrinterStatus(useContainer().printer);
  const { t } = useT();
  const { label, tone } = view[status.state];
  return <StatusPill label={t(label)} tone={tone} />;
}
