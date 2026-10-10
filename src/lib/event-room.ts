import { apiClient } from "./api-client";
import { listAll } from "./api-pagination";
import type { Room } from "./api-types";

export async function ensureEventAuditorium(eventId: string): Promise<Room> {
  const rooms = await listAll<Room>(`rooms/?event=${eventId}`);
  const existing = rooms.filter((room) => room.event === eventId && room.purpose !== "networking").sort((a, b) => a.position - b.position || a.name.localeCompare(b.name))[0];
  if (existing) return existing;
  return apiClient<Room>("rooms/", { method: "POST", body: {
    event: eventId, name: "Auditório principal", description: "Sala principal do evento", mode: "event", purpose: "main", position: 0,
    module_config: [
      { type: "call.zoom", config: { session_name: `brevents-${eventId}`, passcode: "" } },
      { type: "chat.native", config: { volatile: false } },
      { type: "question", config: { active: true, requires_moderation: true } },
      { type: "poll", config: { active: true } },
    ],
  } });
}
