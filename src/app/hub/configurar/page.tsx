import type { Metadata } from "next";
import { CompanyHubWorkspace } from "@/components/company-hub-workspace";

export const metadata: Metadata = { title: "Configurar hub da empresa" };

export default function ConfigureCompanyHubPage() {
  return <CompanyHubWorkspace />;
}
