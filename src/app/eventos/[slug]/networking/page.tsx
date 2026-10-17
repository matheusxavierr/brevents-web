import { notFound } from "next/navigation";
import { MatchmakingLobby } from "@/components/matchmaking-lobby";
import { getPublicEvent } from "@/lib/api-server";

export default async function NetworkingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await getPublicEvent(slug);
  if (!event) notFound();
  return <MatchmakingLobby event={event} />;
}
