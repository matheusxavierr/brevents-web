import "server-only";
import { cookies } from "next/headers";

export async function hasEventGuestTicket(eventId: string) {
  return Boolean((await cookies()).get(`brevents_ticket_${eventId.replace(/[^a-zA-Z0-9_-]/g, "")}`)?.value);
}
