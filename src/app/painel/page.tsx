import { OrganizerDashboard } from "@/components/organizer-dashboard";

export default async function OrganizerPage({ searchParams }: { searchParams: Promise<{ event?: string; tab?: string }> }) {
  const { event, tab } = await searchParams;
  return <OrganizerDashboard initialEventId={event} initialTab={tab === "settings" ? "settings" : "overview"} />;
}
