import { createStore, type StoreApi } from "zustand/vanilla";
import type { Language } from "@/i18n";

export type ThemePref = "system" | "light" | "dark";
export type CatalogView = "grid" | "list";

export type PreferencesState = {
  theme: ThemePref;
  lang: Language;
  catalogView: CatalogView;
  setTheme(theme: ThemePref): void;
  setLang(lang: Language): void;
  setCatalogView(view: CatalogView): void;
};

export type PreferencesStore = StoreApi<PreferencesState>;

/** Minimal persistence port (backed by the SQLite kv table in the app). */
export interface PreferencesStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

const KEYS = { theme: "pref.theme", lang: "pref.lang", view: "pref.catalogView" } as const;
export const THEME_ORDER: ThemePref[] = ["system", "light", "dark"];

export function nextTheme(current: ThemePref): ThemePref {
  return THEME_ORDER[(THEME_ORDER.indexOf(current) + 1) % THEME_ORDER.length] ?? "system";
}

export function createPreferencesStore(
  storage: PreferencesStorage,
  onLang?: (lang: Language) => void,
): PreferencesStore {
  const theme = storage.get(KEYS.theme);
  const lang = storage.get(KEYS.lang);
  const view = storage.get(KEYS.view);
  const initial = {
    theme: (theme === "light" || theme === "dark" || theme === "system" ? theme : "system") as ThemePref,
    lang: (lang === "en" || lang === "id" ? lang : "id") as Language,
    catalogView: (view === "list" ? "list" : "grid") as CatalogView,
  };
  onLang?.(initial.lang);
  return createStore<PreferencesState>((set) => ({
    ...initial,
    setTheme(next) {
      storage.set(KEYS.theme, next);
      set({ theme: next });
    },
    setLang(next) {
      storage.set(KEYS.lang, next);
      onLang?.(next);
      set({ lang: next });
    },
    setCatalogView(next) {
      storage.set(KEYS.view, next);
      set({ catalogView: next });
    },
  }));
}
