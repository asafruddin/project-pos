/**
 * Design tokens ported 1:1 from apps/cashier/src/app/globals.css
 * (`:root` = light, `.dark` = dark). Keep names aligned with the PWA's CSS variables.
 */
export type ColorTokens = {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  border: string;
  input: string;
  ring: string;
  success: string;
  successForeground: string;
  warning: string;
  warningForeground: string;
  /** Backdrop behind dialogs and sheets. */
  overlay: string;
  /** Hero scrim used on branded surfaces. */
  heroOverlay: string;
};

export const lightColors: ColorTokens = {
  background: "#f4f6f8",
  foreground: "#111827",
  card: "#ffffff",
  cardForeground: "#111827",
  popover: "#ffffff",
  popoverForeground: "#111827",
  primary: "#f97316",
  primaryForeground: "#ffffff",
  secondary: "#f3f4f6",
  secondaryForeground: "#111827",
  muted: "#eef0f4",
  mutedForeground: "#6b7280",
  accent: "#fff4eb",
  accentForeground: "#c2410c",
  destructive: "#ef4444",
  destructiveForeground: "#ffffff",
  border: "#e6e8ee",
  input: "#e6e8ee",
  ring: "#f97316",
  success: "#16a34a",
  successForeground: "#ffffff",
  warning: "#f59e0b",
  warningForeground: "#1a1208",
  overlay: "rgba(0,0,0,0.5)",
  heroOverlay: "rgba(26,18,8,0.45)",
};

export const darkColors: ColorTokens = {
  background: "#121212",
  foreground: "#f4f4f5",
  card: "#1e1e1e",
  cardForeground: "#f4f4f5",
  popover: "#242424",
  popoverForeground: "#f4f4f5",
  primary: "#f97316",
  primaryForeground: "#ffffff",
  secondary: "#2a2a2a",
  secondaryForeground: "#fafafa",
  muted: "#2a2a2a",
  mutedForeground: "#a1a1aa",
  accent: "#3b2416",
  accentForeground: "#fdba74",
  destructive: "#f87171",
  destructiveForeground: "#1a0505",
  border: "#333333",
  input: "#333333",
  ring: "#fb923c",
  success: "#22c55e",
  successForeground: "#052e14",
  warning: "#fbbf24",
  warningForeground: "#1a1208",
  overlay: "rgba(0,0,0,0.6)",
  heroOverlay: "rgba(5,7,12,0.62)",
};

/** `--radius: 0.75rem` (12px) and the derived steps used by the PWA. */
export const radius = {
  sm: 8,
  md: 10,
  lg: 12,
  xl: 16,
  "2xl": 20,
  "3xl": 24,
  full: 999,
} as const;

export const spacing = { 0.5: 2, 1: 4, 1.5: 6, 2: 8, 2.5: 10, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40 } as const;

/** Breakpoints used by the PWA (Tailwind md / lg). */
export const breakpoints = { md: 768, lg: 1024 } as const;

/** Minimum comfortable touch target (the PWA uses 44–56px on touch controls). */
export const TOUCH_MIN = 44;
