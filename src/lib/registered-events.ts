import { apiClient } from "./api-client";
import type { EventData, Paginated, Registration } from "./api-types";

export function registrationIsActive(registration: Registration) {
  return registration.status !== "cancelled" && registration.status !== "blocked";
}

export async function loadRegisteredEvents(): Promise<EventData[]> {
  const [registrationPage, eventPage] = await Promise.all([
    apiClient<Paginated<Registration>>("registrations/"),
    apiClient<Paginated<EventData>>("events/"),
  ]);
  const registeredIds = new Set(
    registrationPage.results.filter(registrationIsActive).map((registration) => registration.event),
  );
  return eventPage.results
    .filter((event) => registeredIds.has(event.id) && event.public_config.product_type !== "meeting")
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
}
