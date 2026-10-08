import { PermissionsAndroid, Platform } from "react-native";

/** Ask for the runtime Bluetooth (and legacy location) permissions a scan needs. */
export async function requestBluetoothPermissions(): Promise<"granted" | "denied" | "unavailable"> {
  if (Platform.OS !== "android") return "unavailable";
  const api = typeof Platform.Version === "number" ? Platform.Version : Number.parseInt(String(Platform.Version), 10);
  if (!Number.isFinite(api)) return "denied";
  if (api >= 31) {
    const result = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    ]);
    const scan = result[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN];
    const connect = result[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT];
    return scan === PermissionsAndroid.RESULTS.GRANTED && connect === PermissionsAndroid.RESULTS.GRANTED
      ? "granted"
      : "denied";
  }
  const location = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
  return location === PermissionsAndroid.RESULTS.GRANTED ? "granted" : "denied";
}
