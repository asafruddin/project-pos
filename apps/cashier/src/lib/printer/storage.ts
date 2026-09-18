import type { SavedBlePrinter } from "./types";

const PRINTER_KEY = "pos_cashier_ble_printer";

export function getSavedBlePrinter(): SavedBlePrinter | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(PRINTER_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SavedBlePrinter;
    if (!parsed || typeof parsed.id !== "string" || !parsed.id) return null;
    return {
      id: parsed.id,
      name: typeof parsed.name === "string" && parsed.name ? parsed.name : "Printer",
      serviceUuid:
        typeof parsed.serviceUuid === "string" ? parsed.serviceUuid : undefined,
      characteristicUuid:
        typeof parsed.characteristicUuid === "string"
          ? parsed.characteristicUuid
          : undefined,
    };
  } catch {
    return null;
  }
}

export function setSavedBlePrinter(printer: SavedBlePrinter): void {
  localStorage.setItem(PRINTER_KEY, JSON.stringify(printer));
}

export function clearSavedBlePrinter(): void {
  localStorage.removeItem(PRINTER_KEY);
}
