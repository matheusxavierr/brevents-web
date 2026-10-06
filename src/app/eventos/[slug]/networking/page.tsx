import { notFound } from "next/navigation";
import { NetworkingLobby } from "@/components/networking-lobby";
import { getPublicEvent } from "@/lib/api-server";

export default async function NetworkingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await getPublicEvent(slug);
  if (!event) notFound();
  return <NetworkingLobby event={event} />;
}
