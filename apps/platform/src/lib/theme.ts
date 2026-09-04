const STORAGE_KEY = "pos-platform-theme";

export type Theme = "light" | "dark" | "system";

export function readStoredTheme(): Theme {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === "light" || value === "dark" || value === "system") return value;
  } catch {
    // Ignore private-mode / blocked storage.
  }
  return "system";
}

export function prefersDark(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function isDarkTheme(theme: Theme): boolean {
  if (theme === "dark") return true;
  if (theme === "light") return false;
  return prefersDark();
}

export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", isDarkTheme(theme));
}

export function persistTheme(theme: Theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Ignore private-mode / blocked storage.
  }
  applyTheme(theme);
}
