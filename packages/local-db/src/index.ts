export { LOCAL_DB_NAME, LOCAL_DB_VERSION, openLocalDb, resetLocalDbCache } from "./db.js";
export type {
  PinMaterialRecord,
  CatalogProductRecord,
  CatalogImageRecord,
  LocalSaleLine,
  LocalSaleRecord,
  ParkedCartLine,
  ParkedCartRecord,
  CachedCustomerRecord,
  CustomerCreateOutboxRecord,
  LocalShiftRecord,
  ShiftOutboxRecord,
  LocalCashMovementRecord,
  CashMovementOutboxRecord,
  ShiftCloseOutboxRecord,
} from "./db.js";
export {
  resolveSellingPrice,
  evaluateSplitTender,
  evaluateLoyaltyEarn,
  evaluateLoyaltyRedeem,
  evaluatePromotions,
  evaluateVoucher,
  evaluateManagerDiscount,
  stackSaleDiscounts,
  cashTenderTotal,
  storeCreditTenderTotal,
} from "@pos-apps/domain";
export {
  createSalt,
  hashPin,
  isSixDigitPin,
  timingSafeEqual,
} from "./pin-hash.js";
export {
  clearPinMaterial,
  enrollManagerPin,
  enrollPin,
  getAnyPinMaterial,
  getPinMaterial,
  hasManagerPin,
  hasPinMaterial,
  MANAGER_PIN_USER_ID,
  verifyManagerPin,
  verifyPin,
} from "./pin-material.js";
export {
  getCatalogPulledAt,
  isValidSellablePrice,
  listCatalogProducts,
  replaceCatalog,
  cacheCatalogImages,
  getCatalogImageRecord,
  isSellableCatalogRow,
  primaryCatalogImage,
} from "./catalog.js";
export {
  completeSale,
  createIncompleteSale,
  discardIncompleteSale,
  getDeviceId,
  getSale,
  listCompleteSalesForLocalDay,
  listPendingSyncSales,
  listPendingSyncVoids,
  markSaleSynced,
  markVoidSynced,
  endOfLocalDay,
  startOfLocalDay,
  toSyncSaleRequest,
  toSyncVoidRequest,
  voidCompleteSale,
  stampSaleShiftIfMissing,
} from "./sales.js";
export {
  closedShiftsForLocalDay,
  dayCloseGate,
  dayCloseSummaryFrom,
  getDayCloseSummary,
} from "./day-close.js";
export type { DayCloseShiftCash, DayCloseSummary } from "./day-close.js";
export { evaluateVoid, restoreCatalogQty } from "./void-sale.js";
export {
  buildParkedCart,
  discardParkedCart,
  getParkedCart,
  listParkedCarts,
  parkCart,
  resumeParkedCart,
} from "./parked-carts.js";
export {
  customerFromApi,
  getCachedCustomer,
  listCachedCustomers,
  listPendingCustomerCreates,
  markCustomerCreateSynced,
  matchCustomers,
  queueCustomerCreate,
  replaceCustomers,
  toCreateCustomerRequest,
} from "./customers.js";
export { getLoyaltyProgram, replaceLoyaltyProgram } from "./loyalty.js";
export { getCachedPromotions, replacePromotions } from "./promotions.js";
export {
  getOpenShift,
  listPendingShiftOpens,
  markShiftSynced,
  openLocalShift,
  toSyncShiftRequest,
} from "./shifts.js";
export {
  closeLocalShift,
  computeLocalExpectedCash,
  listPendingCashMovements,
  listPendingShiftCloses,
  markCashMovementSynced,
  markShiftCloseSynced,
  recordLocalCashMovement,
  toCloseShiftRequest,
  toSyncCashMovementRequest,
} from "./shift-cash.js";
