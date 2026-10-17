"use client";
import type { EventData, Registration, Room } from "@/lib/api-types";
import type { DashboardAction } from "./shared";
import { MatchmakingBoard } from "../matchmaking-board";

export function CompanyRoomsPanel({ event }: { event: EventData; registrations: Registration[]; rooms: Room[]; action: DashboardAction; busy: boolean }) {
  return <MatchmakingBoard key={event.id} event={event} />;
}
