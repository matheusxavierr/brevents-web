"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import {
  defaultLocale,
  localeCookieName,
  localeHtmlLang,
  localeIntl,
  normalizeLocale,
  translateMessage,
} from "@/lib/i18n";
import type { Locale, TranslateVars } from "@/lib/i18n";

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, vars?: TranslateVars) => string;
  intlLocale: string;
};

const fallbackContext: I18nContextValue = {
  locale: defaultLocale,
  setLocale: () => undefined,
  t: (key, vars) => translateMessage(defaultLocale, key, vars),
  intlLocale: localeIntl[defaultLocale],
};

const I18nContext = createContext<I18nContextValue>(fallbackContext);

export function I18nProvider({ initialLocale = defaultLocale, children }: { initialLocale?: Locale; children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => normalizeLocale(initialLocale));

  useEffect(() => {
    document.documentElement.lang = localeHtmlLang[locale];
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    const normalized = normalizeLocale(next);
    document.cookie = `${localeCookieName}=${normalized}; path=/; max-age=31536000; samesite=lax`;
    setLocaleState(normalized);
    window.dispatchEvent(new CustomEvent("brevents:locale-changed", { detail: normalized }));
  }, []);

  useEffect(() => {
    function handleLocaleChange(event: Event) {
      const detail = (event as CustomEvent<unknown>).detail;
      if (typeof detail === "string") setLocaleState(normalizeLocale(detail));
    }
    window.addEventListener("brevents:locale-changed", handleLocaleChange);
    return () => window.removeEventListener("brevents:locale-changed", handleLocaleChange);
  }, []);

  const value = useMemo<I18nContextValue>(() => ({
    locale,
    setLocale,
    t: (key, vars) => translateMessage(locale, key, vars),
    intlLocale: localeIntl[locale],
  }), [locale, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}

export function useT() {
  return useI18n().t;
}
