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
 * Port for the receipt printer. Production: `BluetoothPrinter` (classic SPP).
 * Tests inject `StubPrinter`.
 */
export interface Printer {
  getStatus(): PrinterStatus;
  subscribe(listener: (status: PrinterStatus) => void): () => void;
  /** Idempotent; resolves when connected, rejects with `AppError("PRINTER")`. */
  connect(): Promise<void>;
  /** Resolves once the bytes were accepted by the printer. */
  print(bytes: Uint8Array): Promise<void>;
  /**
   * When `true`, stay connected and reconnect on drop until logout / app close.
   * When `false`, drop the socket.
   */
  keepAlive(enabled: boolean): void;
  /** Drop the socket. Saved printer stays remembered. */
  disconnect(): Promise<void>;
}

export const isPrinterReady = (s: PrinterStatus) =>
  s.state === "connected" || s.state === "printing";

export type PrinterDevice = {
  id: string;
  name: string;
  bonded: boolean;
};

/** Extra Settings actions on the Bluetooth adapter. */
export interface PrinterDiscovery {
  scan(timeoutMs?: number): Promise<PrinterDevice[]>;
  pair(device: PrinterDevice): Promise<void>;
  forget(): Promise<void>;
}

export function hasPrinterDiscovery(printer: Printer): printer is Printer & PrinterDiscovery {
  const candidate = printer as Printer & Partial<PrinterDiscovery>;
  return typeof candidate.scan === "function" && typeof candidate.pair === "function" && typeof candidate.forget === "function";
}
