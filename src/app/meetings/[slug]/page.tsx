import { notFound } from "next/navigation";

import { ConnectedMeetingExperience } from "@/components/connected-meeting-experience";
import { getPublicEvent } from "@/lib/api-server";

export default async function MeetingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await getPublicEvent(slug);
  if (!event || event.public_config.product_type !== "meeting") notFound();
  return <ConnectedMeetingExperience event={event} />;
}
