import { BluetoothPrinter, type BluetoothPrinterBridge, type NativePrinterDevice } from "@/infrastructure/printer/bluetooth-printer";
import type { KvStore } from "@/infrastructure/db/kv-store";

jest.mock("react-native", () => ({
  Platform: { OS: "android", Version: 34 },
  PermissionsAndroid: {
    PERMISSIONS: {
      BLUETOOTH_SCAN: "android.permission.BLUETOOTH_SCAN",
      BLUETOOTH_CONNECT: "android.permission.BLUETOOTH_CONNECT",
      ACCESS_FINE_LOCATION: "android.permission.ACCESS_FINE_LOCATION",
    },
    RESULTS: { GRANTED: "granted" },
    requestMultiple: async () => ({
      "android.permission.BLUETOOTH_SCAN": "granted",
      "android.permission.BLUETOOTH_CONNECT": "granted",
    }),
    request: async () => "granted",
  },
}));

class MemoryKv implements KvStore {
  private rows = new Map<string, string>();
  get(key: string) {
    return this.rows.get(key) ?? null;
  }
  set(key: string, value: string) {
    this.rows.set(key, value);
  }
  delete(key: string) {
    this.rows.delete(key);
  }
}

function fakeNative(over: Partial<BluetoothPrinterBridge> & { connectedTo?: string } = {}) {
  const printed: string[] = [];
  const device: NativePrinterDevice = { id: "AA:BB:CC:DD:EE:FF", name: "RPP02", bonded: true };
  const native: BluetoothPrinterBridge & { printed: string[]; connectedTo: string | null } = {
    printed,
    connectedTo: over.connectedTo ?? null,
    scan: over.scan ?? (async () => [device]),
    connect: async (address) => {
      const result = over.connect
        ? await over.connect(address)
        : { ...device, id: address };
      native.connectedTo = address;
      return result;
    },
    disconnect: over.disconnect ?? (async () => {
      native.connectedTo = null;
    }),
    print: over.print ?? (async (payloadB64) => {
      printed.push(payloadB64);
    }),
    isConnected: over.isConnected ?? (async () => native.connectedTo != null),
    setStayConnected: over.setStayConnected ?? (async () => {}),
  };
  return native;
}

describe("BluetoothPrinter", () => {
  it("starts unconfigured until a device is saved", () => {
    const printer = new BluetoothPrinter(fakeNative(), new MemoryKv());
    expect(printer.getStatus()).toEqual({ state: "unconfigured", name: null, detail: null });
  });

  it("restores a saved printer as disconnected", () => {
    const kv = new MemoryKv();
    kv.set("printer.address", "AA:BB:CC:DD:EE:FF");
    kv.set("printer.name", "RPP02");
    const printer = new BluetoothPrinter(fakeNative(), kv);
    expect(printer.getStatus()).toEqual({ state: "disconnected", name: "RPP02", detail: null });
  });

  it("pairs, saves the MAC, and reports connected", async () => {
    const kv = new MemoryKv();
    const native = fakeNative();
    const printer = new BluetoothPrinter(native, kv);
    await printer.pair({ id: "AA:BB:CC:DD:EE:FF", name: "RPP02", bonded: true });
    expect(printer.getStatus().state).toBe("connected");
    expect(printer.getStatus().name).toBe("RPP02");
    expect(kv.get("printer.address")).toBe("AA:BB:CC:DD:EE:FF");
    expect(native.connectedTo).toBe("AA:BB:CC:DD:EE:FF");
  });

  it("reconnects to the saved MAC on connect()", async () => {
    const kv = new MemoryKv();
    kv.set("printer.address", "11:22:33:44:55:66");
    kv.set("printer.name", "CashierPrint");
    const native = fakeNative();
    const printer = new BluetoothPrinter(native, kv);
    await printer.connect();
    expect(native.connectedTo).toBe("11:22:33:44:55:66");
    expect(printer.getStatus().state).toBe("connected");
  });

  it("prints after reconnecting a saved printer", async () => {
    const kv = new MemoryKv();
    kv.set("printer.address", "AA:BB:CC:DD:EE:FF");
    kv.set("printer.name", "RPP02");
    const native = fakeNative();
    const printer = new BluetoothPrinter(native, kv);
    await printer.print(new Uint8Array([1, 2, 3]));
    expect(native.printed).toHaveLength(1);
    expect(printer.getStatus().state).toBe("connected");
    expect(native.connectedTo).toBe("AA:BB:CC:DD:EE:FF");
  });

  it("does not reopen the socket when already connected", async () => {
    const kv = new MemoryKv();
    kv.set("printer.address", "AA:BB:CC:DD:EE:FF");
    kv.set("printer.name", "RPP02");
    let connects = 0;
    const native = fakeNative({
      connect: async (address) => {
        connects += 1;
        return { id: address, name: "RPP02", bonded: true };
      },
    });
    const printer = new BluetoothPrinter(native, kv);
    await printer.connect();
    await printer.connect();
    expect(connects).toBe(1);
  });

  it("keepAlive tells native to hold the socket", async () => {
    const kv = new MemoryKv();
    kv.set("printer.address", "AA:BB:CC:DD:EE:FF");
    kv.set("printer.name", "RPP02");
    const held: boolean[] = [];
    const native = fakeNative({
      setStayConnected: async (enabled) => {
        held.push(enabled);
      },
    });
    const printer = new BluetoothPrinter(native, kv);
    printer.keepAlive(true);
    await printer.connect();
    printer.keepAlive(false);
    await printer.disconnect();
    expect(held).toEqual([true, false]);
  });

  it("keepAlive drops the socket when turned off", async () => {
    const kv = new MemoryKv();
    kv.set("printer.address", "AA:BB:CC:DD:EE:FF");
    kv.set("printer.name", "RPP02");
    const native = fakeNative();
    const printer = new BluetoothPrinter(native, kv);
    printer.keepAlive(true);
    await printer.connect();
    expect(native.connectedTo).toBe("AA:BB:CC:DD:EE:FF");
    printer.keepAlive(false);
    await printer.disconnect();
    expect(native.connectedTo).toBe(null);
    expect(printer.getStatus().state).toBe("disconnected");
  });

  it("maps a native failure to AppError PRINTER", async () => {
    const native = fakeNative({
      connect: async () => {
        const error = new Error("Bluetooth is off");
        (error as Error & { code: string }).code = "BT_OFF";
        throw error;
      },
    });
    const printer = new BluetoothPrinter(native, new MemoryKv());
    await expect(printer.pair({ id: "AA:BB", name: "X", bonded: false })).rejects.toMatchObject({
      code: "PRINTER",
      message: "BT_OFF",
    });
    expect(printer.getStatus().state).toBe("error");
  });
});
