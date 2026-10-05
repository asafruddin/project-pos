import { copyEN } from "./copy-en";
import { extraEN } from "./extra-en";

export const en = { ...copyEN, ...extraEN } as const;
export type TranslationKey = keyof typeof en;
