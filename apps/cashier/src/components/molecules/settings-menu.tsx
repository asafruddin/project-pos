"use client";

import { Button } from "@pos-apps/ui/atoms";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@pos-apps/ui/molecules";
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
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={cycleTheme}
            className="size-9"
            aria-label={themeTip}
          >
            {themeIcon(theme)}
          </Button>
        </TooltipTrigger>
        <TooltipContent side={tooltipSide}>{themeTip}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="outline"
            onClick={toggleLang}
            className="h-9 px-2.5"
            aria-label={langTip}
          >
            <TranslateIcon size={18} weight="duotone" />
            <span className="min-w-[1.5rem] text-xs font-semibold tracking-wide">
              {lang.toUpperCase()}
            </span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side={tooltipSide}>{langTip}</TooltipContent>
      </Tooltip>
    </div>
  );
}

/** @deprecated Use PrefControls — kept as alias for existing imports. */
export const SettingsMenu = PrefControls;
