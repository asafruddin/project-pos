import type { KvStore } from "@/infrastructure/db/kv-store";
import type { Printer } from "@/features/receipt/domain/printer";
import type { AppStateSource } from "@/infrastructure/sync/app-state-source";
import { BluetoothPrinter, type BluetoothPrinterBridge } from "./bluetooth-printer";
import { StubPrinter } from "./stub-printer";

function loadNativePrinter(): BluetoothPrinterBridge | null {
  try {
    // `require("expo")` pulls the Expo barrel and can recurse on Hermes at boot.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const core = require("expo-modules-core") as {
      requireOptionalNativeModule?: (name: string) => BluetoothPrinterBridge | null;
    };
    return core.requireOptionalNativeModule?.("PosPrinter") ?? null;
  } catch {
    return null;
  }
}

/** Native SPP printer when the Expo module is linked; stub otherwise (tests, old APK). */
export function createDefaultPrinter(kv: KvStore, appState?: AppStateSource): Printer {
  const native = loadNativePrinter();
  if (!native || typeof native.scan !== "function") return new StubPrinter();
  return new BluetoothPrinter(native, kv, appState);
}
