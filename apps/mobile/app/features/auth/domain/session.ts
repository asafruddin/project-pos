import type { ManagerPinMaterial } from "@pos-apps/types";

export type Session = {
  /** Null once the JWT expired while offline: the shift keeps running, sync pauses. */
  accessToken: string | null;
  userId: string;
  role: string;
  permissions: string[];
  storeId: string;
  storeName: string;
  /** API path of the store logo (`/stores/:id/logo`), fetched with the token. */
  storeLogoUrl: string | null;
  registerId: string | null;
  /** Store-wide queue reset setting from login (cached separately for offline use). */
  queueResetMode?: "daily" | "shift" | "manual";
  queueResetAt?: string | null;
  /** Store manager PIN material from login: handed to the PIN service, never persisted with the session. */
  managerPin?: ManagerPinMaterial | null;
};

export type StoreIdentity = {
  storeId: string;
  storeName: string;
  storeLogoUrl: string | null;
  registerId: string | null;
};
