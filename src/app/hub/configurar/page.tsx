import type { Metadata } from "next";
import { CompanyHubWorkspace } from "@/components/company-hub-workspace";
import { getTranslator } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslator();
  return { title: t("Configurar hub da empresa") };
}

export default function ConfigureCompanyHubPage() {
  return <CompanyHubWorkspace />;
}
