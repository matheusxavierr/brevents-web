"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LoaderCircle, MessageSquareOff } from "lucide-react";
import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
import type { EventData, NetworkingRequest } from "@/lib/api-types";
import { ConnectedMeetingExperience } from "./connected-meeting-experience";

export function NetworkingRoom({ event, requestId }: { event: EventData; requestId: string }) {
  const router = useRouter();
  const [conversation, setConversation] = useState<NetworkingRequest | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    apiClient<NetworkingRequest>(`networking-requests/${requestId}/`)
      .then(setConversation)
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Conversa indisponível."));
  }, [requestId]);
  useEffect(() => {
    if (conversation?.status !== "accepted") return;
    const heartbeat = () => apiClient(`networking-requests/${requestId}/room-heartbeat/`, { method: "POST" }).catch(() => undefined);
    void heartbeat();
    const interval = window.setInterval(() => void heartbeat(), 20000);
    return () => window.clearInterval(interval);
  }, [conversation?.status, requestId]);
  if (error) return <main className="event-unavailable"><MessageSquareOff size={38} /><p className="eyebrow">Conversa privada</p><h1>Você não tem acesso a esta sala.</h1><p>{error}</p><Link className="button button-primary" href={`/eventos/${event.slug}/networking`}>Voltar ao networking</Link></main>;
  if (!conversation) return <main className="dashboard-loading"><LoaderCircle className="spin" /><p>Preparando a conversa 1:1…</p></main>;
  if (conversation.status !== "accepted" || !conversation.room_detail) return <main className="event-unavailable"><MessageSquareOff size={38} /><p className="eyebrow">Conversa encerrada</p><h1>Esta sala não está mais ativa.</h1><Link className="button button-primary" href={`/eventos/${event.slug}/networking`}>Voltar ao networking</Link></main>;
  function leaveRoom() {
    router.replace(`/eventos/${event.slug}/networking`);
  }
  return <ConnectedMeetingExperience event={event} roomOverride={conversation.room_detail} exitHref={`/eventos/${event.slug}/networking`} onExit={leaveRoom} />;
}
