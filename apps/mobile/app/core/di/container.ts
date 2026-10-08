import * as Crypto from "expo-crypto";
import { createStore, type StoreApi } from "zustand/vanilla";
import { systemClock, type Clock } from "@/core/ports/clock";
import type { FileStore } from "@/core/ports/files";
import type { HttpClient } from "@/core/ports/http";
import type { IdGenerator } from "@/core/ports/id";
import { isAppError } from "@/core/errors/app-error";
import { config } from "@/config";
import { ApiAuthGateway } from "@/features/auth/data/api-auth-gateway";
import { SecureSessionStore } from "@/features/auth/data/secure-session-store";
import { resolveGate, type Gate } from "@/features/auth/domain/gate";
import type { ShiftPdf } from "@/features/shift/domain/shift-pdf";
import { ExpoShiftPdf } from "@/infrastructure/pdf/expo-shift-pdf";
import { ShiftReportUseCase } from "@/features/shift/domain/shift-report-use-case";
import { KvQueueSettingsStore } from "@/features/queue/data/kv-queue-settings-store";
import { LoginUseCase, RefreshIdentityUseCase } from "@/features/auth/domain/use-cases";
import type { Session } from "@/features/auth/domain/session";
import { createCartStore, type CartStore } from "@/features/cart/presentation/cart-store";
import { DrizzleParkedCartRepository } from "@/features/cart/data/drizzle-parked-cart-repository";
import { buildParkedCart } from "@/features/cart/domain/parked-cart";
import { ApiCatalogRemote } from "@/features/catalog/data/api-catalog-remote";
import { DrizzleCatalogRepository } from "@/features/catalog/data/drizzle-catalog-repository";
import { DrizzleImageRepository } from "@/features/catalog/data/drizzle-image-repository";
import { PullCatalogTask } from "@/features/catalog/domain/pull-catalog";
import { UnpackUseCase } from "@/features/catalog/domain/unpack";
import { DrizzleSalesRepository, KvDeviceIdProvider } from "@/features/checkout/data/drizzle-sales-repository";
import { saleSyncHandler, saleVoidHandler } from "@/features/checkout/data/sale-outbox-handlers";
import { CompleteSaleUseCase } from "@/features/checkout/domain/complete-sale";
import { VoidSaleUseCase } from "@/features/checkout/domain/void-sale";
import { ApiCustomerRemote } from "@/features/customers/data/api-customer-remote";
import { customerCreateHandler } from "@/features/customers/data/customer-outbox-handler";
import { DrizzleCustomerRepository } from "@/features/customers/data/drizzle-customer-repository";
import { CreateCustomerUseCase, PullCustomersTask } from "@/features/customers/domain/use-cases";
import { KvLockoutStore, SecurePinMaterialStore } from "@/features/pin/data/secure-pin-store";
import { NoblePinHasher } from "@/features/pin/data/noble-pin-hasher";
import { PinService } from "@/features/pin/domain/pin-service";
import { ApiReturnsRemote } from "@/features/returns/data/api-returns-remote";
import { ApiPromotionRemote } from "@/features/promotions/data/api-promotion-remote";
import { KvPromotionRepository } from "@/features/promotions/data/kv-promotion-repository";
import { PullPromotionsTask } from "@/features/promotions/domain/pull-promotions";
import { DrizzlePrintJobRepository } from "@/features/receipt/data/drizzle-print-job-repository";
import { PrintQueue } from "@/features/receipt/domain/print-queue";
import { PrintReceiptUseCase } from "@/features/receipt/domain/print-receipt";
import type { Printer } from "@/features/receipt/domain/printer";
import { queueNumberForDay } from "@/features/receipt/domain/receipt-encoder";
import { createPreferencesStore, type PreferencesStore } from "@/features/settings/domain/preferences";
import { ApiShiftRemote } from "@/features/shift/data/api-shift-remote";
import { DrizzleShiftRepository } from "@/features/shift/data/drizzle-shift-repository";
import { cashMovementHandler, createShiftOpenHandler, shiftCloseHandler } from "@/features/shift/data/shift-outbox-handlers";
import { DayCloseSummaryUseCase } from "@/features/shift/domain/day-close-use-case";
import { CloseShiftUseCase, OpenShiftUseCase, RecordCashMovementUseCase, ShiftSummaryUseCase } from "@/features/shift/domain/use-cases";
import { ConnectivityMonitor, type NetworkSource } from "@/infrastructure/connectivity/connectivity-monitor";
import { DrizzleKvStore } from "@/infrastructure/db/kv-store";
import type { AppDb } from "@/infrastructure/db/types";
import { FetchHttpClient } from "@/infrastructure/http/fetch-http-client";
import { isJwtExpired } from "@/infrastructure/http/jwt";
import { createDefaultPrinter } from "@/infrastructure/printer/create-printer";
import { ExpoFileStore } from "@/infrastructure/storage/expo-file-store";
import type { AppStateSource } from "@/infrastructure/sync/app-state-source";
import { OutboxRepository } from "@/infrastructure/sync/outbox";
import type { PullTask } from "@/infrastructure/sync/pull-task";
import { SyncEngine } from "@/infrastructure/sync/sync-engine";
import { SyncScheduler } from "@/infrastructure/sync/sync-scheduler";
import { createSyncStatusStore } from "@/infrastructure/sync/sync-status";
import { setLanguage, t, localeFor, getLanguage } from "@/i18n";
import { cryptoIdGenerator } from "@/utils/id";

export type EventKey = "shift" | "sales" | "parked" | "promos";

export type ShiftIntent = "logout" | "close-then-open" | null;

export type AuthState = {
  /** `booting` until the session has been read from disk. */
  gate: Gate | "booting";
  session: Session | null;
  /** In memory only: a cold start always asks for the PIN again (PWA: sessionStorage). */
  pinUnlocked: boolean;
  /** The JWT died (expired offline / 401): selling continues, sync pauses until a fresh login. */
  reauth: boolean;
  /** Re-login prompt is open (banner button). */
  reauthOpen: boolean;
  /** Set after a PIN unlock / logout request when the shift screen must run first. */
  shiftIntent: ShiftIntent;
  /** `file://` URI of the cached store logo. */
  logoUri: string | null;
};

/** Platform pieces the container cannot create itself (swapped in tests). */
export type ContainerDeps = {
  db: AppDb;
  network: NetworkSource;
  appState: AppStateSource;
  fetchImpl?: typeof fetch;
  clock?: Clock;
  ids?: IdGenerator;
  printer?: Printer;
  files?: FileStore;
  shiftPdf?: ShiftPdf;
};

export type Container = ReturnType<typeof createContainer>;

/**
 * Composition root: the only place that knows which adapter implements which
 * port. Everything else depends on interfaces from `domain/` or `core/ports/`.
 */
export function createContainer(deps: ContainerDeps) {
  const clock = deps.clock ?? systemClock;
  const ids = deps.ids ?? cryptoIdGenerator;
  const { db } = deps;

  // --- persistence
  const kv = new DrizzleKvStore(db);
  const outbox = new OutboxRepository(db);
  const sessions = new SecureSessionStore(kv);
  const queueSettings = new KvQueueSettingsStore(kv);
  const catalog = new DrizzleCatalogRepository(db, kv);
  const images = new DrizzleImageRepository(db);
  const shifts = new DrizzleShiftRepository(db, outbox, clock, ids);
  const sales = new DrizzleSalesRepository(db, outbox, clock, ids);
  const customersRepo = new DrizzleCustomerRepository(db, outbox, clock, ids);
  const parked = new DrizzleParkedCartRepository(db);
  const printJobs = new DrizzlePrintJobRepository(db);
  const deviceId = new KvDeviceIdProvider(kv, ids);

  // --- preferences (theme / language / catalog view)
  const prefs: PreferencesStore = createPreferencesStore(kv, setLanguage);

  // --- state
  const auth: StoreApi<AuthState> = createStore<AuthState>(() => ({
    gate: "booting",
    session: null,
    pinUnlocked: false,
    reauth: false,
    reauthOpen: false,
    shiftIntent: null,
    logoUri: kv.get("store.logoUri"),
  }));

  const tokenValid = () => {
    const token = sessions.current()?.accessToken ?? null;
    return token !== null && !isJwtExpired(token, clock.nowMs());
  };

  function recomputeGate(): void {
    const { pinUnlocked } = auth.getState();
    auth.setState({
      session: sessions.current(),
      gate: resolveGate({ session: sessions.current(), tokenValid: tokenValid(), shiftAuthorized: sessions.shiftAuthorized(), pinUnlocked }),
    });
  }

  // --- network
  const http: HttpClient = new FetchHttpClient({
    baseUrl: config.apiUrl,
    getToken: () => sessions.current()?.accessToken ?? null,
    fetchImpl: deps.fetchImpl,
    // A rejected/expired token ends the *account* session only: shift, cart and queue stay.
    onUnauthorized: () => handleTokenDead(),
  });
  const files: FileStore =
    deps.files ?? new ExpoFileStore({ baseUrl: config.apiUrl, getToken: () => sessions.current()?.accessToken ?? null });
  const connectivity = new ConnectivityMonitor({
    network: deps.network,
    probe: async () => {
      try {
        await http.request({ method: "GET", path: "/health", skipAuth: true, timeoutMs: config.probeTimeoutMs });
        return true;
      } catch {
        return false;
      }
    },
    onlineProbeMs: config.onlineProbeMs,
    degradedProbeMs: config.degradedProbeMs,
  });
  const online = () => connectivity.getSnapshot().state === "online";

  // --- sync
  const syncStatus = createSyncStatusStore();
  const engine = new SyncEngine({
    outbox,
    http,
    clock,
    status: syncStatus,
    handlers: {
      "customer.create": customerCreateHandler,
      "shift.open": createShiftOpenHandler(shifts, () => bump("shift")),
      "cash.movement": cashMovementHandler,
      "shift.close": shiftCloseHandler,
      "sale.sync": saleSyncHandler,
      "sale.void": saleVoidHandler,
    },
  });

  /** Version counters so screens re-read SQLite after local writes and sync side effects. */
  const events = createStore<Record<EventKey, number>>(() => ({ shift: 0, sales: 0, parked: 0, promos: 0 }));
  const bump = (key: EventKey) => events.setState((s) => ({ ...s, [key]: s[key] + 1 }));

  const promotions = new KvPromotionRepository(kv, () => bump("promos"));

  const catalogEvents = createStore<{ pulledAt: string | null; imagesVersion: number }>(() => ({
    pulledAt: catalog.getPulledAt(),
    imagesVersion: 0,
  }));
  const customersEvents = createStore<{ version: number }>(() => ({ version: 0 }));

  const apiCatalog = new ApiCatalogRemote(http);
  const apiCustomers = new ApiCustomerRemote(http);
  const apiPromotions = new ApiPromotionRemote(http);

  const identity = new RefreshIdentityUseCase(new ApiAuthGateway(http), sessions, queueSettings);
  const identityTask: PullTask = {
    name: "identity",
    minIntervalMs: 60_000,
    async run() {
      await identity.execute();
      recomputeGate();
      await refreshLogo();
    },
  };

  const catalogTask = new PullCatalogTask(apiCatalog, catalog, images, files, clock, () =>
    catalogEvents.setState((s) => ({ pulledAt: catalog.getPulledAt(), imagesVersion: s.imagesVersion + 1 })),
  );

  const pullTasks: PullTask[] = [
    identityTask,
    catalogTask,
    new PullCustomersTask(apiCustomers, customersRepo, clock, () => customersEvents.setState((s) => ({ version: s.version + 1 }))),
    new PullPromotionsTask(apiPromotions, promotions),
  ];

  const scheduler = new SyncScheduler({
    engine,
    connectivity,
    appState: deps.appState,
    status: syncStatus,
    clock,
    intervalMs: config.syncIntervalMs,
    // Nothing can reach the server without a live token; the reauth flow resumes sync.
    canSync: () => auth.getState().gate === "app" && tokenValid(),
    pullTasks,
  });
  const onQueued = () => scheduler.notifyLocalWrite();
  const onShiftQueued = () => {
    bump("shift");
    onQueued();
  };
  const onSaleQueued = () => {
    bump("sales");
    onQueued();
  };

  // --- printing
  const printer: Printer = deps.printer ?? createDefaultPrinter(kv, deps.appState);
  const printQueue = new PrintQueue(printJobs, printer, clock, ids);

  // --- PIN
  const pins = new PinService(new SecurePinMaterialStore(kv), new NoblePinHasher((n) => Crypto.getRandomBytes(n)), new KvLockoutStore(kv), clock);

  // --- use cases
  const login = new LoginUseCase(new ApiAuthGateway(http), sessions, queueSettings);
  const openShift = new OpenShiftUseCase(shifts, clock, ids, () => sessions.current(), onShiftQueued, () => {
    // New shift = clean slate: drop closed shifts' sales the server already has.
    if (sales.purgeClosedShiftSales() > 0) bump("sales");
  });
  const recordCash = new RecordCashMovementUseCase(shifts, clock, ids, onShiftQueued);
  const shiftSummary = new ShiftSummaryUseCase(shifts, sales, new ApiShiftRemote(http), online);
  const shiftReport = new ShiftReportUseCase(shifts, sales, () => sessions.current()?.storeName ?? "");
  const shiftPdf = deps.shiftPdf ?? new ExpoShiftPdf(
    () => ({
      title: t("pdfTitle"), opened: t("pdfOpened"), closed: t("pdfClosed"), recap: t("pdfRecap"),
      opening: t("shiftOpening"), cashSales: t("shiftCashSales"), cashIn: t("shiftCashIn"), cashOut: t("shiftCashOut"),
      refunds: t("shiftRefunds"), voids: t("shiftVoids"), finalCash: t("shiftFinalCash"), grandTotal: t("shiftGrandTotal"), grandTotalHint: t("shiftGrandTotalHint"), summary: t("shiftSummary"),
      sectionCash: t("shiftSectionCash"), sectionSales: t("shiftSectionSales"), methodCash: t("shiftMethodCash"),
      methodQris: t("qris"), methodStoreCredit: t("storeCredit"),
      refundsUnknown: t("pdfRefundsUnknown"), autoNote: t("pdfAutoNote"), cashOutTitle: t("pdfCashOutTitle"), none: t("pdfNone"),
      salesTitle: t("pdfSalesTitle"), totalCash: t("pdfTotalCash"), totalQris: t("pdfTotalQris"),
      totalStoreCredit: t("pdfTotalStoreCredit"), totalSales: t("pdfTotalSales"), salesCount: t("pdfSalesCount"),
      voidedCount: t("pdfVoidedCount"), queue: t("pdfQueue"), time: t("pdfTime"), name: t("pdfName"),
      method: t("pdfMethod"), amount: t("pdfAmount"), voidedTag: t("pdfVoidedTag"), walkIn: t("txWalkIn"),
    }),
    (lang) => localeFor(lang),
  );
  const closeShift = new CloseShiftUseCase(shifts, shiftSummary, clock, onShiftQueued);
  const dayClose = new DayCloseSummaryUseCase(sales, shifts);
  const completeSale = new CompleteSaleUseCase(sales, shifts, promotions, apiPromotions, pins, clock, ids, deviceId, online, onSaleQueued, queueSettings);
  const voidSale = new VoidSaleUseCase(
    sales,
    pins,
    clock,
    ids,
    () => sessions.current()?.permissions ?? [],
    () => sessions.current()?.userId ?? null,
    onSaleQueued,
  );
  const createCustomer = new CreateCustomerUseCase(customersRepo, apiCustomers, clock, ids, online, onQueued);
  const unpack = new UnpackUseCase(apiCatalog, catalog, online);
  const printReceipt = new PrintReceiptUseCase(
    printQueue,
    printer,
    () => sessions.current()?.storeName ?? "POS",
    () => ({
      customerCopy: t("receiptCustomerCopy"),
      kitchenCopy: t("kitchenCopy"),
      walkIn: t("txWalkIn"),
      voided: t("voided"),
      total: t("total"),
      cash: t("cashTender"),
      qris: t("qris"),
      storeCredit: t("storeCredit"),
      promoDiscount: t("promoDiscount"),
      voucher: t("voucher"),
      managerDiscount: t("managerDiscount"),
      thanks: t("receiptThanks"),
      queue: t("receiptQueue"),
      guest: t("receiptGuest"),
    }),
    () => new Date(clock.nowMs()).toLocaleString(localeFor(getLanguage())),
    () => localeFor(getLanguage()),
    () => getLanguage(),
    (sale) => sale.queueNumber ?? queueNumberForDay(sale.saleId, sales.listForLocalDay(new Date(sale.completedAt))),
  );

  const cart: CartStore = createCartStore();
  /** Phone cart panel open/closed (lives here so any screen's header button can toggle it). */
  const cartUi = createStore<{ open: boolean; toggle(): void; set(open: boolean): void }>((set) => ({
    open: false,
    toggle: () => set((s) => ({ open: !s.open })),
    set: (open) => set({ open }),
  }));

  // --- session lifecycle
  /**
   * The JWT may expire while the till sits offline (no request ever sees the 401).
   * Check it locally on a timer, like the PWA's SessionGuard: sync pauses, selling continues.
   */
  function checkTokenExpiry(): void {
    const session = sessions.current();
    if (auth.getState().gate === "app" && session?.accessToken && !tokenValid()) handleTokenDead();
  }
  let tokenTimer: ReturnType<typeof setInterval> | null = null;

  function handleTokenDead(): void {
    const state = auth.getState();
    if (state.gate !== "app" || state.reauth) return;
    void sessions.dropToken().then(() => {
      auth.setState({ reauth: true });
      recomputeGate(); // refresh `session` (token now null); the gate stays "app" while the shift is authorised
      syncStatus.setState({ phase: "auth_required" });
    });
  }

  async function refreshLogo(): Promise<void> {
    const path = sessions.current()?.storeLogoUrl;
    if (!path || !tokenValid() || !online()) return;
    const previous = kv.get("store.logoUri");
    const uri = await files.download({ path, name: `store-logo-${clock.nowMs()}` });
    if (!uri) return;
    kv.set("store.logoUri", uri);
    if (previous && previous !== uri) files.remove(previous);
    auth.setState({ logoUri: uri });
  }

  function endSessionState(): void {
    auth.setState({ pinUnlocked: false, reauth: false, reauthOpen: false, shiftIntent: null });
    recomputeGate();
  }

  return {
    clock,
    db,
    repositories: { catalog, images, shifts, sales, outbox, customers: customersRepo, parked, promotions },
    queueSettings,
    /** Manual "pull catalog" button: refresh now and drop cart lines that are no longer sellable. */
    async pullCatalogNow(): Promise<void> {
      await catalogTask.run();
      cart.getState().pruneToSellable(catalog.listSellable());
    },
    /** Call after discarding/resuming a held cart so the badge refreshes. */
    notifyParkedChanged: () => bump("parked"),
    prefs,
    auth,
    syncStatus,
    events,
    catalogEvents,
    customersEvents,
    connectivity,
    scheduler,
    engine,
    printer,
    printQueue,
    cart,
    cartUi,
    pins,
    files,
    shiftPdf,
    useCases: {
      login,
      openShift,
      recordCash,
      shiftSummary,
      closeShift,
      shiftReport,
      dayClose,
      completeSale,
      voidSale,
      createCustomer,
      unpack,
      printReceipt,
      parkCart(input: { lines: Parameters<typeof buildParkedCart>[0]; customerName?: string | null }) {
        const cartToPark = buildParkedCart(input.lines, { parkId: ids.uuid(), createdAt: clock.nowIso(), customerName: input.customerName });
        parked.save(cartToPark);
        bump("parked");
        return cartToPark;
      },
    },
    remotes: { vouchers: apiPromotions, customers: apiCustomers, returns: new ApiReturnsRemote(http) },

    /** Load persisted state and start background services. Call once. */
    async start(): Promise<void> {
      await sessions.hydrate();
      // A token that died while the app was closed: keep the shift, ask for login when online.
      const token = sessions.current()?.accessToken ?? null;
      if (sessions.current() && token && isJwtExpired(token, clock.nowMs())) await sessions.dropToken();
      const needsReauth = Boolean(sessions.current()) && sessions.shiftAuthorized() && !tokenValid();
      auth.setState({ reauth: needsReauth });
      recomputeGate();
      printQueue.start();
      scheduler.start();
      tokenTimer ??= setInterval(checkTokenExpiry, 30_000);
      if (needsReauth) syncStatus.setState({ phase: "auth_required" });
      if (sessions.current()) printer.keepAlive(true);
      void refreshLogo();
    },

    /** Exposed for tests and the foreground handler. */
    checkTokenExpiry,

    stop(): void {
      if (tokenTimer) clearInterval(tokenTimer);
      tokenTimer = null;
      scheduler.stop();
      printQueue.stop();
      printer.keepAlive(false);
    },

    /** Account login (also the reauth path: same user returns straight to the till). */
    async signIn(credentials: { login: string; password: string }): Promise<Session> {
      const previous = auth.getState();
      const session = await login.execute(credentials);
      const sameUser = previous.reauth && previous.session?.userId === session.userId && previous.pinUnlocked;
      auth.setState({ reauth: false, reauthOpen: false, pinUnlocked: sameUser ? true : false, shiftIntent: null });
      recomputeGate();
      if (sameUser) printer.keepAlive(true);
      void refreshLogo();
      void scheduler.syncNow("login");
      return session;
    },

    /** First-time PIN (online) or unlock (offline ok). */
    async pinMode(): Promise<"enroll" | "unlock" | "blocked"> {
      const session = sessions.current();
      if (session?.accessToken && tokenValid()) {
        return (await pins.hasMaterial(session.userId)) ? "unlock" : "enroll";
      }
      if (sessions.shiftAuthorized() && (await pins.hasMaterial())) return "unlock";
      return "blocked";
    },

    /** After a successful PIN: a shift left open on this device must be closed first. */
    completePinUnlock(): void {
      const leftOver = shifts.getOpen() !== null;
      auth.setState({ pinUnlocked: true, shiftIntent: leftOver ? "close-then-open" : null });
      recomputeGate();
      printer.keepAlive(true);
      // Sync is gated on the till being open, so nothing has run since the app started: catch up now.
      void scheduler.syncNow("login");
    },

    clearShiftIntent(): void {
      auth.setState({ shiftIntent: null });
    },

    /** Explicit sign out. With an open shift the shift screen runs first (`intent=logout`). */
    requestLogout(): "needs-shift-close" | "done" {
      if (shifts.getOpen()) {
        auth.setState({ shiftIntent: "logout" });
        return "needs-shift-close";
      }
      void this.endAccountSession();
      return "done";
    },

    /** Day close / sign out: forget account + PIN unlock; keep sales, outbox and PIN material. */
    async endAccountSession(): Promise<void> {
      printer.keepAlive(false);
      await sessions.clear();
      cart.getState().clear();
      endSessionState();
    },

    /** Ask for a fresh login without leaving the till. */
    openReauth(): void {
      auth.setState({ reauthOpen: true });
    },
    closeReauth(): void {
      auth.setState({ reauthOpen: false });
    },

    saveCartAsParked(): boolean {
      const state = cart.getState();
      if (state.lines.length === 0) return false;
      const lines = state.lines.map((l) => ({ productId: l.productId, name: l.name, priceMinor: l.priceMinor, qty: l.qty }));
      const result = this.useCases.parkCart({ lines, customerName: state.guestName });
      state.clear();
      return result.lines.length > 0;
    },

    isOnline: online,
    isAppError,
  };
}
