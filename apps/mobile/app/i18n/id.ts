import { copyID } from "./copy-id";
import { extraID } from "./extra-id";
import type { TranslationKey } from "./en";

export const id: Record<TranslationKey, string> = { ...copyID, ...extraID };
