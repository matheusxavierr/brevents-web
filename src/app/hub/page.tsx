import type { Metadata } from "next";

import { CompanyHubIntroduction } from "@/components/company-hub-introduction";
import { getTranslator } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslator();
  return { title: t("Hub da empresa") };
}

export default function CompanyHubPage() {
  return <CompanyHubIntroduction />;
}
