import type { Metadata } from "next";
import "@fontsource-variable/baloo-2";
import "@fontsource/archivo/400.css";
import "@fontsource/archivo/600.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./globals.css";
import { NavigationFeedback } from "@/components/navigation-feedback";

export const metadata: Metadata = {
  title: {
    default: "BR Events — Eventos que acontecem de verdade",
    template: "%s — BR Events",
  },
  description:
    "Eventos, webinars e experiências ao vivo em uma plataforma simples para organizar e participar.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" data-scroll-behavior="smooth">
      <body><NavigationFeedback />{children}</body>
    </html>
  );
}
