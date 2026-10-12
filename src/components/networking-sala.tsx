"use client";

import { DoorOpen, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { apiClient } from "@/lib/api-client";
import type { EventData, Room } from "@/lib/api-types";
import { ConnectedMeetingExperience } from "./connected-meeting-experience";
import { useSession } from "./session-provider";

export function NetworkingSala({ event, roomId }: { event: EventData; roomId: string }) {
  const router = useRouter();
  const { user } = useSession();
  const [room, setRoom] = useState<Room | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) {
      router.replace(`/entrar?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    let active = true;
    apiClient<Room>(`rooms/${roomId}/`)
      .then((data) => {
        if (active) setRoom(data);
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : "Sala indisponível.");
      });
    return () => {
      active = false;
    };
  }, [roomId, router, user]);

  function leaveRoom() {
    router.replace(`/eventos/${event.slug}/networking`);
  }

  if (error) {
    return <main className="event-unavailable"><DoorOpen size={38} /><p className="eyebrow">Sala de matchmaking</p><h1>Você não tem acesso a esta sala.</h1><p>{error}</p><Link className="button button-primary" href={`/eventos/${event.slug}/networking`}>Voltar ao matchmaking</Link></main>;
  }
  if (!room) {
    return <main className="dashboard-loading"><LoaderCircle className="spin" /><p>Abrindo a sala…</p></main>;
  }
  return <ConnectedMeetingExperience event={event} roomOverride={room} exitHref={`/eventos/${event.slug}/networking`} onExit={leaveRoom} exitLabel="Sair da sala" />;
}
