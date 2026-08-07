"use client";

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
import { Label } from "@/components/ui/label";

export function SettingsMenu({ onLangChange }: { onLangChange?: () => void }) {
  const [open, setOpen] = useState(false);
  const [theme, setThemeState] = useState<ThemePref>("system");
  const [lang, setLangState] = useState<LangPref>("id");
  const t = copy(lang);

  useEffect(() => {
    setThemeState(getTheme());
    setLangState(getLang());
    applyTheme(getTheme());
  }, []);

  function onTheme(next: ThemePref) {
    setTheme(next);
    setThemeState(next);
  }

  function onLanguage(next: LangPref) {
    setLang(next);
    setLangState(next);
    onLangChange?.();
  }

  return (
    <div className="relative">
      <button
        type="button"
        className="inline-flex h-12 min-h-12 items-center justify-center rounded-lg px-3 text-sm font-medium ring-1 ring-border"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((v) => !v)}
      >
        {t.settings}
      </button>
      {open ? (
        <div
          className="absolute right-0 z-20 mt-2 w-56 rounded-lg border border-border bg-card p-3 shadow-sm"
          role="dialog"
          aria-label={t.settings}
        >
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <Label>{t.theme}</Label>
              <select
                className="h-12 rounded-lg border border-border bg-background px-2 text-sm"
                value={theme}
                onChange={(e) => onTheme(e.target.value as ThemePref)}
              >
                <option value="system">{t.themeSystem}</option>
                <option value="light">{t.themeLight}</option>
                <option value="dark">{t.themeDark}</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <Label>{t.language}</Label>
              <select
                className="h-12 rounded-lg border border-border bg-background px-2 text-sm"
                value={lang}
                onChange={(e) => onLanguage(e.target.value as LangPref)}
              >
                <option value="id">Indonesia</option>
                <option value="en">English</option>
              </select>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
