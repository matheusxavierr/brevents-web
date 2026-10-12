"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
import type { EventData } from "@/lib/api-types";
import { useSession } from "./session-provider";

export function useEventEntry(event: EventData, hasGuestTicket = false) {
  const { user } = useSession();
  const [entry, setEntry] = useState<{ userId: number | null; eventId: string; allowed: boolean } | null>(null);
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    apiClient(`events/${event.id}/join-token/`, { method: "POST" }).then(() => {
      if (!cancelled) setEntry({ userId: user.id, eventId: event.id, allowed: true });
    }).catch(() => { if (!cancelled) setEntry({ userId: user.id, eventId: event.id, allowed: false }); });
    return () => { cancelled = true; };
  }, [event.id, user]);
  if (!user) return hasGuestTicket && event.access_mode === "public" ? "ready" : "register";
  return entry?.userId === user.id && entry.eventId === event.id ? entry.allowed ? "ready" : "register" : "checking";
}
