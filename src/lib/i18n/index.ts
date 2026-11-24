import { authMessages } from "./messages/auth";
import { commonMessages } from "./messages/common";
import { dashboardMessages } from "./messages/dashboard";
import { eventMessages } from "./messages/event";
import { feedbackMessages } from "./messages/feedback";
import { hubMessages } from "./messages/hub";
import { liveMessages } from "./messages/live";
import { marketingMessages } from "./messages/marketing";
import { networkingMessages } from "./messages/networking";
import {
  defaultLocale,
  isLocale,
  localeCookieName,
  localeHtmlLang,
  localeIntl,
  locales,
  normalizeLocale,
} from "./types";
import type { Locale, TranslateVars, TranslationMessages } from "./types";

export { defaultLocale, isLocale, localeCookieName, localeHtmlLang, localeIntl, locales, normalizeLocale };
export type { Locale, TranslateVars };

export const localeLabels: Record<Locale, string> = {
  pt: "Português",
  en: "English",
  es: "Español",
};

const dictionaries: Record<Exclude<Locale, "pt">, TranslationMessages> = {
  en: {
    ...commonMessages.en,
    ...marketingMessages.en,
    ...authMessages.en,
    ...eventMessages.en,
    ...feedbackMessages.en,
    ...dashboardMessages.en,
    ...hubMessages.en,
    ...liveMessages.en,
    ...networkingMessages.en,
  },
  es: {
    ...commonMessages.es,
    ...marketingMessages.es,
    ...authMessages.es,
    ...eventMessages.es,
    ...feedbackMessages.es,
    ...dashboardMessages.es,
    ...hubMessages.es,
    ...liveMessages.es,
    ...networkingMessages.es,
  },
};

export function interpolate(text: string, vars?: TranslateVars): string {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = vars[name];
    return value === undefined || value === null ? match : String(value);
  });
}

export function hasTranslation(locale: Locale, key: string): boolean {
  return locale === "pt" || Object.prototype.hasOwnProperty.call(dictionaries[locale], key);
}

export function translateMessage(locale: Locale, key: string, vars?: TranslateVars): string {
  if (locale === "pt") return interpolate(key, vars);
  const text = dictionaries[locale][key] ?? key;
  return interpolate(text, vars);
}

export function formatDateValue(locale: Locale, value: string | number | Date, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(localeIntl[locale], options).format(new Date(value));
}

export function formatNumberValue(locale: Locale, value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(localeIntl[locale], options).format(value);
}
