import type { Metadata } from "next";

import { CompanyHubIntroduction } from "@/components/company-hub-introduction";

export const metadata: Metadata = { title: "Hub da empresa" };

export default function CompanyHubPage() {
  return <CompanyHubIntroduction />;
}
