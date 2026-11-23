import { cookies } from "next/headers";

import { defaultLocale, localeCookieName, normalizeLocale, translateMessage } from "@/lib/i18n";
import type { Locale, TranslateVars } from "@/lib/i18n";

export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  return normalizeLocale(store.get(localeCookieName)?.value ?? defaultLocale);
}

export async function getTranslator(): Promise<{ locale: Locale; t: (key: string, vars?: TranslateVars) => string }> {
  const locale = await getLocale();
  return {
    locale,
    t: (key, vars) => translateMessage(locale, key, vars),
  };
}
