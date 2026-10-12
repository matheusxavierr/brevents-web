import { notFound } from "next/navigation";
import { CompanyHubView } from "@/components/company-hub-view";
import { HomeHeader } from "@/components/home-header";
import { getPublicOrganization } from "@/lib/api-server";

export default async function CompanyHubPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const organization = await getPublicOrganization(slug);
  if (!organization) notFound();
  return <><HomeHeader /><main><CompanyHubView organization={organization} /></main></>;
}
