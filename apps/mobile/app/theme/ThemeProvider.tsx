import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useColorScheme } from "react-native";
import { useStore } from "zustand";
import type { PreferencesStore, ThemePref } from "@/features/settings/domain/preferences";
import { darkColors, lightColors, type ColorTokens } from "./tokens";

export type Theme = {
  colors: ColorTokens;
  dark: boolean;
  pref: ThemePref;
};

const ThemeContext = createContext<Theme>({ colors: lightColors, dark: false, pref: "system" });

export function resolveDark(pref: ThemePref, system: string | null | undefined): boolean {
  return pref === "dark" || (pref !== "light" && system === "dark");
}

export function ThemeProvider({ store, children }: { store: PreferencesStore; children: ReactNode }) {
  const pref = useStore(store, (s) => s.theme);
  const system = useColorScheme();
  const value = useMemo<Theme>(() => {
    const dark = resolveDark(pref, system);
    return { colors: dark ? darkColors : lightColors, dark, pref };
  }, [pref, system]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
