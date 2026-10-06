import type { Metadata } from "next";

import { CompanyHubWorkspace } from "@/components/company-hub-workspace";

export const metadata: Metadata = { title: "Hub da empresa" };

export default function CompanyHubPage() {
  return <CompanyHubWorkspace />;
}
