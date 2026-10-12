import { cookies } from "next/headers";
import type { EventData, Organization, Paginated, Recording, Room, Session, Speaker } from "./api-types";

const API_URL = process.env.BREVENTS_API_URL ?? "http://127.0.0.1:8000/api";

export async function getPublicEvent(slug: string): Promise<EventData | null> {
  try {
    const response = await fetch(`${API_URL}/public/events/${encodeURIComponent(slug)}/`, { cache: "no-store" });
    if (response.ok) return (await response.json()) as EventData;

    const access = (await cookies()).get("brevents_access")?.value;
    if (!access) return null;
    const headers = { Authorization: `Bearer ${access}` };
    const managedResponse = await fetch(`${API_URL}/events/?managed=true`, { headers, cache: "no-store" });
    if (!managedResponse.ok) return null;
    const managed = (await managedResponse.json()) as Paginated<EventData>;
    const event = managed.results.find((item) => item.slug === slug);
    if (!event || event.status === "ended" || event.status === "archived") return null;

    const [roomResponse, sessionResponse, recordingResponse, speakerResponse] = await Promise.all([
      fetch(`${API_URL}/rooms/?event=${event.id}`, { headers, cache: "no-store" }),
      fetch(`${API_URL}/sessions/?event=${event.id}`, { headers, cache: "no-store" }),
      fetch(`${API_URL}/recordings/?event=${event.id}`, { headers, cache: "no-store" }),
      fetch(`${API_URL}/speakers/?event=${event.id}`, { headers, cache: "no-store" }),
    ]);
    if (!roomResponse.ok || !sessionResponse.ok || !recordingResponse.ok || !speakerResponse.ok) return null;
    const rooms = (await roomResponse.json()) as Paginated<Room>;
    const sessions = (await sessionResponse.json()) as Paginated<Session>;
    const recordings = (await recordingResponse.json()) as Paginated<Recording>;
    const speakers = (await speakerResponse.json()) as Paginated<Speaker>;
    return { ...event, rooms: rooms.results.filter((room) => room.event === event.id), sessions: sessions.results, recordings: recordings.results, speakers: speakers.results.filter((speaker) => speaker.event === event.id).map(({ id, name, bio, avatar_url }) => ({ id, name, bio, avatar_url })) };
  } catch {
    return null;
  }
}

export async function getPublicOrganization(slug: string): Promise<Organization | null> {
  try {
    const response = await fetch(`${API_URL}/public/organizations/${encodeURIComponent(slug)}/`, { cache: "no-store" });
    if (!response.ok) return null;
    return (await response.json()) as Organization;
  } catch {
    return null;
  }
}
