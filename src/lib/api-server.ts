import { cookies } from "next/headers";
import type { EventData, Organization, Paginated, Recording, Room, Session } from "./api-types";

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
    if (!event) return null;

    const [roomResponse, sessionResponse, recordingResponse] = await Promise.all([
      fetch(`${API_URL}/rooms/?event=${event.id}`, { headers, cache: "no-store" }),
      fetch(`${API_URL}/sessions/?event=${event.id}`, { headers, cache: "no-store" }),
      fetch(`${API_URL}/recordings/?event=${event.id}`, { headers, cache: "no-store" }),
    ]);
    if (!roomResponse.ok || !sessionResponse.ok || !recordingResponse.ok) return null;
    const rooms = (await roomResponse.json()) as Paginated<Room>;
    const sessions = (await sessionResponse.json()) as Paginated<Session>;
    const recordings = (await recordingResponse.json()) as Paginated<Recording>;
    return { ...event, rooms: rooms.results, sessions: sessions.results, recordings: recordings.results };
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
