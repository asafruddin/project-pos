"use client";

import {
  DesktopIcon,
  MoonIcon,
  SunIcon,
  TranslateIcon,
} from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import {
  applyTheme,
  copy,
  getLang,
  getTheme,
  setLang,
  setTheme,
  type LangPref,
  type ThemePref,
} from "@/lib/preferences";
import { cn } from "@/lib/utils";

const THEME_ORDER: ThemePref[] = ["system", "light", "dark"];

function themeIcon(theme: ThemePref) {
  if (theme === "light") return <SunIcon size={18} weight="duotone" />;
  if (theme === "dark") return <MoonIcon size={18} weight="duotone" />;
  return <DesktopIcon size={18} weight="duotone" />;
}

function IconTooltip({
  label,
  children,
  className,
  side = "top",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  side?: "top" | "bottom";
}) {
  return (
    <div className={cn("group relative inline-flex", className)}>
      {children}
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-lg border border-border bg-popover px-2.5 py-1.5 text-xs font-medium text-popover-foreground opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100",
          side === "top" ? "bottom-full mb-2" : "top-full mt-2",
        )}
      >
        {label}
      </span>
    </div>
  );
}

/**
 * Always-visible theme + language icon controls (no nested settings menu).
 */
export function PrefControls({
  onLangChange,
  className,
  tooltipSide = "top",
}: {
  onLangChange?: () => void;
  className?: string;
  tooltipSide?: "top" | "bottom";
}) {
  const [theme, setThemeState] = useState<ThemePref>("system");
  const [lang, setLangState] = useState<LangPref>("id");
  const t = copy(lang);

  useEffect(() => {
    setThemeState(getTheme());
    setLangState(getLang());
    applyTheme(getTheme());
  }, []);

  function cycleTheme() {
    const idx = THEME_ORDER.indexOf(theme);
    const next = THEME_ORDER[(idx + 1) % THEME_ORDER.length] ?? "system";
    setTheme(next);
    setThemeState(next);
  }

  function toggleLang() {
    const next: LangPref = lang === "id" ? "en" : "id";
    setLang(next);
    setLangState(next);
    onLangChange?.();
  }

  const themeLabel =
    theme === "light"
      ? t.themeLight
      : theme === "dark"
        ? t.themeDark
        : t.themeSystem;
  const themeTip = `${t.theme}: ${themeLabel}`;
  const langName = lang === "id" ? "Indonesia" : "English";
  const langTip = `${t.language}: ${langName}`;

  return (
    <div className={cn("inline-flex items-center gap-1.5", className)}>
      <IconTooltip label={themeTip} side={tooltipSide}>
        <button
          type="button"
          onClick={cycleTheme}
          className="inline-flex h-11 min-h-11 w-11 items-center justify-center rounded-2xl border border-border bg-card text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={themeTip}
        >
          {themeIcon(theme)}
        </button>
      </IconTooltip>
      <IconTooltip label={langTip} side={tooltipSide}>
        <button
          type="button"
          onClick={toggleLang}
          className="inline-flex h-11 min-h-11 items-center justify-center gap-1.5 rounded-2xl border border-border bg-card px-2.5 text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={langTip}
        >
          <TranslateIcon size={18} weight="duotone" />
          <span className="min-w-[1.5rem] text-xs font-semibold tracking-wide">
            {lang.toUpperCase()}
          </span>
        </button>
      </IconTooltip>
    </div>
  );
}

/** @deprecated Use PrefControls — kept as alias for existing imports. */
export const SettingsMenu = PrefControls;
