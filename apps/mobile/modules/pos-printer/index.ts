export type NativePrinterDevice = {
  id: string;
  name: string;
  bonded: boolean;
};

export type NativePrinterBridge = {
  scan(timeoutMs: number): Promise<NativePrinterDevice[]>;
  connect(address: string): Promise<NativePrinterDevice>;
  disconnect(): Promise<void>;
  print(payloadB64: string): Promise<void>;
  isConnected?: () => Promise<boolean>;
  setStayConnected?: (enabled: boolean) => Promise<void>;
  addListener?: (event: string, listener: (event: { address?: string }) => void) => { remove(): void };
};
