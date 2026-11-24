import { notFound } from "next/navigation";

import { PostEventPage } from "@/components/post-event-page";
import { getPublicEvent } from "@/lib/api-server";

export default async function EventPostEventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await getPublicEvent(slug);
  if (!event) notFound();
  return <PostEventPage event={event} />;
}
