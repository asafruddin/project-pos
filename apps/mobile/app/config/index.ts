import Constants from "expo-constants";

/** Deployed API (HTTPS, so it also works in release builds and on real devices). */
export const DEFAULT_API_URL = "https://project-pos-api.vercel.app";

/**
 * API base URL. Defaults to the deployed API. To develop against a local API set
 * `EXPO_PUBLIC_API_URL` in `.env.local` (see `.env.example`): `http://10.0.2.2:3001`
 * from the Android emulator, or `http://<LAN-IP>:3001` from a real device.
 * Android release builds block cleartext HTTP, so only use `http://` in development.
 */
const extraUrl = (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl;

export const config = {
  apiUrl: process.env.EXPO_PUBLIC_API_URL || extraUrl || DEFAULT_API_URL,
  /** Safety-net sync tick while online. */
  syncIntervalMs: 30_000,
  /** Re-probe the API while "online" to notice silent drops. */
  onlineProbeMs: 30_000,
  /** Re-probe quickly while the network is up but the API is not. */
  degradedProbeMs: 5_000,
  probeTimeoutMs: 4_000,
};
