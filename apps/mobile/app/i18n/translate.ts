import { useSyncExternalStore } from "react";
import { en, type TranslationKey } from "./en";
import { id } from "./id";

export type Language = "id" | "en";

const dictionaries: Record<Language, Record<TranslationKey, string>> = { en, id };

let current: Language = "id";
const listeners = new Set<() => void>();

export function setLanguage(language: Language): void {
  if (language === current) return;
  current = language;
  for (const l of listeners) l();
}

export function getLanguage(): Language {
  return current;
}

export function subscribeLanguage(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export type Translate = (key: TranslationKey, vars?: Record<string, string | number>) => string;

/** `t("itemsCount", { n: 3 })` → "3 item". Missing keys fall back to English. `{name}` placeholders. */
export const t: Translate = (key, vars) => {
  const template = dictionaries[current][key] ?? en[key];
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? `{${name}}`));
};

/** Re-renders the caller when the language changes. */
export function useT(): { t: Translate; lang: Language } {
  const lang = useSyncExternalStore(subscribeLanguage, getLanguage, getLanguage);
  return { t, lang };
}

export function localeFor(lang: Language): string {
  return lang === "en" ? "en-US" : "id-ID";
}
