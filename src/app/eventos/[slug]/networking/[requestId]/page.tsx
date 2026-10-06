import { notFound } from "next/navigation";
import { NetworkingRoom } from "@/components/networking-room";
import { getPublicEvent } from "@/lib/api-server";

export default async function NetworkingRoomPage({ params }: { params: Promise<{ slug: string; requestId: string }> }) {
  const { slug, requestId } = await params;
  const event = await getPublicEvent(slug);
  if (!event) notFound();
  return <NetworkingRoom event={event} requestId={requestId} />;
}
