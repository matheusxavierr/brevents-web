import { notFound } from "next/navigation";
import { EventLanding } from "@/components/event-landing";
import { getPublicEvent } from "@/lib/api-server";

export default async function PublicEventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await getPublicEvent(slug);
  if (!event) notFound();
  return <EventLanding event={event} />;
}
