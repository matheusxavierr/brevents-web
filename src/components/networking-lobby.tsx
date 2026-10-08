"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Clock3, Handshake, LoaderCircle, MessageSquare, Search, UserRound, UsersRound, X } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import type { EventData, NetworkingPresence, NetworkingRequest, Paginated } from "@/lib/api-types";
import { HomeHeader } from "./home-header";
import { useSession } from "./session-provider";

export function NetworkingLobby({ event }: { event: EventData }) {
  const router = useRouter();
  const { user } = useSession();
  const [people, setPeople] = useState<NetworkingPresence[]>([]);
  const [requests, setRequests] = useState<NetworkingRequest[]>([]);
  const [ownRegistrationId, setOwnRegistrationId] = useState("");
  const [search, setSearch] = useState("");
  const [target, setTarget] = useState<NetworkingPresence | null>(null);
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    const ownPresence = await apiClient<NetworkingPresence>("networking-presences/heartbeat/", { method: "POST", body: { event: event.id } });
    setOwnRegistrationId(ownPresence.registration);
    const [online, invitationPage] = await Promise.all([
      apiClient<NetworkingPresence[]>(`networking-presences/online/?event=${event.id}`),
      apiClient<Paginated<NetworkingRequest>>(`networking-requests/?event=${event.id}`),
    ]);
    setPeople(online);
    setRequests(invitationPage.results);
  }, [event.id]);

  useEffect(() => {
    let active = true;
    async function start() {
      try {
        if (!user) { router.replace(`/entrar?next=${encodeURIComponent(window.location.pathname)}`); return; }
        if (!active) return;
        await refresh();
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Não foi possível abrir o networking.");
      } finally { if (active) setLoading(false); }
    }
    void start();
    const interval = window.setInterval(() => void refresh().catch(() => undefined), 5000);
    return () => { active = false; window.clearInterval(interval); void apiClient("networking-presences/leave/", { method: "POST", body: { event: event.id } }).catch(() => undefined); };
  }, [event.id, refresh, router, user]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query ? people.filter((presence) => `${presence.registration_detail.name} ${presence.registration_detail.email}`.toLowerCase().includes(query)) : people;
  }, [people, search]);
  const incoming = requests.filter((request) => request.status === "pending" && request.recipient_registration === ownRegistrationId);
  const outgoing = requests.filter((request) => request.status === "pending" && request.sender_registration === ownRegistrationId);
  const activeConversations = requests.filter((request) => request.status === "accepted");
  const hasActiveConversation = activeConversations.length > 0;

  async function sendInvitation() {
    if (!target) return;
    setWorking(true); setError("");
    try {
      await apiClient("networking-requests/", { method: "POST", body: { event: event.id, recipient_registration: target.registration, topic } });
      setTarget(null); setTopic(""); await refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível enviar o convite."); }
    finally { setWorking(false); }
  }

  async function respond(request: NetworkingRequest, action: "accept" | "decline" | "cancel") {
    setWorking(true); setError("");
    try { await apiClient(`networking-requests/${request.id}/${action}/`, { method: "POST" }); await refresh(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível responder ao convite."); }
    finally { setWorking(false); }
  }

  async function endConversation(request: NetworkingRequest) {
    setWorking(true); setError("");
    try { await apiClient(`networking-requests/${request.id}/end/`, { method: "POST" }); await refresh(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível sair da conversa."); }
    finally { setWorking(false); }
  }

  return <><HomeHeader /><main className="networking-page">
    <div className="networking-context-header"><div><span>{event.name}</span><strong>Rodada de negócios</strong></div><Link className="button button-secondary" href={`/eventos/${event.slug}/lobby`}><ArrowLeft size={15} /> Lobby</Link></div>
    <section className="networking-hero"><div><p className="eyebrow"><UsersRound size={14} /> Pessoas no evento agora</p><h1>Encontre alguém.<br />Converse em particular.</h1><p>Envie um convite. Quando a outra pessoa aceitar, uma sala privada é aberta para vocês.</p></div><span className="online-counter"><i /> {people.length + 1} online</span></section>
    {error && <p className="form-error networking-error" role="alert">{error}</p>}
    {loading ? <div className="networking-loading"><LoaderCircle className="spin" /><span>Entrando no lobby…</span></div> : <div className="networking-layout">
      <section className="networking-directory"><div className="networking-section-heading"><div><h2>Disponíveis para conversar</h2><p>{hasActiveConversation ? "Saia da conversa atual para enviar ou aceitar outro convite." : "O lobby é atualizado em tempo real."}</p></div><label className="networking-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome ou e-mail" /></label></div><div className="networking-person-grid">{filtered.map((presence) => <article key={presence.id}><span className="networking-avatar">{initials(presence.registration_detail.name)}</span><div><strong>{presence.registration_detail.name}</strong><small>{presence.registration_detail.email}</small><span><i /> Disponível</span></div><button className="button button-primary" disabled={hasActiveConversation} onClick={() => setTarget(presence)}><Handshake size={15} /> {hasActiveConversation ? "Em conversa" : "Convidar"}</button></article>)}{filtered.length === 0 && <div className="networking-empty"><UserRound size={30} /><h3>Ninguém disponível agora.</h3><p>Continue no lobby; novas pessoas aparecerão automaticamente.</p></div>}</div></section>
      <aside className="networking-invitations"><h2>Suas conversas</h2>{activeConversations.map((request) => <ConversationCard request={request} event={event} ownRegistrationId={ownRegistrationId} working={working} onEnd={() => void endConversation(request)} key={request.id} />)}{incoming.map((request) => <article className="invitation-card incoming" key={request.id}><small>Convite recebido</small><strong>{request.sender_detail.name}</strong><p>{request.topic || "Quer conversar com você em particular."}</p><div><button className="button button-primary" disabled={working || hasActiveConversation} onClick={() => void respond(request, "accept")}><Check size={15} /> {hasActiveConversation ? "Indisponível" : "Aceitar"}</button><button className="icon-button" disabled={working} onClick={() => void respond(request, "decline")} aria-label="Recusar"><X size={16} /></button></div></article>)}{outgoing.map((request) => <article className="invitation-card pending" key={request.id}><small><Clock3 size={12} /> Aguardando resposta</small><strong>{request.recipient_detail.name}</strong><p>{request.topic || "Convite para conversar."}</p><button className="button button-quiet" disabled={working} onClick={() => void respond(request, "cancel")}>Cancelar convite</button></article>)}{!activeConversations.length && !incoming.length && !outgoing.length && <div className="networking-aside-empty"><MessageSquare size={25} /><p>Você pode receber vários convites e escolher qual aceitar.</p></div>}</aside>
    </div>}
    {target && <div className="networking-dialog-backdrop" role="presentation" onMouseDown={() => setTarget(null)}><section className="networking-dialog" role="dialog" aria-modal="true" aria-labelledby="networking-dialog-title" onMouseDown={(event) => event.stopPropagation()}><button className="icon-button" onClick={() => setTarget(null)} aria-label="Fechar"><X size={17} /></button><span className="networking-avatar">{initials(target.registration_detail.name)}</span><p className="eyebrow">Convite 1:1</p><h2 id="networking-dialog-title">Conversar com {target.registration_detail.name}?</h2><p>A sala será criada somente depois que a pessoa aceitar.</p><label className="field"><span>Sobre o que você quer conversar? (opcional)</span><textarea value={topic} onChange={(event) => setTopic(event.target.value)} maxLength={180} placeholder="Ex.: parceria comercial, produto, projeto…" /></label><button className="button button-primary" disabled={working} onClick={() => void sendInvitation()}>{working ? <LoaderCircle className="spin" size={16} /> : <Handshake size={16} />} Enviar convite</button></section></div>}
  </main></>;
}

function ConversationCard({ request, event, ownRegistrationId, working, onEnd }: { request: NetworkingRequest; event: EventData; ownRegistrationId: string; working: boolean; onEnd: () => void }) {
  const other = request.sender_registration === ownRegistrationId ? request.recipient_detail : request.sender_detail;
  return <article className="invitation-card active"><small><i /> 1:1 ativo</small><strong>{other.name}</strong><p>{request.topic || "Conversa de networking"}</p><div className="networking-active-actions"><Link className="button button-primary" href={`/eventos/${event.slug}/networking/${request.id}`}>Entrar na conversa</Link><button className="button button-secondary" type="button" disabled={working} onClick={onEnd}>Sair do 1:1</button></div></article>;
}

function initials(name: string) { return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase(); }
