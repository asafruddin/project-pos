import { useSyncExternalStore } from "react";
import type { Printer, PrinterStatus } from "@/features/receipt/domain/printer";

export function usePrinterStatus(printer: Printer): PrinterStatus {
  return useSyncExternalStore(
    (cb) => printer.subscribe(cb),
    () => printer.getStatus(),
  );
}
