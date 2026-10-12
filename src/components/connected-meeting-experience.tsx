"use client";

import { ChevronLeft, FileText, LockKeyhole, MessageSquare, PanelRightClose, PanelRightOpen, Send } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CSSProperties, FormEvent, PointerEvent, useCallback, useEffect, useRef, useState } from "react";

import { ApiError, apiClient } from "@/lib/api-client";
import type { ChatChannel, ChatMessage, EventData, Paginated, Room, User } from "@/lib/api-types";
import { isFatalRealtimeClose, realtimeReconnectDelay, websocketBaseUrl } from "@/lib/realtime";
import { formatChatTime } from "@/lib/format-date";
import { normalizeRealtimeChatMessage } from "@/lib/chat";
import { useTranscript } from "./use-transcript";
import { TranscriptDownload, TranscriptPanel } from "./transcript-panel";
import { Brand } from "./brand";
import { ZoomVideoRoom } from "./zoom-video-room";
import { useSession } from "./session-provider";

type MeetingTab = "chat" | "transcript";
type JoinResponse = { token: string };

export function ConnectedMeetingExperience({ event, roomOverride, exitHref = "/", onExit, exitLabel = "Encerrar conversa" }: { event: EventData; roomOverride?: Room; exitHref?: string; onExit?: () => void; exitLabel?: string }) {
  const router = useRouter();
  const { user: sessionUser } = useSession();
  const room = roomOverride ?? event.rooms?.find((item) => item.mode === "meeting" && item.zoom_session) ?? event.rooms?.[0];
  const [user, setUser] = useState<User | null>(null);
  const [accessGranted, setAccessGranted] = useState(false);
  const [channel, setChannel] = useState<ChatChannel | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [tab, setTab] = useState<MeetingTab>("chat");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [realtimeNotice, setRealtimeNotice] = useState("");
  const [connected, setConnected] = useState(false);
  const [inRoom, setInRoom] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);
  const joinedOnce = useRef(false);
  const transcript = useTranscript({ sessionId: room?.zoom_session?.id, eventId: event.id, enabled: hasJoined, refreshKey: inRoom, title: event.name, roomName: room?.name ?? "Reunião", timeZone: event.timezone });
  const captions = transcript.captions;
  const changeJoined = useCallback((joined: boolean) => {
    setInRoom(joined);
    if (joined) { joinedOnce.current = true; setHasJoined(true); }
    else if (joinedOnce.current) setTab("transcript");
  }, []);
  const [sheetHeight, setSheetHeight] = useState(32);
  const [sheetDragging, setSheetDragging] = useState(false);
  const sheetDrag = useRef<{ y: number; height: number } | null>(null);
  const [interactionHidden, setInteractionHidden] = useState(false);
  const [exitConfirmationOpen, setExitConfirmationOpen] = useState(false);
  const socket = useRef<WebSocket | null>(null);
  const requestId = useRef(1);
  const interactionContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleSessionExpired = () => {
      setRealtimeNotice("Sua sessão expirou. Entre novamente para continuar usando chat e transcrição.");
    };
    window.addEventListener("brevents:session-expired", handleSessionExpired);
    return () => window.removeEventListener("brevents:session-expired", handleSessionExpired);
  }, []);

  useEffect(() => {
    if (!room) return;
    let cancelled = false;

    async function ensureMeetingAccess(activeUser: User) {
      try {
        return await apiClient<JoinResponse>(`events/${event.id}/join-token/`, { method: "POST" });
      } catch (reason) {
        if (!(reason instanceof ApiError) || reason.status !== 403) throw reason;
        try {
          await apiClient("registrations/", {
            method: "POST",
            body: { event: event.id, name: activeUser.name || activeUser.username, email: activeUser.email },
          });
        } catch (registrationError) {
          if (!(registrationError instanceof ApiError) || registrationError.status !== 400) throw registrationError;
        }
        return apiClient<JoinResponse>(`events/${event.id}/join-token/`, { method: "POST" });
      }
    }

    async function load() {
      try {
        if (!sessionUser) {
          router.replace(`/entrar?next=${encodeURIComponent(window.location.pathname)}`);
          return;
        }
        if (cancelled) return;
        setUser(sessionUser);
        await ensureMeetingAccess(sessionUser);
        if (cancelled) return;
        setAccessGranted(true);
      } catch (reason) {
        console.error("Não foi possível entrar na reunião.", reason);
        setError(reason instanceof Error ? reason.message : "Não foi possível entrar na reunião.");
      }
    }

    void load();
    return () => {
      cancelled = true;
      socket.current?.close();
    };
  }, [event.id, room, router, sessionUser]);

  useEffect(() => {
    if (!room || !inRoom) return;
    const activeRoom = room;
    let cancelled = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectAttempt = 0;

    async function connectCollaboration() {
      try {
        const join = await apiClient<JoinResponse>(`events/${event.id}/join-token/`, { method: "POST" });
        if (cancelled) return;
        const channels = await apiClient<Paginated<ChatChannel>>(`chat/channels/?event=${event.id}&room=${activeRoom.id}`);
        if (cancelled) return;
        const activeChannel = channels.results[0] ?? null;
        setChannel(activeChannel);
        if (activeChannel) {
          const history = await apiClient<Paginated<ChatMessage>>(`chat/messages/?channel=${activeChannel.id}`);
          if (!cancelled) setMessages(history.results);
        }


        if (cancelled) return;
        const wsBase = websocketBaseUrl(process.env.NEXT_PUBLIC_BREVENTS_WS_URL);
        const ws = new WebSocket(`${wsBase}/events/${event.id}/?token=${encodeURIComponent(join.token)}`);
        socket.current = ws;
        ws.onopen = () => {
          if (cancelled) return;
          reconnectAttempt = 0;
          setConnected(true);
          setRealtimeNotice("");
          ws.send(JSON.stringify(["room.join", requestId.current++, { room: activeRoom.id }]));
          if (activeChannel) ws.send(JSON.stringify(["chat.subscribe", requestId.current++, { channel: activeChannel.id }]));
        };
        ws.onmessage = (incoming) => {
          const [type, , payload] = JSON.parse(incoming.data) as [string, number | null, Record<string, unknown>];
          if (type === "chat.event" || type === "chat.send.success") {
            const nextMessage = normalizeRealtimeChatMessage(payload);
            setMessages((current) => current.some((item) => item.id === nextMessage.id) ? current : [...current, nextMessage]);
          }
        };
        // Browsers emit `close` after an error; reconnection is centralized there.
        ws.onerror = () => undefined;
        ws.onclose = (closeEvent) => {
          if (socket.current === ws) socket.current = null;
          setConnected(false);
          if (cancelled) return;
          if (isFatalRealtimeClose(closeEvent.code)) {
            setRealtimeNotice("Seu acesso ao chat e à transcrição desta reunião foi encerrado.");
            return;
          }
          setRealtimeNotice("Reconectando chat e transcrição…");
          reconnectTimer = setTimeout(() => {
            reconnectAttempt += 1;
            void connectCollaboration();
          }, realtimeReconnectDelay(reconnectAttempt));
        };
      } catch (reason) {
        console.error("Não foi possível abrir o chat da reunião.", reason);
        if (cancelled) return;
        if (reason instanceof ApiError && reason.status === 401) {
          setRealtimeNotice("Sua sessão expirou. Entre novamente para continuar usando chat e transcrição.");
          return;
        }
        setRealtimeNotice("Reconectando chat e transcrição…");
        reconnectTimer = setTimeout(() => {
          reconnectAttempt += 1;
          void connectCollaboration();
        }, realtimeReconnectDelay(reconnectAttempt));
      }
    }

    void connectCollaboration();
    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket.current?.close(1000, "leaving meeting");
      socket.current = null;
      setConnected(false);
      setChannel(null);
      setMessages([]);
      setRealtimeNotice("");
    };
  }, [event.id, inRoom, room]);

  useEffect(() => {
    const content = interactionContentRef.current;
    const entries = tab === "chat" ? messages : captions;
    if (!hasJoined || !content || entries.length === 0) return;
    const frame = window.requestAnimationFrame(() => content.scrollTo({ top: content.scrollHeight, behavior: "smooth" }));
    return () => window.cancelAnimationFrame(frame);
  }, [captions, hasJoined, messages, tab]);

  function sendMessage(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    const body = message.trim();
    if (!body || !channel || socket.current?.readyState !== WebSocket.OPEN) return;
    socket.current.send(JSON.stringify(["chat.send", requestId.current++, { channel: channel.id, body }]));
    setMessage("");
  }

  function startSheetDrag(event: PointerEvent<HTMLButtonElement>) {
    sheetDrag.current = { y: event.clientY, height: sheetHeight };
    setSheetDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveSheetDrag(event: PointerEvent<HTMLButtonElement>) {
    if (!sheetDrag.current) return;
    const delta = (sheetDrag.current.y - event.clientY) / window.innerHeight * 100;
    setSheetHeight(Math.min(50, Math.max(5, sheetDrag.current.height + delta)));
  }

  function endSheetDrag() {
    sheetDrag.current = null;
    setSheetDragging(false);
    setSheetHeight((height) => height < 15 ? 5 : height > 41 ? 50 : 32);
  }

  function confirmExit() {
    setExitConfirmationOpen(false);
    if (onExit) {
      onExit();
      return;
    }
    router.push(exitHref);
  }

  if (!room) return <main className="empty-state"><h1>Esta reunião não possui uma sala.</h1><Link className="button button-secondary" href="/">Voltar ao início</Link></main>;

  return (
    <main className="live-page meeting-live-page">
      <header className="live-header">
        <div className="container live-header-inner">
          <Brand />
          <span className="live-header-title">{event.name} · {inRoom ? connected ? "conectado" : "reunião ativa · reconectando chat" : hasJoined ? "fora da sala" : "pré-sala"}</span>
          <button className="button live-exit" type="button" onClick={() => setExitConfirmationOpen(true)}><ChevronLeft size={16} /><span className="live-exit-desktop">{onExit ? exitLabel : "Voltar pra Home"}</span><span className="live-exit-mobile">Voltar</span></button>
        </div>
      </header>
      <div className={`live-layout${interactionHidden ? " meeting-panel-hidden" : ""}${!hasJoined ? " meeting-prejoin-layout" : ""}${sheetDragging ? " meeting-sheet-dragging" : ""}${sheetHeight === 5 ? " meeting-sheet-collapsed" : ""}`} style={{ "--meeting-sheet-height": `${sheetHeight}dvh` } as CSSProperties}>
        <section className="video-column" aria-label="Reunião ao vivo">
          <div className="video-player">
            {accessGranted && room.zoom_session
              ? <ZoomVideoRoom session={room.zoom_session} eventId={event.id} roomMode="meeting" onCaption={transcript.addCaption} onJoinedChange={changeJoined} />
              : <div className="video-center"><span className="navigation-spinner" /><p>Preparando sua reunião…</p></div>}
          </div>
          {error && <p className="live-error" role="alert">{error}</p>}
          {realtimeNotice && <p className="live-error" role="status">{realtimeNotice}</p>}
        </section>
        <aside className={`interaction-panel meeting-interaction-panel${hasJoined ? "" : " meeting-interaction-locked"}`}>
          {hasJoined && <button type="button" className="meeting-sheet-handle" aria-label="Arrastar para ajustar o chat" aria-expanded={sheetHeight !== 5} onPointerDown={startSheetDrag} onPointerMove={moveSheetDrag} onPointerUp={endSheetDrag} onPointerCancel={endSheetDrag} onKeyDown={(event) => { if (event.key === "ArrowUp" || event.key === "ArrowDown") { event.preventDefault(); setSheetHeight((height) => event.key === "ArrowUp" ? height === 5 ? 32 : 50 : height === 50 ? 32 : 5); } }}><span /></button>}
          {hasJoined && <button className="meeting-panel-toggle" type="button" aria-label={interactionHidden ? "Mostrar chat e transcrição" : "Ocultar chat e transcrição"} aria-expanded={!interactionHidden} onClick={() => setInteractionHidden((current) => !current)}>{interactionHidden ? <PanelRightOpen size={17} /> : <PanelRightClose size={17} />}</button>}
          {!hasJoined ? <div className="meeting-access-locked">
            <span><LockKeyhole size={22} /></span>
            <strong>Chat e transcrição da reunião</strong>
            <p>Entre na reunião para acessar a conversa e acompanhar a transcrição.</p>
          </div> : <>
          <div className="interaction-tabs" role="tablist">
            <button className={`interaction-tab${tab === "chat" ? " active" : ""}`} role="tab" aria-selected={tab === "chat"} onClick={() => setTab("chat")}><MessageSquare size={15} /> Chat</button>
            <button className={`interaction-tab${tab === "transcript" ? " active" : ""}`} role="tab" aria-selected={tab === "transcript"} onClick={() => setTab("transcript")}><FileText size={15} /> Transcrição</button>
          </div>
          <div className="interaction-content" ref={interactionContentRef}>
            {tab === "chat" && (messages.length
              ? messages.map((item) => <article className="message" key={item.id}><span className="avatar">{(item.sender?.first_name || item.sender?.name || item.sender?.username || "?").slice(0, 2).toUpperCase()}</span><div><strong>{item.sender ? item.sender.name || `${item.sender.first_name ?? ""} ${item.sender.last_name ?? ""}`.trim() || item.sender.username : "Participante"}</strong><time>{formatChatTime(item.created_at)}</time><p>{item.body}</p></div></article>)
              : <div className="meeting-panel-empty"><MessageSquare size={24} /><strong>Conversa aberta</strong><span>As mensagens da reunião aparecerão aqui.</span></div>)}
            {tab === "transcript" && <TranscriptPanel {...transcript} ended={!inRoom} />}
          </div>
          {tab === "chat" && inRoom && <form className="composer" onSubmit={sendMessage}><label className="sr-only" htmlFor="meeting-chat-message">Mensagem</label><input id="meeting-chat-message" value={message} onChange={(event) => setMessage(event.target.value)} placeholder={user ? `Mensagem como ${user.first_name || user.username}` : "Escreva uma mensagem"} /><button className="icon-button" type="submit" aria-label="Enviar"><Send size={17} /></button></form>}
          </>}
        </aside>
      </div>
      {exitConfirmationOpen && <div className="meeting-confirm-backdrop" role="presentation" onMouseDown={() => setExitConfirmationOpen(false)}>
        <section className="meeting-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="leave-meeting-title" onMouseDown={(event) => event.stopPropagation()}>
          <ChevronLeft size={24} aria-hidden="true" />
          <p className="eyebrow">Sair da reunião</p>
          <h2 id="leave-meeting-title">Quer voltar para a Home?</h2>
          <p>Você sairá desta sala e poderá entrar novamente pelo link enquanto a reunião estiver aberta.</p>
          {hasJoined && <TranscriptDownload {...transcript} />}
          {transcript.error && <p role="alert">{transcript.error}</p>}
          <div className="meeting-confirm-actions"><button className="button button-secondary" type="button" onClick={() => setExitConfirmationOpen(false)}>Continuar na reunião</button><button className="button button-primary" type="button" onClick={confirmExit}>Voltar para a Home</button></div>
        </section>
      </div>}
    </main>
  );
}
