import { notFound } from "next/navigation";
import { ConnectedLiveExperience } from "@/components/connected-live-experience";
import { getPublicEvent } from "@/lib/api-server";

export default async function LivePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; const event = await getPublicEvent(slug); if (!event) notFound();
  return <ConnectedLiveExperience event={event} />;
}
