import type { Metadata } from "next";
import "./globals.css";
import { NavigationFeedback } from "@/components/navigation-feedback";
import { SessionProvider } from "@/components/session-provider";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = {
  title: {
    default: "BR Events — Eventos que acontecem de verdade",
    template: "%s — BR Events",
  },
  description:
    "Eventos, webinars e experiências ao vivo em uma plataforma simples para organizar e participar.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();
  return (
    <html lang="pt-BR" data-scroll-behavior="smooth">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Zalando+Sans+Expanded:wght@500;700;800&display=swap" />
      </head>
      <body>
        <SessionProvider initialUser={user}>
          <NavigationFeedback />
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
