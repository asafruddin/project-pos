export type PrinterState =
  | "unconfigured" // no printer chosen yet
  | "disconnected"
  | "connecting"
  | "connected"
  | "printing"
  | "error";

export type PrinterStatus = {
  state: PrinterState;
  name: string | null;
  detail: string | null;
};

/**
 * Port for the receipt printer. Today: `StubPrinter`. Next: a native Expo
 * module (Bluetooth SPP + foreground service) implementing this same contract
 * — see docs/02-mobile/printer.md.
 */
export interface Printer {
  getStatus(): PrinterStatus;
  subscribe(listener: (status: PrinterStatus) => void): () => void;
  /** Idempotent; resolves when connected, rejects with `AppError("PRINTER")`. */
  connect(): Promise<void>;
  /** Resolves once the bytes were accepted by the printer. */
  print(bytes: Uint8Array): Promise<void>;
}

export const isPrinterReady = (s: PrinterStatus) =>
  s.state === "connected" || s.state === "printing";
