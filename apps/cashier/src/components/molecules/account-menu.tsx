"use client";

import { Button } from "@pos-apps/ui/atoms";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  StoreLogo,
} from "@pos-apps/ui/molecules";
import {
  DesktopIcon,
  GearIcon,
  MoonIcon,
  SignOutIcon,
  SunIcon,
  TranslateIcon,
} from "@phosphor-icons/react";
import Link from "next/link";
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

const THEME_ORDER: ThemePref[] = ["system", "light", "dark"];

function themeIcon(theme: ThemePref) {
  if (theme === "light") return <SunIcon size={16} weight="duotone" />;
  if (theme === "dark") return <MoonIcon size={16} weight="duotone" />;
  return <DesktopIcon size={16} weight="duotone" />;
}

export function AccountMenu({
  storeName,
  storeLogoSrc,
  roleLabel,
  initials,
  lang,
  onLangChange,
  onLogout,
}: {
  storeName: string;
  storeLogoSrc?: string | null;
  roleLabel: string;
  initials: string;
  lang: LangPref;
  onLangChange?: () => void;
  onLogout: () => void;
}) {
  const t = copy(lang);
  const [theme, setThemeState] = useState<ThemePref>("system");

  useEffect(() => {
    setThemeState(getTheme());
    applyTheme(getTheme());
  }, []);

  function cycleTheme() {
    const idx = THEME_ORDER.indexOf(theme);
    const next = THEME_ORDER[(idx + 1) % THEME_ORDER.length] ?? "system";
    setTheme(next);
    setThemeState(next);
  }

  function toggleLang() {
    const next: LangPref = getLang() === "id" ? "en" : "id";
    setLang(next);
    onLangChange?.();
  }

  const themeLabel =
    theme === "light"
      ? t.themeLight
      : theme === "dark"
        ? t.themeDark
        : t.themeSystem;
  const langName = lang === "id" ? "Indonesia" : "English";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-8 overflow-hidden rounded-lg p-0 lg:hidden"
          aria-label={storeName}
        >
          {storeLogoSrc ? (
            <StoreLogo
              src={storeLogoSrc}
              alt=""
              size="sm"
              className="size-8 rounded-lg"
            />
          ) : (
            <span className="text-[10px] font-semibold">{initials || "POS"}</span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate font-medium">{storeName}</p>
          <p className="truncate text-xs font-normal text-muted-foreground">
            {roleLabel}
          </p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault();
            cycleTheme();
          }}
        >
          {themeIcon(theme)}
          {t.theme}: {themeLabel}
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault();
            toggleLang();
          }}
        >
          <TranslateIcon size={16} weight="duotone" />
          {t.language}: {langName}
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <GearIcon size={16} weight="duotone" />
            {t.settings}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={onLogout}>
          <SignOutIcon size={16} weight="bold" />
          {t.logout}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
