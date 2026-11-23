"use client";

import { Building2, Clock3, DoorOpen, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { apiClient } from "@/lib/api-client";
import type { EventData, Room } from "@/lib/api-types";
import { ConnectedMeetingExperience } from "./connected-meeting-experience";
import { useSession } from "./session-provider";
import { useMatchmaking, roundClock } from "./use-matchmaking";
import { Dialog } from "./event-dashboard/shared";
import styles from "./matchmaking.module.css";

export function NetworkingSala({ event, roomId }: { event: EventData; roomId: string }) {
  const router = useRouter();
  const { user } = useSession();
  const [fetchedRoom, setFetchedRoom] = useState<Room | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [error, setError] = useState("");
  const { data, now, error: stateError, refresh } = useMatchmaking(event.id, Boolean(user));
  const [ending, setEnding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [joinedBefore, setJoinedBefore] = useState(false);
  const latestRound = useRef<string | null>(null);
  const coordinator = data?.role === "coordinator";
  const managedRoom = coordinator ? data.rooms?.find((entry) => entry.room.id === roomId) : undefined;
  const activeRound = coordinator ? managedRoom?.round : data?.round;
  const [joinedSession, setJoinedSession] = useState<string | null>(null);
  const [requestingSupport, setRequestingSupport] = useState(false);
  const expired = Boolean(activeRound && now >= Date.parse(activeRound.expires_at));
  const [wasAssigned, setWasAssigned] = useState(false);
  if (activeRound && !wasAssigned) setWasAssigned(true);
  const candidate = managedRoom?.room ?? (data?.room?.id === roomId ? data.room : fetchedRoom);
  if (candidate && (candidate.id !== room?.id || candidate.zoom_session?.session_name !== room?.zoom_session?.session_name)) setRoom(candidate);

  useEffect(() => {
    latestRound.current = activeRound?.id ?? null;
    if (!data) return;
    if ((data.role === "coordinator" && (!activeRound || expired)) || data.own_room_available === false || (!data.open && !activeRound) || (data.role === "exporter" && data.room?.id !== roomId) || (data.role === "importer" && (!activeRound || expired || activeRound.room !== roomId))) {
      router.replace(`/eventos/${event.slug}/networking`);
      return;
    }
  }, [data, activeRound, expired, roomId, event.slug, router]);

  async function requestSupport() {
    if (!activeRound || requestingSupport) return;
    setRequestingSupport(true);
    setError("");
    try {
      await apiClient("matchmaking/support/", { method: "POST", body: { event: event.id, round: activeRound.id } });
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível solicitar suporte.");
    } finally {
      setRequestingSupport(false);
    }
  }

  async function finish() {
    if (!latestRound.current) return;
    setBusy(true); setError("");
    try {
      await apiClient("matchmaking/end/", { method: "POST", body: { event: event.id, round: latestRound.current } });
      setEnding(false); await refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível encerrar a conversa."); }
    finally { setBusy(false); }
  }

  useEffect(() => {
    if (!user) {
      router.replace(`/entrar?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    let active = true;
    apiClient<Room>(`rooms/${roomId}/`)
      .then((data) => {
        if (active && !data.coordinated) setFetchedRoom(data);
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : "Sala indisponível.");
      });
    return () => {
      active = false;
    };
  }, [roomId, router, user]);

  function leaveRoom() {
    if (coordinator) { router.replace(`/eventos/${event.slug}/networking`); return; }
    if (activeRound && !expired) { void finish(); return; }
    router.replace(`/eventos/${event.slug}/lobby`);
  }

  if ((error || stateError) && !room) {
    return <main className="event-unavailable"><DoorOpen size={38} /><p className="eyebrow">Sala de matchmaking</p><h1>Não foi possível abrir esta sala.</h1><p>{error || stateError}</p><Link className="button button-primary" href={`/eventos/${event.slug}/networking`}>Voltar ao matchmaking</Link></main>;
  }
  if (!room) {
    return <main className="dashboard-loading"><LoaderCircle className="spin" /><p>Abrindo a sala…</p></main>;
  }
  const allowed = !room.coordinated || (data?.role === "exporter" ? data.room?.id === roomId : Boolean(activeRound && !expired && activeRound.room === roomId));
  const clock = activeRound && !expired ? roundClock(activeRound.expires_at, now) : null;
  return <div className={room.coordinated ? styles.roomPage : undefined}>
    {room.coordinated && <div className={styles.roomNotice} role="status"><Building2 size={22} /><div><strong>{data?.role === "exporter" ? `Esta é a sua sala · ${room.company_name}` : `Reunião com ${room.company_name}`}</strong><small>{activeRound && !expired ? `${activeRound.exporter.name} + ${activeRound.importer.name} · rodada de negócios` : wasAssigned ? "Conversa concluída. Sua empresa está disponível para a próxima conexão." : "Sua empresa está pronta. Aguarde a coordenação direcionar um importador."}</small></div>{joinedSession && joinedSession === room.zoom_session?.session_name && activeRound && !expired && !coordinator && <button disabled={requestingSupport || Boolean(activeRound.support_requested_at)} onClick={() => void requestSupport()}>{activeRound.support_requested_at ? "Suporte solicitado" : "Pedir suporte"}</button>}{clock && <time><Clock3 size={14} /> {clock}</time>}{activeRound && !expired && <button onClick={() => setEnding(true)}>Encerrar rodada</button>}</div>}
    {allowed && !(expired && data?.role === "exporter") ? <ConnectedMeetingExperience key={room.zoom_session?.session_name} event={event} roomOverride={room} exitHref={`/eventos/${event.slug}/networking`} onExit={leaveRoom} onCallLeave={leaveRoom} exitLabel={coordinator ? "Voltar à coordenação" : activeRound ? "Encerrar conversa" : "Voltar ao lobby"} autoJoin={joinedBefore && !coordinator} onCallState={(joined) => {
      setJoinedSession(joined ? room.zoom_session?.session_name ?? null : null);
      if (!joined) return;
      setJoinedBefore(true);
      if (data?.role === "importer" && activeRound) {
        void apiClient("matchmaking/joined/", { method: "POST", body: { event: event.id, round: activeRound.id } })
          .catch((reason) => setError(reason instanceof Error ? reason.message : "Não foi possível registrar a participação."));
      }
    }} /> : <main className="dashboard-loading"><LoaderCircle className="spin" /><p>{expired ? "Conversa concluída. Voltando para a espera…" : "Validando seu direcionamento…"}</p></main>}
    {(error || stateError) && <p className={styles.error} role="alert">{error || stateError}</p>}
    {ending && <Dialog title="Encerrar a rodada?" busy={busy} onClose={() => setEnding(false)}><p>O importador voltará à área de espera e a empresa ficará disponível para a próxima conversa.</p><div className={styles.actions}><button disabled={busy} onClick={() => setEnding(false)}>Continuar conversa</button><button className={styles.danger} disabled={busy} onClick={() => void finish()}>Encerrar conversa</button></div></Dialog>}
  </div>;
}
