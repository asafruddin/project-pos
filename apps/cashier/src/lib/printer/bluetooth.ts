import {
  clearSavedBlePrinter,
  getSavedBlePrinter,
  setSavedBlePrinter,
} from "./storage";
import type { SavedBlePrinter } from "./types";

type BleCharacteristic = {
  uuid: string;
  properties: { write: boolean; writeWithoutResponse: boolean };
  writeValue(value: BufferSource): Promise<void>;
  writeValueWithResponse?(value: BufferSource): Promise<void>;
  writeValueWithoutResponse?(value: BufferSource): Promise<void>;
};

type BleService = {
  uuid: string;
  getCharacteristics(): Promise<BleCharacteristic[]>;
  getCharacteristic(characteristic: string): Promise<BleCharacteristic>;
};

type BleServer = {
  connected: boolean;
  connect(): Promise<BleServer>;
  getPrimaryServices(): Promise<BleService[]>;
  getPrimaryService(service: string): Promise<BleService>;
};

type BleDevice = {
  id: string;
  name?: string;
  gatt?: BleServer;
};

type BleApi = {
  requestDevice(options: {
    acceptAllDevices?: boolean;
    optionalServices?: string[];
    filters?: Array<{ name?: string; namePrefix?: string; services?: string[] }>;
  }): Promise<BleDevice>;
  getDevices?(): Promise<BleDevice[]>;
  getAvailability?(): Promise<boolean>;
};

/** Common BLE ESC/POS / UART services on 58mm printers. */
const OPTIONAL_SERVICES = [
  "000018f0-0000-1000-8000-00805f9b34fb",
  "0000ff00-0000-1000-8000-00805f9b34fb",
  "0000ff10-0000-1000-8000-00805f9b34fb",
  "0000fff0-0000-1000-8000-00805f9b34fb",
  "0000ffe0-0000-1000-8000-00805f9b34fb",
  "0000ae30-0000-1000-8000-00805f9b34fb",
  "0000af00-0000-1000-8000-00805f9b34fb",
  "6e400001-b5a3-f393-e0a9-e50e24dcca9e",
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
  "49535343-fe7d-4ae5-8fa9-9fafd205e455",
];

const CHUNK = 20;
const CHUNK_GAP_MS = 20;

export function canUseWebBluetooth(): boolean {
  return typeof navigator !== "undefined" && Boolean(bluetoothApi());
}

export class PrinterPairCancelledError extends Error {
  constructor() {
    super("PRINTER_PAIR_CANCELLED");
    this.name = "PrinterPairCancelledError";
  }
}

export class PrinterAdapterError extends Error {
  constructor() {
    super("PRINTER_ADAPTER_UNAVAILABLE");
    this.name = "PrinterAdapterError";
  }
}

export class PrinterGestureError extends Error {
  constructor() {
    super("PRINTER_USER_GESTURE_REQUIRED");
    this.name = "PrinterGestureError";
  }
}

export class PrinterInsecureError extends Error {
  constructor() {
    super("PRINTER_INSECURE_CONTEXT");
    this.name = "PrinterInsecureError";
  }
}

export class PrinterChooserBlockedError extends Error {
  constructor(detail?: string) {
    super(detail || "PRINTER_CHOOSER_BLOCKED");
    this.name = "PrinterChooserBlockedError";
  }
}

export class PrinterReconnectError extends Error {
  constructor() {
    super("PRINTER_NEED_PAIR_AGAIN");
    this.name = "PrinterReconnectError";
  }
}

function errorName(error: unknown): string {
  if (error instanceof DOMException || error instanceof Error) return error.name;
  return "";
}

function errorMessage(error: unknown): string {
  if (error instanceof DOMException || error instanceof Error) return error.message;
  return "";
}

function classifyRequestDeviceError(error: unknown): Error {
  const name = errorName(error);
  const message = errorMessage(error);
  if (name === "SecurityError" || name === "NotAllowedError") {
    return new PrinterGestureError();
  }
  if (name === "NotFoundError") {
    if (/cancel|chooser/i.test(message) && !/adapter/i.test(message)) {
      return new PrinterPairCancelledError();
    }
    return new PrinterChooserBlockedError(message);
  }
  return error instanceof Error ? error : new Error("PRINTER_PAIR_FAIL");
}

export type BluetoothEnvironment = {
  supported: boolean;
  secure: boolean;
  chromeFamily: boolean;
  available: boolean | null;
};

export function getBluetoothEnvironment(): Omit<BluetoothEnvironment, "available"> {
  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
  const chromeFamily =
    /\b(Chrome|Chromium|Edg|OPR)\//.test(ua) &&
    !/iPhone|iPad|iPod/.test(ua) &&
    !/Electron/i.test(ua);
  return {
    supported: canUseWebBluetooth(),
    secure: typeof window !== "undefined" && window.isSecureContext,
    chromeFamily,
  };
}

export async function getBluetoothAvailability(): Promise<boolean | null> {
  const api = bluetoothApi();
  if (!api?.getAvailability) return null;
  try {
    return await api.getAvailability();
  } catch {
    return null;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function bluetoothApi(): BleApi | undefined {
  if (typeof navigator === "undefined") return undefined;
  return (navigator as Navigator & { bluetooth?: BleApi }).bluetooth;
}

function bluetooth(): BleApi {
  const api = bluetoothApi();
  if (!api) {
    throw new Error("PRINTER_UNSUPPORTED");
  }
  return api;
}

async function pickWritable(
  server: BleServer,
  preferred?: { serviceUuid?: string; characteristicUuid?: string },
): Promise<{
  serviceUuid: string;
  characteristic: BleCharacteristic;
}> {
  if (preferred?.serviceUuid && preferred.characteristicUuid) {
    try {
      const service = await server.getPrimaryService(preferred.serviceUuid);
      const characteristic = await service.getCharacteristic(
        preferred.characteristicUuid,
      );
      if (
        characteristic.properties.writeWithoutResponse ||
        characteristic.properties.write
      ) {
        return { serviceUuid: preferred.serviceUuid, characteristic };
      }
    } catch {
      // Fall through to a scan of known services.
    }
  }

  for (const uuid of OPTIONAL_SERVICES) {
    try {
      const service = await server.getPrimaryService(uuid);
      const characteristics = await service.getCharacteristics();
      const writable = characteristics.find(
        (row) => row.properties.writeWithoutResponse || row.properties.write,
      );
      if (writable) {
        return { serviceUuid: uuid, characteristic: writable };
      }
    } catch {
      // Service not present on this printer.
    }
  }

  try {
    const services = await server.getPrimaryServices();
    for (const service of services) {
      const characteristics = await service.getCharacteristics();
      const writable = characteristics.find(
        (row) => row.properties.writeWithoutResponse || row.properties.write,
      );
      if (writable) {
        return { serviceUuid: service.uuid, characteristic: writable };
      }
    }
  } catch {
    // Some browsers only expose services listed in optionalServices.
  }

  throw new Error("PRINTER_NO_WRITE_CHARACTERISTIC");
}

async function connectDevice(device: BleDevice): Promise<BleServer> {
  const server = device.gatt;
  if (!server) {
    throw new Error("PRINTER_NO_GATT");
  }
  if (server.connected) return server;
  return server.connect();
}

async function writeChunks(
  characteristic: BleCharacteristic,
  payload: Uint8Array,
): Promise<void> {
  for (let offset = 0; offset < payload.length; offset += CHUNK) {
    const slice = payload.slice(offset, offset + CHUNK);
    if (
      characteristic.properties.writeWithoutResponse &&
      characteristic.writeValueWithoutResponse
    ) {
      await characteristic.writeValueWithoutResponse(slice);
    } else if (characteristic.writeValueWithResponse) {
      await characteristic.writeValueWithResponse(slice);
    } else {
      await characteristic.writeValue(slice);
    }
    if (offset + CHUNK < payload.length) {
      await delay(CHUNK_GAP_MS);
    }
  }
}

/**
 * Must be called in the same synchronous turn as a click so Chrome can open
 * the chooser. Do not `await` anything before this returns its Promise.
 *
 * Chrome never shows a site “Allow Bluetooth?” bar. The device chooser is the
 * permission UI. If it never appears, Chromium aborted (no adapter, OS block,
 * or an embedded browser that cannot host the chooser).
 */
export function pairBluetoothPrinter(): Promise<SavedBlePrinter> {
  if (typeof window !== "undefined" && !window.isSecureContext) {
    return Promise.reject(new PrinterInsecureError());
  }
  const api = bluetooth();
  const devicePromise = api.requestDevice({
    acceptAllDevices: true,
    optionalServices: OPTIONAL_SERVICES,
  });
  return finishPairing(devicePromise);
}

async function finishPairing(
  devicePromise: Promise<BleDevice>,
): Promise<SavedBlePrinter> {
  let device: BleDevice;
  try {
    device = await devicePromise;
  } catch (error) {
    throw classifyRequestDeviceError(error);
  }

  const server = await connectDevice(device);
  const picked = await pickWritable(server);
  const saved: SavedBlePrinter = {
    id: device.id,
    name: device.name?.trim() || "Printer",
    serviceUuid: picked.serviceUuid,
    characteristicUuid: picked.characteristic.uuid,
  };
  setSavedBlePrinter(saved);
  return saved;
}

async function resolveSavedDevice(
  saved: SavedBlePrinter,
): Promise<BleDevice> {
  const api = bluetooth();
  if (typeof api.getDevices !== "function") {
    throw new PrinterReconnectError();
  }
  const devices = await api.getDevices();
  const device = devices.find((row) => row.id === saved.id);
  if (!device) {
    throw new PrinterReconnectError();
  }
  return device;
}

export async function printBytesToSavedPrinter(
  payload: Uint8Array,
): Promise<void> {
  const saved = getSavedBlePrinter();
  if (!saved) {
    throw new PrinterReconnectError();
  }
  const device = await resolveSavedDevice(saved);
  const server = await connectDevice(device);
  const picked = await pickWritable(server, {
    serviceUuid: saved.serviceUuid,
    characteristicUuid: saved.characteristicUuid,
  });
  if (
    picked.serviceUuid !== saved.serviceUuid ||
    picked.characteristic.uuid !== saved.characteristicUuid
  ) {
    setSavedBlePrinter({
      ...saved,
      serviceUuid: picked.serviceUuid,
      characteristicUuid: picked.characteristic.uuid,
    });
  }
  await writeChunks(picked.characteristic, payload);
}

export { clearSavedBlePrinter, getSavedBlePrinter, setSavedBlePrinter };
export type { SavedBlePrinter };
