"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Send, ThumbsUp } from "lucide-react";
import { Brand } from "./brand";
import { formatChatTime } from "@/lib/format-date";
import { normalizeRealtimeChatMessage } from "@/lib/chat";
import { EventUnavailable } from "./event-unavailable";
import { ZoomVideoRoom } from "./zoom-video-room";
import { useSession } from "./session-provider";
import { apiClient } from "@/lib/api-client";
import type { ChatChannel, ChatMessage, EventData, Paginated, Poll, Question, User } from "@/lib/api-types";

type Tab = "chat" | "questions" | "poll";
type JoinResponse = { token: string };

export function ConnectedLiveExperience({ event }: { event: EventData }) {
  const router = useRouter();
  const { user: sessionUser } = useSession();
  const publicRoom = event.rooms?.find((item) => item.zoom_session) ?? event.rooms?.[0];
  const [room, setRoom] = useState(publicRoom);
  const session = event.sessions?.find((item) => item.room === room?.id) ?? event.sessions?.[0];
  const [tab, setTab] = useState<Tab>("chat");
  const [user, setUser] = useState<User | null>(null);
  const [guest, setGuest] = useState(false);
  const [accessGranted, setAccessGranted] = useState(false);
  const [channel, setChannel] = useState<ChatChannel | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [message, setMessage] = useState("");
  const [question, setQuestion] = useState("");
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(false);
  const [eventEnded, setEventEnded] = useState(false);
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
        if (!activeRoom) throw new Error("Nenhuma sala disponível para esta inscrição.");
        setRoom(activeRoom);
        const channels = await apiClient<Paginated<ChatChannel>>(`chat/channels/?event=${event.id}&room=${activeRoom.id}`);
        const activeChannel = channels.results[0] ?? null;
        setChannel(activeChannel);
        const [questionData, pollData] = await Promise.all([
          apiClient<Paginated<Question>>(`questions/?room=${activeRoom.id}`),
          apiClient<Paginated<Poll>>(`polls/?room=${activeRoom.id}`),
        ]);
        setQuestions(questionData.results); setPolls(pollData.results);
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
          }
          if (type === "question.created" || type === "question.updated") {
            const nextQuestion = payload as unknown as Question;
            setQuestions((current) => [...current.filter((item) => item.id !== nextQuestion.id), nextQuestion]);
          }
          if (type === "poll.updated") {
            const nextPoll = payload as unknown as Poll;
            setPolls((current) => [...current.filter((item) => item.id !== nextPoll.id), nextPoll]);
          }
        };
        ws.onerror = () => setError("A conexão em tempo real foi interrompida. Recarregue a página para tentar novamente.");
        ws.onclose = () => setConnected(false);
      } catch (reason) {
        const message = reason instanceof Error ? reason.message : "Não foi possível entrar nesta sala.";
        setError(message);
      }
    }
    load();
    return () => { cancelled = true; socket.current?.close(); };
  }, [event.access_mode, event.id, publicRoom, router, sessionUser]);

  function sendMessage(formEvent: FormEvent) {
    formEvent.preventDefault();
    const body = message.trim();
    if (!body || !channel || socket.current?.readyState !== WebSocket.OPEN) return;
    socket.current.send(JSON.stringify(["chat.send", requestId.current++, { channel: channel.id, body }]));
    setMessage("");
  }

  async function askQuestion(formEvent: FormEvent) {
    formEvent.preventDefault();
    if (!room || !question.trim()) return;
    const created = await apiClient<Question>("questions/", { method: "POST", body: { room: room.id, content: question.trim() } });
    setQuestions((current) => [...current, created]); setQuestion("");
  }

  async function voteQuestion(item: Question) {
    const result = await apiClient<{ voted: boolean; score: number }>(`questions/${item.id}/vote/`, { method: "POST" });
    setQuestions((current) => current.map((candidate) => candidate.id === item.id ? { ...candidate, ...result } : candidate));
  }

  async function votePoll(poll: Poll, optionId: string) {
    const updated = await apiClient<Poll>(`polls/${poll.id}/vote/`, { method: "POST", body: { option_ids: [optionId] } });
    setPolls((current) => current.map((candidate) => candidate.id === poll.id ? updated : candidate));
  }

  if (eventEnded) return <EventUnavailable ended />;
  if (!room) return <main className="empty-state"><h1>Nenhuma sala disponível</h1><Link className="button button-secondary" href={`/eventos/${event.slug}`}>Voltar ao evento</Link></main>;

  return <main className="live-page"><header className="live-header"><div className="container live-header-inner"><Brand /><span className="live-header-title">{event.name} · {room.name}</span><Link className="button live-exit" href={`/eventos/${event.slug}`}><ChevronLeft size={16} /> Sair da sala</Link></div></header><div className="live-layout"><section className="video-column" aria-label="Transmissão ao vivo"><div className="video-player">{accessGranted && room.zoom_session ? <ZoomVideoRoom session={room.zoom_session} eventId={event.id} guest={guest} /> : !accessGranted ? <div className="video-center"><h1>Inscrição necessária</h1><p>Confirme seu nome e e-mail antes de entrar na transmissão.</p><Link className="button button-primary" href={`/eventos/${event.slug}/inscricao`}>Fazer inscrição</Link></div> : youtubeId ? <iframe className="video-embed" src={`https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=0`} title={session?.title ?? event.name} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /> : <div className="video-center"><span className="live-pill"><span className="live-dot" /> Transmissão</span><h1>{session?.title ?? event.name}</h1><p>{session?.speakers_detail.map((speaker) => speaker.name).join(" e ")}</p></div>}</div><div className="session-bar"><div><h2>{session?.title ?? event.name}</h2><p>{room.name} · {guest ? "modo espectador" : connected ? "conectado em tempo real" : "conectando..."}</p></div></div>{error && <p className="live-error" role="alert">{error} <Link href={`/eventos/${event.slug}/inscricao`}>Ver inscrição</Link></p>}</section><aside className="interaction-panel">{guest ? <div className="guest-interaction"><p className="eyebrow">Modo espectador</p><h2>Quer participar da conversa?</h2><p>Crie uma conta gratuita para usar chat, perguntas e receber convites para subir ao palco.</p><Link className="button button-primary" href={`/criar-conta?next=/eventos/${event.slug}/ao-vivo`}>Criar conta</Link><Link className="button button-secondary" href={`/entrar?next=/eventos/${event.slug}/ao-vivo`}>Já tenho conta</Link></div> : <><div className="interaction-tabs" role="tablist">{(["chat", "questions", "poll"] as Tab[]).map((item) => <button key={item} className={`interaction-tab${tab === item ? " active" : ""}`} role="tab" aria-selected={tab === item} onClick={() => setTab(item)}>{item === "chat" ? "Chat" : item === "questions" ? "Perguntas" : "Enquete"}</button>)}</div><div className="interaction-content">
    {tab === "chat" && messages.map((item) => <article className="message" key={item.id}><span className="avatar">{(item.sender?.first_name || item.sender?.name || item.sender?.username || "?").slice(0, 2).toUpperCase()}</span><div><strong>{item.sender ? item.sender.name || `${item.sender.first_name ?? ""} ${item.sender.last_name ?? ""}`.trim() || item.sender.username : "Participante"}</strong><time>{formatChatTime(item.created_at)}</time><p>{item.body}</p></div></article>)}
    {tab === "questions" && <><form className="panel-form" onSubmit={askQuestion}><label className="sr-only" htmlFor="question">Pergunta</label><textarea id="question" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Pergunte ao palestrante" /><button className="button button-primary" type="submit">Enviar pergunta</button></form>{questions.map((item) => <article className="question-card" key={item.id}><p>{item.content}</p><button className="vote-button" type="button" aria-pressed={item.voted} onClick={() => voteQuestion(item)}><ThumbsUp size={14} /> {item.score} votos</button></article>)}</>}
    {tab === "poll" && polls.map((poll) => <article className="poll-card" key={poll.id}><p><strong>{poll.question}</strong></p>{poll.options.map((option) => <button className="poll-option" type="button" key={option.id} onClick={() => votePoll(poll, option.id)}><span>{option.text}</span><span>{option.votes === null ? "Votar" : option.votes}</span></button>)}</article>)}
  </div>{tab === "chat" && <form className="composer" onSubmit={sendMessage}><label className="sr-only" htmlFor="chat-message">Mensagem</label><input id="chat-message" value={message} onChange={(event) => setMessage(event.target.value)} placeholder={user ? `Mensagem como ${user.first_name}` : "Escreva uma mensagem"} /><button className="icon-button" type="submit" aria-label="Enviar"><Send size={17} /></button></form>}</>}</aside></div></main>;
}
