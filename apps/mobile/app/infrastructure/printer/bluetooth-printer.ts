import { AppError } from "@/core/errors/app-error";
import type { KvStore } from "@/infrastructure/db/kv-store";
import type { AppStateSource } from "@/infrastructure/sync/app-state-source";
import { bytesToBase64 } from "@/utils/base64";
import { requestBluetoothPermissions } from "./bluetooth-permissions";
import { isPrinterReady, type Printer, type PrinterDevice, type PrinterDiscovery, type PrinterStatus } from "@/features/receipt/domain/printer";

export type NativePrinterDevice = {
  id: string;
  name: string;
  bonded: boolean;
};

export type BluetoothPrinterBridge = {
  scan(timeoutMs: number): Promise<NativePrinterDevice[]>;
  connect(address: string): Promise<NativePrinterDevice>;
  disconnect(): Promise<void>;
  print(payloadB64: string): Promise<void>;
  isConnected?: () => Promise<boolean>;
  setStayConnected?: (enabled: boolean) => Promise<void>;
  addListener?: (event: string, listener: (event: { address?: string }) => void) => { remove(): void };
};

export const PRINTER_ADDRESS_KEY = "printer.address";
export const PRINTER_NAME_KEY = "printer.name";

const RETRY_MS = 1_500;

/**
 * Classic Bluetooth (SPP) receipt printer. Remembers the last MAC in kv and
 * keeps the socket open until logout or app close.
 */
export class BluetoothPrinter implements Printer, PrinterDiscovery {
  private status: PrinterStatus;
  private listeners = new Set<(s: PrinterStatus) => void>();
  private alive = false;
  private connecting: Promise<void> | null = null;
  private retry: ReturnType<typeof setTimeout> | null = null;
  private unsubFg: (() => void) | null = null;
  private unsubNative: { remove(): void } | null = null;

  constructor(
    private readonly native: BluetoothPrinterBridge,
    private readonly kv: KvStore,
    private readonly appState?: AppStateSource,
  ) {
    const name = kv.get(PRINTER_NAME_KEY);
    const address = kv.get(PRINTER_ADDRESS_KEY);
    this.status = address
      ? { state: "disconnected", name: name || address, detail: null }
      : { state: "unconfigured", name: null, detail: null };
    this.unsubNative = native.addListener?.("onDisconnected", () => {
      if (!this.kv.get(PRINTER_ADDRESS_KEY)) return;
      if (this.status.state === "unconfigured") return;
      this.set({ state: "disconnected", name: this.status.name, detail: "DROPPED" });
      this.scheduleRetry();
    }) ?? null;
  }

  getStatus(): PrinterStatus {
    return this.status;
  }

  subscribe(listener: (status: PrinterStatus) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async scan(timeoutMs = 8_000): Promise<PrinterDevice[]> {
    await this.ensurePermission();
    try {
      const devices = await this.native.scan(timeoutMs);
      return devices.map(toDevice);
    } catch (error) {
      throw toPrinterError(error);
    }
  }

  async pair(device: PrinterDevice): Promise<void> {
    await this.ensurePermission();
    this.set({ state: "connecting", name: device.name, detail: null });
    try {
      const connected = await this.native.connect(device.id);
      this.save(connected);
      this.set({ state: "connected", name: connected.name, detail: null });
    } catch (error) {
      this.set({ state: "error", name: device.name, detail: codeOf(error) });
      this.scheduleRetry();
      throw toPrinterError(error);
    }
  }

  async forget(): Promise<void> {
    this.clearRetry();
    try {
      await this.native.disconnect();
    } catch {
      // Clearing the saved printer still succeeds if the socket is already gone.
    }
    this.kv.delete(PRINTER_ADDRESS_KEY);
    this.kv.delete(PRINTER_NAME_KEY);
    this.set({ state: "unconfigured", name: null, detail: null });
  }

  keepAlive(enabled: boolean): void {
    this.alive = enabled;
    void this.native.setStayConnected?.(enabled);
    if (!enabled) {
      this.unsubFg?.();
      this.unsubFg = null;
      void this.disconnect();
      return;
    }
    this.unsubFg ??= this.appState?.onForeground(() => {
      void this.ensureConnected();
    }) ?? null;
    void this.ensureConnected();
  }

  async connect(): Promise<void> {
    if (this.native.isConnected) {
      if (await this.native.isConnected()) {
        if (!isPrinterReady(this.status)) {
          this.set({ state: "connected", name: this.kv.get(PRINTER_NAME_KEY) || this.status.name, detail: null });
        }
        return;
      }
      if (isPrinterReady(this.status)) {
        this.set({ state: "disconnected", name: this.status.name, detail: "DROPPED" });
      }
    } else if (isPrinterReady(this.status)) {
      return;
    }
    if (this.connecting) return this.connecting;
    this.connecting = this.openSocket().finally(() => {
      this.connecting = null;
    });
    return this.connecting;
  }

  async disconnect(): Promise<void> {
    this.clearRetry();
    try {
      await this.native.disconnect();
    } catch {
      // Already closed.
    }
    const address = this.kv.get(PRINTER_ADDRESS_KEY);
    const name = this.kv.get(PRINTER_NAME_KEY) || this.status.name;
    this.set(
      address
        ? { state: "disconnected", name: name || address, detail: null }
        : { state: "unconfigured", name: null, detail: null },
    );
  }

  async print(bytes: Uint8Array): Promise<void> {
    const name = this.kv.get(PRINTER_NAME_KEY) || this.status.name;
    if (!isPrinterReady(this.status)) {
      await this.connect();
    }
    this.set({ state: "printing", name, detail: null });
    try {
      await this.native.print(bytesToBase64(bytes));
      this.set({ state: "connected", name, detail: null });
      if (this.alive) void this.ensureConnected();
    } catch (error) {
      this.set({ state: "error", name, detail: codeOf(error) });
      this.scheduleRetry();
      throw toPrinterError(error);
    }
  }

  private async ensureConnected(): Promise<void> {
    if (!this.alive || !this.kv.get(PRINTER_ADDRESS_KEY)) return;
    if (this.status.state === "connecting") return;
    try {
      if (this.native.isConnected && (await this.native.isConnected())) {
        if (!isPrinterReady(this.status)) {
          this.set({ state: "connected", name: this.kv.get(PRINTER_NAME_KEY) || this.status.name, detail: null });
        }
        return;
      }
      await this.connect();
    } catch {
      this.scheduleRetry();
    }
  }

  private async openSocket(): Promise<void> {
    const address = this.kv.get(PRINTER_ADDRESS_KEY);
    const name = this.kv.get(PRINTER_NAME_KEY) || address;
    if (!address) throw new AppError("PRINTER", "PRINTER_UNCONFIGURED");
    await this.ensurePermission();
    this.set({ state: "connecting", name, detail: null });
    try {
      const connected = await this.native.connect(address);
      this.save(connected);
      this.set({ state: "connected", name: connected.name, detail: null });
    } catch (error) {
      this.set({ state: "disconnected", name, detail: codeOf(error) });
      this.scheduleRetry();
      throw toPrinterError(error);
    }
  }

  private scheduleRetry(): void {
    if (!this.alive || this.retry || !this.kv.get(PRINTER_ADDRESS_KEY)) return;
    this.retry = setTimeout(() => {
      this.retry = null;
      void this.ensureConnected();
    }, RETRY_MS);
  }

  private clearRetry(): void {
    if (this.retry) clearTimeout(this.retry);
    this.retry = null;
  }

  private save(device: NativePrinterDevice): void {
    this.kv.set(PRINTER_ADDRESS_KEY, device.id);
    this.kv.set(PRINTER_NAME_KEY, device.name);
  }

  private async ensurePermission(): Promise<void> {
    const result = await requestBluetoothPermissions();
    if (result === "denied") throw new AppError("PRINTER", "BT_PERMISSION");
    if (result === "unavailable") throw new AppError("PRINTER", "NATIVE_UNAVAILABLE");
  }

  private set(next: PrinterStatus): void {
    if (this.status.state === next.state && this.status.name === next.name && this.status.detail === next.detail) return;
    this.status = next;
    for (const listener of this.listeners) listener(next);
  }
}

function toDevice(device: NativePrinterDevice): PrinterDevice {
  return { id: device.id, name: device.name, bonded: Boolean(device.bonded) };
}

function codeOf(error: unknown): string {
  if (error && typeof error === "object" && "code" in error && typeof error.code === "string") {
    return error.code.replace(/^ERR_/, "");
  }
  if (error instanceof AppError) return error.message;
  if (error instanceof Error) {
    const match = error.message.match(/\b(BT_[A-Z_]+|NOT_CONNECTED|NATIVE_UNAVAILABLE|BT_PERMISSION)\b/);
    if (match) return match[1];
  }
  return "PRINTER";
}

function toPrinterError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  return new AppError("PRINTER", codeOf(error));
}
