import en from "./locales/en.json";
import ta from "./locales/ta.json";

export const defaultNS = "translation";
export const resources = {
  en: { translation: en },
  ta: { translation: ta },
} as const;

export type TranslationKeys = typeof en;

