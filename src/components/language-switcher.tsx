"use client";

import { Languages } from "lucide-react";
import { useRouter } from "next/navigation";

import { isLocale, localeLabels, locales } from "@/lib/i18n";
import { useI18n } from "./i18n-provider";

export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { locale, setLocale, t } = useI18n();
  const router = useRouter();

  function change(value: string) {
    if (!isLocale(value)) return;
    setLocale(value);
    router.refresh();
  }

  return (
    <label className={`language-switcher ${className}`.trim()}>
      <Languages size={15} aria-hidden="true" />
      <span className="sr-only">{t("Idioma")}</span>
      <select value={locale} onChange={(event) => change(event.target.value)} aria-label={t("Idioma")}>
        {locales.map((value) => <option key={value} value={value}>{localeLabels[value]}</option>)}
      </select>
    </label>
  );
}
