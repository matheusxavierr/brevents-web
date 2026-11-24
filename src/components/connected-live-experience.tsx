"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, FileText, Send, UsersRound } from "lucide-react";
import { Brand } from "./brand";
import { LanguageSwitcher } from "./language-switcher";
import { useI18n } from "./i18n-provider";
import { normalizeRealtimeChatMessage } from "@/lib/chat";
import { EventUnavailable } from "./event-unavailable";
import { ZoomVideoRoom } from "./zoom-video-room";
import { useTranscript } from "./use-transcript";
import { TranscriptDownload, TranscriptPanel } from "./transcript-panel";
import { useSession } from "./session-provider";
import { apiClient } from "@/lib/api-client";
import type { ChatChannel, ChatMessage, EventData, Paginated, User } from "@/lib/api-types";

type Tab = "chat" | "transcript";
type JoinResponse = { token: string };

function formatCaptionTime(intlLocale: string, value: string) {
  if (!value) return "--:--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--:--";
  return new Intl.DateTimeFormat(intlLocale, { hour: "2-digit", minute: "2-digit" }).format(date);
}

export function ConnectedLiveExperience({ event }: { event: EventData }) {
  const router = useRouter();
  const { t, intlLocale } = useI18n();
  const { user: sessionUser } = useSession();
  const publicRoom = event.rooms?.find((item) => item.zoom_session) ?? event.rooms?.[0];
  const [room, setRoom] = useState(publicRoom);
  const session = event.sessions?.find((item) => item.room === room?.id) ?? event.sessions?.[0];
  const [tab, setTab] = useState<Tab>("chat");
  const [user, setUser] = useState<User | null>(null);
  const [guest, setGuest] = useState(false);
  const [accessGranted, setAccessGranted] = useState(false);
  const [inRoom, setInRoom] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);
  const joinedOnce = useRef(false);
  const transcriptContent = useRef<HTMLDivElement>(null);
  const transcript = useTranscript({ sessionId: room?.zoom_session?.id, eventId: event.id, guest, enabled: hasJoined, refreshKey: inRoom, title: event.name, roomName: room?.name ?? t("Auditório"), timeZone: event.timezone });
  const changeJoined = useCallback((joined: boolean) => {
    setInRoom(joined);
    if (joined) { joinedOnce.current = true; setHasJoined(true); }
    else if (joinedOnce.current) setTab("transcript");
  }, []);
  const [channel, setChannel] = useState<ChatChannel | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [chatNotice, setChatNotice] = useState("");
  const pendingChat = useRef("");
  const [connected, setConnected] = useState(false);
  const [eventEnded, setEventEnded] = useState(false);
  const [exitConfirmationOpen, setExitConfirmationOpen] = useState(false);
  const socket = useRef<WebSocket | null>(null);
  const requestId = useRef(1);

  const youtubeId = useMemo(() => {
    const streamModule = room?.module_config?.find((item) => item.type === "livestream.youtube");
    return typeof streamModule?.config.video_id === "string" ? streamModule.config.video_id : null;
  }, [room]);

  useEffect(() => {
    if (event.status !== "published") return;
    const checkAvailability = async () => {
      try {
        const response = await fetch(`/api/backend/public/events/${encodeURIComponent(event.slug)}/`, { cache: "no-store" });
        if (response.status === 404 || response.status === 410) setEventEnded(true);
      } catch (reason) {
        console.error("Não foi possível verificar a disponibilidade do evento.", reason);
      }
    };
    const timer = window.setInterval(() => void checkAvailability(), 8_000);
    return () => window.clearInterval(timer);
  }, [event.slug, event.status]);

  useEffect(() => {
    if (!publicRoom) return;
    const activePublicRoom = publicRoom;
    let cancelled = false;
    async function load() {
      try {
        if (!sessionUser) {
          if (event.access_mode !== "public") { router.push(`/entrar?next=${encodeURIComponent(window.location.pathname)}`); return; }
          setGuest(true);
          setAccessGranted(true);
          return;
        }
        if (cancelled) return;
        setUser(sessionUser);
        const join = await apiClient<JoinResponse>(`events/${event.id}/join-token/`, { method: "POST" });
        setAccessGranted(true);
        const roomData = await apiClient<Paginated<NonNullable<typeof publicRoom>>>(`rooms/?event=${event.id}`);
        const activeRoom = roomData.results.find((item) => item.id === activePublicRoom.id) ?? roomData.results[0];
        if (!activeRoom) throw new Error(t("Nenhuma sala disponível para esta inscrição."));
        setRoom(activeRoom);
        const channels = await apiClient<Paginated<ChatChannel>>(`chat/channels/?event=${event.id}&room=${activeRoom.id}`);
        const activeChannel = channels.results[0] ?? null;
        setChannel(activeChannel);
        if (activeChannel) {
          const history = await apiClient<Paginated<ChatMessage>>(`chat/messages/?channel=${activeChannel.id}`);
          setMessages(history.results);
        }
        const wsBase = process.env.NEXT_PUBLIC_BREVENTS_WS_URL ?? "ws://127.0.0.1:8000/ws";
        const ws = new WebSocket(`${wsBase}/events/${event.id}/?token=${encodeURIComponent(join.token)}`);
        socket.current = ws;
        ws.onopen = () => {
          setConnected(true);
          ws.send(JSON.stringify(["room.join", requestId.current++, { room: activeRoom.id }]));
          if (activeChannel) ws.send(JSON.stringify(["chat.subscribe", requestId.current++, { channel: activeChannel.id }]));
        };
        ws.onmessage = (incoming) => {
          const [type, , payload] = JSON.parse(incoming.data) as [string, number | null, Record<string, unknown>];
          if (type === "chat.event" || type === "chat.send.success") {
            const nextMessage = normalizeRealtimeChatMessage(payload);
            setMessages((current) => current.some((item) => item.id === nextMessage.id) ? current : [...current, nextMessage]);
            if (type === "chat.send.success") { setChatNotice(""); pendingChat.current = ""; }
          }
          if (type === "error") {
            const chatError = payload as { code?: string; message?: string };
            if (chatError.code === "chat.contact_blocked") {
              setChatNotice(t("Mensagem não enviada: e-mail ou telefone não são permitidos no chat."));
              if (pendingChat.current) setMessage(pendingChat.current);
            } else if (chatError.code === "request.invalid") {
              setChatNotice(chatError.message || t("Não foi possível enviar a mensagem."));
              if (pendingChat.current) setMessage(pendingChat.current);
            }
          }
        };
        ws.onerror = () => setError(t("A conexão em tempo real foi interrompida. Recarregue a página para tentar novamente."));
        ws.onclose = () => setConnected(false);
      } catch (reason) {
        const message = reason instanceof Error ? reason.message : t("Não foi possível entrar nesta sala.");
        setError(message);
      }
    }
    load();
    return () => { cancelled = true; socket.current?.close(); };
  }, [event.access_mode, event.id, publicRoom, router, sessionUser, t]);

  useEffect(() => {
    const content = transcriptContent.current;
    if (!content) return;
    const frame = requestAnimationFrame(() => content.scrollTo({ top: content.scrollHeight, behavior: "smooth" }));
    return () => cancelAnimationFrame(frame);
  }, [messages, tab, transcript.captions]);

  function sendMessage(formEvent: FormEvent) {
    formEvent.preventDefault();
    const body = message.trim();
    if (!body || !channel || socket.current?.readyState !== WebSocket.OPEN) return;
    pendingChat.current = body;
    setChatNotice("");
    socket.current.send(JSON.stringify(["chat.send", requestId.current++, { channel: channel.id, body }]));
    setMessage("");
  }

  if (eventEnded) return <EventUnavailable ended actions={hasJoined ? <><TranscriptDownload {...transcript} />{transcript.error && <p role="alert">{transcript.error}</p>}</> : undefined} />;
  if (!room) return <main className="empty-state"><h1>{t("Nenhuma sala disponível")}</h1><Link className="button button-secondary" href={`/eventos/${event.slug}`}>{t("Voltar ao evento")}</Link></main>;

  const tabs: Tab[] = ["chat"];
  if (room.zoom_session) tabs.push("transcript");

  return <main className="live-page">
    <header className="live-header"><div className="container live-header-inner"><Brand /><span className="live-header-title">{event.name} · {room.name}</span><LanguageSwitcher className="live-language" /><Link className="button live-networking" href={`/eventos/${event.slug}/networking`}><UsersRound size={16} /> {t("Matchmaking")}</Link><button className="button live-exit" type="button" onClick={() => setExitConfirmationOpen(true)}><ChevronLeft size={16} /><span className="live-exit-desktop">{t("Voltar pra Home")}</span><span className="live-exit-mobile">{t("Voltar")}</span></button></div></header>
    <div className="live-layout">
      <section className="video-column" aria-label={t("Transmissão ao vivo")}>
        <div className="video-player">
          {accessGranted && room.zoom_session ? <ZoomVideoRoom session={room.zoom_session} eventId={event.id} guest={guest} onCaption={transcript.addCaption} onJoinedChange={changeJoined} /> : !accessGranted ? <div className="video-center"><h1>{t("Inscrição necessária")}</h1><p>{t("Confirme seu nome e e-mail antes de entrar na transmissão.")}</p><Link className="button button-primary" href={`/eventos/${event.slug}/inscricao`}>{t("Fazer inscrição")}</Link></div> : youtubeId ? <iframe className="video-embed" src={`https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=0`} title={session?.title ?? event.name} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /> : <div className="video-center"><span className="live-pill"><span className="live-dot" /> {t("Transmissão")}</span><h1>{session?.title ?? event.name}</h1><p>{session?.speakers_detail.map((speaker) => speaker.name).join(t(" e "))}</p></div>}
        </div>
        <div className="session-bar"><div><h2>{session?.title ?? event.name}</h2><p>{room.name} · {guest ? t("modo espectador") : connected ? t("conectado em tempo real") : t("conectando...")}</p></div></div>
        {error && <p className="live-error" role="alert">{error} <Link href={`/eventos/${event.slug}/inscricao`}>{t("Ver inscrição")}</Link></p>}
      </section>
      <aside className="interaction-panel">
        <div className={`interaction-tabs${room.zoom_session ? " event-interaction-tabs" : ""}`} role="tablist">
          {tabs.map((item) => <button key={item} className={`interaction-tab${tab === item ? " active" : ""}`} role="tab" aria-selected={tab === item} onClick={() => setTab(item)}>{item === "transcript" && <FileText size={15} />}{item === "chat" ? t("Chat") : t("Transcrição")}</button>)}
        </div>
        <div className="interaction-content" ref={transcriptContent}>
          {tab === "transcript" && (hasJoined ? <TranscriptPanel {...transcript} ended={!inRoom} /> : <div className="meeting-panel-empty"><FileText size={24} /><strong>{t("Transcrição do evento")}</strong><span>{t("Entre na sala para acompanhar as falas.")}</span></div>)}
          {guest && tab === "chat" && <div className="guest-interaction"><p className="eyebrow">{t("Modo espectador")}</p><h2>{t("Quer participar da conversa?")}</h2><Link className="button button-primary" href={`/criar-conta?next=/eventos/${event.slug}/ao-vivo`}>{t("Criar conta")}</Link><Link className="button button-secondary" href={`/entrar?next=/eventos/${event.slug}/ao-vivo`}>{t("Já tenho conta")}</Link></div>}
          {!guest && tab === "chat" && messages.map((item) => <article className="message" key={item.id}><span className="avatar">{(item.sender?.first_name || item.sender?.name || item.sender?.username || "?").slice(0, 2).toUpperCase()}</span><div><strong>{item.sender ? item.sender.name || `${item.sender.first_name ?? ""} ${item.sender.last_name ?? ""}`.trim() || item.sender.username : t("Participante")}</strong><time>{formatCaptionTime(intlLocale, item.created_at)}</time><p>{item.body}</p></div></article>)}
        </div>
        {!guest && tab === "chat" && <p className="chat-safety">{t("Por segurança, não é permitido compartilhar e-mail ou telefone no chat.")}</p>}
        {!guest && tab === "chat" && chatNotice && <p className="live-error chat-notice" role="alert">{chatNotice}</p>}
        {!guest && tab === "chat" && <form className="composer" onSubmit={sendMessage}><label className="sr-only" htmlFor="chat-message">{t("Mensagem")}</label><input id="chat-message" value={message} onChange={(event) => setMessage(event.target.value)} placeholder={user ? t("Mensagem como {name}", { name: user.first_name }) : t("Escreva uma mensagem")} /><button className="icon-button" type="submit" aria-label={t("Enviar")}><Send size={17} /></button></form>}
      </aside>
    </div>
    {exitConfirmationOpen && <div className="meeting-confirm-backdrop" role="presentation" onMouseDown={() => setExitConfirmationOpen(false)}><section className="meeting-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="leave-event-title" onMouseDown={(event) => event.stopPropagation()}><ChevronLeft size={24} aria-hidden="true" /><p className="eyebrow">{t("Sair do evento")}</p><h2 id="leave-event-title">{t("Quer voltar para a Home?")}</h2><p>{t("Você sairá da transmissão e poderá entrar novamente enquanto o evento estiver disponível.")}</p>{hasJoined && <TranscriptDownload {...transcript} />}{transcript.error && <p role="alert">{transcript.error}</p>}<div className="meeting-confirm-actions"><button className="button button-secondary" type="button" onClick={() => setExitConfirmationOpen(false)}>{t("Continuar no evento")}</button><button className="button button-primary" type="button" onClick={() => router.push("/")}>{t("Voltar para a Home")}</button></div></section></div>}
  </main>;
}
