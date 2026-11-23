import type { Metadata } from "next";

import { MyEventsPage } from "@/components/my-events-page";
import { getTranslator } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslator();
  return { title: t("Meus eventos") };
}

export default function MyEventsRoute() {
  return <MyEventsPage />;
}
