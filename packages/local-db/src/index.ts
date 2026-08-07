export { LOCAL_DB_NAME, LOCAL_DB_VERSION, openLocalDb, resetLocalDbCache } from "./db.js";
export type {
  PinMaterialRecord,
  CatalogProductRecord,
  LocalSaleLine,
  LocalSaleRecord,
} from "./db.js";
export {
  createSalt,
  hashPin,
  isSixDigitPin,
  timingSafeEqual,
} from "./pin-hash.js";
export {
  clearPinMaterial,
  enrollPin,
  getAnyPinMaterial,
  getPinMaterial,
  hasPinMaterial,
  verifyPin,
} from "./pin-material.js";
export {
  getCatalogPulledAt,
  isValidSellablePrice,
  listCatalogProducts,
  replaceCatalog,
} from "./catalog.js";
export {
  completeSale,
  createIncompleteSale,
  discardIncompleteSale,
  getDayCloseSummary,
  getDeviceId,
  getSale,
  listCompleteSalesForLocalDay,
  listPendingSyncSales,
  markSaleSynced,
  endOfLocalDay,
  startOfLocalDay,
  toSyncSaleRequest,
} from "./sales.js";
export type { DayCloseSummary } from "./sales.js";
