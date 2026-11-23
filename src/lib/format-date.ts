import { localeIntl } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

export function formatChatTime(value: string | null | undefined, locale: Locale = "pt") {
  if (!value) return "--:--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--:--";
  return date.toLocaleTimeString(localeIntl[locale], { hour: "2-digit", minute: "2-digit" });
}
