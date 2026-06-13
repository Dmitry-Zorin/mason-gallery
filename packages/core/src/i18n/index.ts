import { createContext, useContext } from "react";
import en from "./en";
import type { Locales, TranslationKeys } from "./i18n-types";

const translations: Record<Locales, TranslationKeys> = { en };

export function getTranslations(locale: Locales): TranslationKeys {
  // Fall back to English for any locale no longer bundled (e.g. a stale
  // persisted "zh" setting from before Chinese was removed).
  return translations[locale] ?? en;
}

export const I18nContext = createContext<TranslationKeys>(en);

export function useI18n(): TranslationKeys {
  return useContext(I18nContext);
}

export type { Locales, TranslationKeys };
