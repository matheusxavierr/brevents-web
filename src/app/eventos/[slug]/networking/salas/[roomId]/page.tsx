import { notFound } from "next/navigation";
import { NetworkingSala } from "@/components/networking-sala";
import { getPublicEvent } from "@/lib/api-server";

export default async function NetworkingSalaPage({ params }: { params: Promise<{ slug: string; roomId: string }> }) {
  const { slug, roomId } = await params;
  const event = await getPublicEvent(slug);
  if (!event) notFound();
  return <NetworkingSala event={event} roomId={roomId} />;
}
