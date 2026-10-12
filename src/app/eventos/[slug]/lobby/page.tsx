import { notFound } from "next/navigation";
import { EventLobby } from "@/components/event-lobby";
import { getPublicEvent } from "@/lib/api-server";
import { hasEventGuestTicket } from "@/lib/event-access-server";

export default async function EventLobbyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await getPublicEvent(slug);
  if (!event) notFound();
  return <EventLobby event={event} hasGuestTicket={await hasEventGuestTicket(event.id)} />;
}
