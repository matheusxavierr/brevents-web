"use client";

import { Check, ChevronLeft, Copy, FileText, LockKeyhole, MessageSquare, Send } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";

import { ApiError, apiClient } from "@/lib/api-client";
import type { ChatChannel, ChatMessage, EventData, LiveCaption, Paginated, Room, User } from "@/lib/api-types";
import { isFatalRealtimeClose, realtimeReconnectDelay, websocketBaseUrl } from "@/lib/realtime";
import { formatChatTime } from "@/lib/format-date";
import { Brand } from "./brand";
import { ZoomVideoRoom } from "./zoom-video-room";

type MeetingTab = "chat" | "transcript";
type JoinResponse = { token: string };

export function ConnectedMeetingExperience({ event, roomOverride, exitHref = "/", onExit }: { event: EventData; roomOverride?: Room; exitHref?: string; onExit?: () => void }) {
  const router = useRouter();
  const room = roomOverride ?? event.rooms?.find((item) => item.mode === "meeting" && item.zoom_session) ?? event.rooms?.[0];
  const [user, setUser] = useState<User | null>(null);
  const [accessGranted, setAccessGranted] = useState(false);
  const [channel, setChannel] = useState<ChatChannel | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [captions, setCaptions] = useState<LiveCaption[]>([]);
  const [tab, setTab] = useState<MeetingTab>("chat");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [realtimeNotice, setRealtimeNotice] = useState("");
  const [connected, setConnected] = useState(false);
  const [inRoom, setInRoom] = useState(false);
  const [copied, setCopied] = useState(false);
  const socket = useRef<WebSocket | null>(null);
  const requestId = useRef(1);

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
        const response = await fetch("/api/auth/me");
        if (!response.ok) {
          router.replace(`/entrar?next=${encodeURIComponent(window.location.pathname)}`);
          return;
        }
        const activeUser = await response.json() as User;
        if (cancelled) return;
        setUser(activeUser);
        await ensureMeetingAccess(activeUser);
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
  }, [event.id, room, router]);

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
        if (activeRoom.zoom_session) {
          apiClient<LiveCaption[]>(`zoom-sessions/${activeRoom.zoom_session.id}/captions/`)
            .then((history) => { if (!cancelled) setCaptions(history); })
            .catch(() => undefined);
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
            const nextMessage = payload as unknown as ChatMessage;
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
      setCaptions([]);
      setRealtimeNotice("");
    };
  }, [event.id, inRoom, room]);

  function addCaption(caption: LiveCaption) {
    setCaptions((current) => current.some((item) => item.id === caption.id) ? current : [...current, caption]);
  }

  function sendMessage(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    const body = message.trim();
    if (!body || !channel || socket.current?.readyState !== WebSocket.OPEN) return;
    socket.current.send(JSON.stringify(["chat.send", requestId.current++, { channel: channel.id, body }]));
    setMessage("");
  }

  async function copyMeetingLink() {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1_800);
  }

  if (!room) return <main className="empty-state"><h1>Esta reunião não possui uma sala.</h1><Link className="button button-secondary" href="/">Voltar ao início</Link></main>;

  return (
    <main className="live-page meeting-live-page">
      <header className="live-header">
        <div className="container live-header-inner">
          <Brand />
          <span className="live-header-title">{event.name} · {inRoom ? connected ? "conectado" : "reunião ativa · reconectando chat" : "pré-sala"}</span>
          <button className="button meeting-copy-link" type="button" onClick={copyMeetingLink}>
            {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? "Link copiado" : "Compartilhar"}
          </button>
          {onExit ? <button className="button live-exit" type="button" onClick={onExit}><ChevronLeft size={16} /> Encerrar conversa</button> : <Link className="button live-exit" href={exitHref}><ChevronLeft size={16} /> Sair da sala</Link>}
        </div>
      </header>
      <div className="live-layout">
        <section className="video-column" aria-label="Reunião ao vivo">
          <div className="video-player">
            {accessGranted && room.zoom_session
              ? <ZoomVideoRoom session={room.zoom_session} eventId={event.id} roomMode="meeting" onCaption={addCaption} onJoinedChange={setInRoom} />
              : <div className="video-center"><span className="navigation-spinner" /><p>Preparando sua reunião…</p></div>}
          </div>
          {error && <p className="live-error" role="alert">{error}</p>}
          {realtimeNotice && <p className="live-error" role="status">{realtimeNotice}</p>}
        </section>
        <aside className={`interaction-panel meeting-interaction-panel${inRoom ? "" : " meeting-interaction-locked"}`}>
          {!inRoom ? <div className="meeting-access-locked">
            <span><LockKeyhole size={22} /></span>
            <strong>Chat e transcrição da reunião</strong>
            <p>Entre na reunião para acessar a conversa e acompanhar a transcrição.</p>
          </div> : <>
          <div className="interaction-tabs" role="tablist">
            <button className={`interaction-tab${tab === "chat" ? " active" : ""}`} role="tab" aria-selected={tab === "chat"} onClick={() => setTab("chat")}><MessageSquare size={15} /> Chat</button>
            <button className={`interaction-tab${tab === "transcript" ? " active" : ""}`} role="tab" aria-selected={tab === "transcript"} onClick={() => setTab("transcript")}><FileText size={15} /> Transcrição</button>
          </div>
          <div className="interaction-content">
            {tab === "chat" && (messages.length
              ? messages.map((item) => <article className="message" key={item.id}><span className="avatar">{(item.sender?.first_name || item.sender?.name || item.sender?.username || "?").slice(0, 2).toUpperCase()}</span><div><strong>{item.sender ? item.sender.name || `${item.sender.first_name ?? ""} ${item.sender.last_name ?? ""}`.trim() || item.sender.username : "Participante"}</strong><time>{formatChatTime(item.created_at)}</time><p>{item.body}</p></div></article>)
              : <div className="meeting-panel-empty"><MessageSquare size={24} /><strong>Conversa aberta</strong><span>As mensagens da reunião aparecerão aqui.</span></div>)}
            {tab === "transcript" && (captions.length
              ? captions.map((caption) => <article className="meeting-transcript-entry" key={caption.id}><strong>{caption.speaker_name}</strong><time>{formatChatTime(caption.created_at)}</time><p>{caption.original_text}</p></article>)
              : <div className="meeting-panel-empty"><FileText size={24} /><strong>Transcrição ao vivo</strong><span>Ative as legendas na sala para registrar as falas.</span></div>)}
          </div>
          {tab === "chat" && <form className="composer" onSubmit={sendMessage}><label className="sr-only" htmlFor="meeting-chat-message">Mensagem</label><input id="meeting-chat-message" value={message} onChange={(event) => setMessage(event.target.value)} placeholder={user ? `Mensagem como ${user.first_name || user.username}` : "Escreva uma mensagem"} /><button className="icon-button" type="submit" aria-label="Enviar"><Send size={17} /></button></form>}
          </>}
        </aside>
      </div>
    </main>
  );
}
