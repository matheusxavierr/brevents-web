export const locales = ["pt", "en", "es"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "pt";

export const localeCookieName = "brevents_locale";

export const localeHtmlLang: Record<Locale, string> = {
  pt: "pt-BR",
  en: "en",
  es: "es",
};

export const localeIntl: Record<Locale, string> = {
  pt: "pt-BR",
  en: "en-US",
  es: "es-ES",
};

export type TranslateVars = Record<string, string | number>;

export type TranslationMessages = Record<string, string>;

export type I18nDictionary = Partial<Record<Locale, TranslationMessages>>;

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (locales as readonly string[]).includes(value);
}

export function normalizeLocale(value: string | null | undefined): Locale {
  return isLocale(value) ? value : defaultLocale;
}
