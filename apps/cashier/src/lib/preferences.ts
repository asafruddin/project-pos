export type ThemePref = "system" | "light" | "dark";
export type LangPref = "id" | "en";

const THEME_KEY = "pos_cashier_theme";
const LANG_KEY = "pos_cashier_lang";

export function getTheme(): ThemePref {
  if (typeof window === "undefined") return "system";
  const v = localStorage.getItem(THEME_KEY);
  if (v === "light" || v === "dark" || v === "system") return v;
  return "system";
}

export function setTheme(theme: ThemePref): void {
  localStorage.setItem(THEME_KEY, theme);
  applyTheme(theme);
}

export function getLang(): LangPref {
  if (typeof window === "undefined") return "id";
  const v = localStorage.getItem(LANG_KEY);
  if (v === "en" || v === "id") return v;
  return "id";
}

export function setLang(lang: LangPref): void {
  localStorage.setItem(LANG_KEY, lang);
  if (typeof document !== "undefined") {
    document.documentElement.lang = lang;
  }
}

export function applyTheme(theme: ThemePref = getTheme()): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  if (theme === "system") {
    const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.classList.add(dark ? "dark" : "light");
  } else {
    root.classList.add(theme);
  }
}

export function copy(lang: LangPref) {
  if (lang === "en") {
    return {
      brand: "Cashier",
      title: "Sign in",
      subtitle: "Sign in with your cashier account to continue to POS PIN.",
      username: "Username",
      password: "Password",
      submit: "Sign in",
      pending: "Signing in…",
      apiDown: "Cannot reach the API. Try again when online.",
      notCashier: "This account is not a cashier account.",
      invalidResponse: "Invalid login response. Try again.",
      settings: "Settings",
      theme: "Theme",
      language: "Language",
      themeSystem: "System",
      themeLight: "Light",
      themeDark: "Dark",
      pinTitle: "Cashier PIN",
      pinSoon: "POS PIN unlock comes in the next story. Menu stays locked.",
      pinEnrollHint: "Create a 6-digit POS PIN for this device (first unlock after sign-in).",
      pinUnlockHint: "Enter your 6-digit POS PIN to open the menu.",
      pinWrong: "Wrong PIN. Try again.",
      pinOfflineNoMaterial:
        "Cannot unlock offline. Sign in online first to enroll a PIN on this device.",
      pinOfflineBadge: "(Offline)",
      pinInputLabel: "PIN (pasteable)",
      pinPasteHint: "You can type or paste 6 digits here.",
      pinSubmit: "Unlock",
      menuTitle: "Menu",
      menuSoon: "Product catalog arrives in the next story. Cart stays locked.",
      menuLocalOnly: "Products are loaded from this device’s Local Database only.",
      catalogPull: "Pull catalog",
      catalogPulling: "Pulling…",
      catalogPulled: "Last pull",
      catalogEmpty: "Catalog is empty. Pull products while online.",
      catalogEmptyOffline: "Go online and pull the catalog first.",
      catalogPullFail: "Catalog pull failed. Showing the last local catalog if any.",
      catalogOffline: "Cannot pull catalog while offline.",
      catalogNeedLogin: "Sign in online again to pull the catalog.",
      catalogBlockedPrice: "Invalid price — cannot sell",
      stock: "Stock",
      cart: "Cart",
      cartEmpty: "Cart is empty.",
      pay: "Pay",
      total: "Total",
      cashPayment: "Cash payment",
      receiptHint: "Confirm the receipt to complete the sale.",
      confirmReceipt: "Confirm receipt",
      cancelCheckout: "Cancel",
      receiptSuccess: "Receipt OK — sale complete.",
      checkoutFail: "Could not start checkout.",
      receiptFail: "Could not complete the sale. Try again.",
      qtyUp: "Increase",
      qtyDown: "Decrease",
      removeLine: "Remove",
      offlineKeep: "Sales stay saved on this device.",
      stockOut: "Out of stock",
      receipt: "Receipt",
      offlineMode: "Offline mode",
      waitingUpload: "Waiting to upload",
      synced: "Synced",
      syncFail: "Upload failed; sale stays complete locally and will retry.",
      dayClose: "Day close",
      dayCloseBack: "Back to menu",
      dayCloseSummary: "Day summary",
      dayCloseSalesTotal: "Sales total",
      dayCloseCash: "Cash summary",
      dayCloseTxCount: "Transactions",
      dayCloseSyncOk: "All complete sales are uploaded.",
      dayCloseSyncPending: "complete sales waiting to upload",
      dayCloseAckLabel:
        "I acknowledge {count} complete sale(s) are still waiting to upload. They will stay on this device for Sync after the next login.",
      dayCloseAckRequired: "Acknowledge unsynced sales before continuing.",
      dayCloseContinue: "Continue to report",
      dayCloseReport: "Today’s sales report",
      dayCloseEmpty: "No complete sales today.",
      dayCloseStatusDone: "Done",
      dayCloseConfirm: "Confirm day close",
      dayCloseConfirmHint: "This ends the POS session and returns to sign-in.",
      loading: "Loading…",
      logout: "Sign out",
    };
  }
  return {
    brand: "Kasir",
    title: "Masuk",
    subtitle: "Masuk dengan akun kasir untuk lanjut ke PIN kasir.",
    username: "Username",
    password: "Password",
    submit: "Masuk",
    pending: "Memproses…",
    apiDown: "Tidak dapat menghubungi API. Coba lagi saat online.",
    notCashier: "Akun ini bukan akun kasir.",
    invalidResponse: "Respons login tidak valid. Coba lagi.",
    settings: "Pengaturan",
    theme: "Tema",
    language: "Bahasa",
    themeSystem: "Sistem",
    themeLight: "Terang",
    themeDark: "Gelap",
    pinTitle: "PIN kasir",
    pinSoon: "Buka kunci PIN kasir datang di story berikutnya. Menu masih terkunci.",
    pinEnrollHint:
      "Buat PIN kasir 6 digit untuk perangkat ini (buka kunci pertama setelah masuk).",
    pinUnlockHint: "Masukkan PIN kasir 6 digit untuk membuka menu.",
    pinWrong: "PIN salah. Coba lagi.",
    pinOfflineNoMaterial:
      "Tidak dapat buka kunci offline. Masuk online dulu untuk mendaftarkan PIN di perangkat ini.",
    pinOfflineBadge: "(Offline)",
    pinInputLabel: "PIN (bisa tempel)",
    pinPasteHint: "Ketik atau tempel 6 digit di sini.",
    pinSubmit: "Buka",
    menuTitle: "Menu",
    menuSoon: "Katalog produk datang di story berikutnya. Keranjang masih terkunci.",
    menuLocalOnly: "Produk dibaca hanya dari Local Database perangkat ini.",
    catalogPull: "Tarik katalog",
    catalogPulling: "Menarik…",
    catalogPulled: "Tarik terakhir",
    catalogEmpty: "Katalog kosong. Tarik produk saat online.",
    catalogEmptyOffline: "Online dulu dan tarik katalog.",
    catalogPullFail: "Gagal tarik katalog. Menampilkan katalog lokal terakhir jika ada.",
    catalogOffline: "Tidak dapat tarik katalog saat offline.",
    catalogNeedLogin: "Masuk online lagi untuk menarik katalog.",
    catalogBlockedPrice: "Harga tidak valid — tidak bisa dijual",
    stock: "Stok",
    cart: "Keranjang",
    cartEmpty: "Keranjang kosong.",
    pay: "Bayar",
    total: "Total",
    cashPayment: "Pembayaran tunai",
    receiptHint: "Konfirmasi struk untuk menyelesaikan penjualan.",
    confirmReceipt: "Konfirmasi struk",
    cancelCheckout: "Batal",
    receiptSuccess: "Struk berhasil — penjualan selesai.",
    checkoutFail: "Tidak dapat memulai pembayaran.",
    receiptFail: "Tidak dapat menyelesaikan penjualan. Coba lagi.",
    qtyUp: "Tambah",
    qtyDown: "Kurangi",
    removeLine: "Hapus",
    offlineKeep: "Penjualan tetap tersimpan di perangkat ini.",
    stockOut: "Stok habis",
    receipt: "Struk",
    offlineMode: "Mode offline",
    waitingUpload: "Menunggu unggah",
    synced: "Tersinkron",
    syncFail: "Unggah gagal; penjualan tetap selesai di lokal dan akan dicoba lagi.",
    dayClose: "Tutup hari",
    dayCloseBack: "Kembali ke menu",
    dayCloseSummary: "Ringkasan hari",
    dayCloseSalesTotal: "Total penjualan",
    dayCloseCash: "Ringkasan tunai",
    dayCloseTxCount: "Transaksi",
    dayCloseSyncOk: "Semua penjualan selesai sudah diunggah.",
    dayCloseSyncPending: "penjualan selesai menunggu unggah",
    dayCloseAckLabel:
      "Saya memahami ada {count} penjualan selesai yang masih menunggu unggah. Data tetap di perangkat ini untuk Sync setelah login berikutnya.",
    dayCloseAckRequired: "Centang pengakuan sebelum melanjutkan.",
    dayCloseContinue: "Lanjut ke laporan",
    dayCloseReport: "Laporan penjualan hari ini",
    dayCloseEmpty: "Belum ada penjualan selesai hari ini.",
    dayCloseStatusDone: "Selesai",
    dayCloseConfirm: "Konfirmasi tutup hari",
    dayCloseConfirmHint: "Ini mengakhiri sesi POS dan kembali ke layar masuk.",
    loading: "Memuat…",
    logout: "Keluar",
  };
}
