import { useSyncExternalStore } from "react";
import type { PrintQueue } from "@/features/receipt/domain/print-queue";

export function usePrinterQueue(queue: PrintQueue): number {
  return useSyncExternalStore(
    (cb) => queue.onChange(cb),
    () => queue.pendingCount(),
  );
}
