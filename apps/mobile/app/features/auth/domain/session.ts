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
};

export type StoreIdentity = {
  storeId: string;
  storeName: string;
  storeLogoUrl: string | null;
  registerId: string | null;
};
