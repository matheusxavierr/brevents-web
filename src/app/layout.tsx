import type { Metadata } from "next";
import "./globals.css";
import { I18nProvider } from "@/components/i18n-provider";
import { NavigationFeedback } from "@/components/navigation-feedback";
import { SessionProvider } from "@/components/session-provider";
import { localeHtmlLang } from "@/lib/i18n";
import { getTranslator } from "@/lib/i18n/server";
import { getCurrentUser } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslator();
  return {
    title: {
      default: t("BR Events — Eventos que acontecem de verdade"),
      template: "%s — BR Events",
    },
    description: t("Eventos, webinars e experiências ao vivo em uma plataforma simples para organizar e participar."),
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [user, { locale }] = await Promise.all([getCurrentUser(), getTranslator()]);
  return (
    <html lang={localeHtmlLang[locale]} data-scroll-behavior="smooth">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Zalando+Sans+Expanded:wght@500;700;800&display=swap" />
      </head>
      <body>
        <I18nProvider initialLocale={locale}>
          <SessionProvider initialUser={user}>
            <NavigationFeedback />
            {children}
          </SessionProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
