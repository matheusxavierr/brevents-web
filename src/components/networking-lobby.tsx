"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Building2, Check, Clock3, DoorOpen, Handshake, LoaderCircle, MessageSquare, Search, UserRound, UsersRound, X } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import type { EventData, NetworkingPresence, NetworkingRequest, Paginated, Room } from "@/lib/api-types";
import { HomeHeader } from "./home-header";
import { useSession } from "./session-provider";

type SalaForm = { company_name: string; contact_name: string; location: string; topic: string };

const EMPTY_SALA: SalaForm = { company_name: "", contact_name: "", location: "", topic: "" };

export function NetworkingLobby({ event }: { event: EventData }) {
  const router = useRouter();
  const { user } = useSession();
  const [people, setPeople] = useState<NetworkingPresence[]>([]);
  const [requests, setRequests] = useState<NetworkingRequest[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [ownRegistrationId, setOwnRegistrationId] = useState("");
  const [search, setSearch] = useState("");
  const [target, setTarget] = useState<NetworkingPresence | null>(null);
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [salaOpen, setSalaOpen] = useState(false);
  const [salaForm, setSalaForm] = useState<SalaForm>(EMPTY_SALA);
  const [salaError, setSalaError] = useState("");
  const [salaNotice, setSalaNotice] = useState("");
  const [salaWorking, setSalaWorking] = useState(false);

  const refresh = useCallback(async () => {
    const ownPresence = await apiClient<NetworkingPresence>("networking-presences/heartbeat/", { method: "POST", body: { event: event.id } });
    setOwnRegistrationId(ownPresence.registration);
    const [online, invitationPage, roomPage] = await Promise.all([
      apiClient<NetworkingPresence[]>(`networking-presences/online/?event=${event.id}`),
      apiClient<Paginated<NetworkingRequest>>(`networking-requests/?event=${event.id}`),
      apiClient<Paginated<Room>>(`rooms/?event=${event.id}&purpose=networking&visibility=public`),
    ]);
    setPeople(online);
    setRequests(invitationPage.results);
    setRooms(roomPage.results);
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
  const sortedRooms = useMemo(() => [...rooms].sort((a, b) => {
    const mineA = a.host_registration && a.host_registration === ownRegistrationId ? 0 : 1;
    const mineB = b.host_registration && b.host_registration === ownRegistrationId ? 0 : 1;
    if (mineA !== mineB) return mineA - mineB;
    return (a.company_name || a.name).localeCompare(b.company_name || b.name, "pt-BR");
  }), [ownRegistrationId, rooms]);
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

  function openSalaDialog() {
    setSalaError("");
    setSalaForm((current) => ({ ...current, contact_name: current.contact_name || user?.name || "" }));
    setSalaOpen(true);
  }

  async function createSala() {
    const company = salaForm.company_name.trim();
    const contact = salaForm.contact_name.trim();
    if (!company) { setSalaError("Informe o nome da empresa."); return; }
    if (!contact) { setSalaError("Informe o seu nome."); return; }
    setSalaWorking(true); setSalaError(""); setSalaNotice("");
    try {
      const created = await apiClient<Room>("rooms/networking/", {
        method: "POST",
        body: {
          event: event.id,
          company_name: company,
          contact_name: contact,
          location: salaForm.location.trim(),
          topic: salaForm.topic.trim(),
        },
      });
      setRooms((current) => [...current.filter((room) => room.id !== created.id), created]);
      setSalaOpen(false);
      setSalaNotice(`Sala da ${created.company_name || created.name} pronta. Abra a sua sala para receber visitas.`);
      await refresh();
    } catch (reason) {
      setSalaError(reason instanceof Error ? reason.message : "Não foi possível criar a sala.");
    } finally {
      setSalaWorking(false);
    }
  }

  return <><HomeHeader /><main className="networking-page">
    <div className="networking-context-header"><div><span>{event.name}</span><strong>Rodada de negócios</strong></div><Link className="button button-secondary" href={`/eventos/${event.slug}/lobby`}><ArrowLeft size={15} /> Lobby</Link></div>
    <section className="networking-hero"><div><p className="eyebrow"><UsersRound size={14} /> Pessoas no evento agora</p><h1>Encontre alguém.<br />Converse em particular.</h1><p>Envie um convite, entre na sala de uma empresa ou crie a sua sala para receber visitas no matchmaking.</p></div><span className="online-counter"><i /> {people.length + 1} online</span></section>
    {error && <p className="form-error networking-error" role="alert">{error}</p>}
    {loading ? <div className="networking-loading"><LoaderCircle className="spin" /><span>Entrando no lobby…</span></div> : <>
      <section className="networking-salas">
        <div className="networking-section-heading">
          <div><h2>Salas das empresas</h2><p>Crie a sala da sua empresa, com seu nome e localização, e receba visitas no matchmaking.</p></div>
          <button className="button button-primary" type="button" onClick={openSalaDialog}><DoorOpen size={16} /> Criar sala</button>
        </div>
        {salaNotice && <p className="networking-notice" role="status">{salaNotice}</p>}
        <div className="networking-sala-grid">
          {sortedRooms.map((room) => {
            const mine = Boolean(room.host_registration && room.host_registration === ownRegistrationId);
            return <article className={mine ? "networking-sala networking-sala-mine" : "networking-sala"} key={room.id}>
              <span className="networking-avatar">{initials(room.company_name || room.name)}</span>
              <div>
                <strong>{room.company_name || room.name}</strong>
                <small>{room.contact_name || "Participante"}{room.location ? ` · ${room.location}` : ""}</small>
                {room.description && <small className="networking-sala-topic">{room.description}</small>}
                <span><i /> Sala aberta</span>
              </div>
              {mine && <span className="status-pill status-live">Sua sala</span>}
              <Link className="button button-primary" href={`/eventos/${event.slug}/networking/salas/${room.id}`}>{mine ? "Abrir minha sala" : "Entrar na sala"}</Link>
            </article>;
          })}
          {sortedRooms.length === 0 && <div className="networking-empty"><Building2 size={30} /><h3>Nenhuma sala aberta ainda.</h3><p>Crie a primeira sala com o nome da sua empresa e o seu nome.</p></div>}
        </div>
      </section>
      <div className="networking-layout">
        <section className="networking-directory"><div className="networking-section-heading"><div><h2>Disponíveis para conversar</h2><p>{hasActiveConversation ? "Saia da conversa atual para enviar ou aceitar outro convite." : "O lobby é atualizado em tempo real."}</p></div><label className="networking-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome ou e-mail" /></label></div><div className="networking-person-grid">{filtered.map((presence) => <article key={presence.id}><span className="networking-avatar">{initials(presence.registration_detail.name)}</span><div><strong>{presence.registration_detail.name}</strong><small>{presence.registration_detail.email}</small><span><i /> Disponível</span></div><button className="button button-primary" disabled={hasActiveConversation} onClick={() => setTarget(presence)}><Handshake size={15} /> {hasActiveConversation ? "Em conversa" : "Convidar"}</button></article>)}{filtered.length === 0 && <div className="networking-empty"><UserRound size={30} /><h3>Ninguém disponível agora.</h3><p>Continue no lobby; novas pessoas aparecerão automaticamente.</p></div>}</div></section>
        <aside className="networking-invitations"><h2>Suas conversas</h2>{activeConversations.map((request) => <ConversationCard request={request} event={event} ownRegistrationId={ownRegistrationId} working={working} onEnd={() => void endConversation(request)} key={request.id} />)}{incoming.map((request) => <article className="invitation-card incoming" key={request.id}><small>Convite recebido</small><strong>{request.sender_detail.name}</strong><p>{request.topic || "Quer conversar com você em particular."}</p><div><button className="button button-primary" disabled={working || hasActiveConversation} onClick={() => void respond(request, "accept")}><Check size={15} /> {hasActiveConversation ? "Indisponível" : "Aceitar"}</button><button className="icon-button" disabled={working} onClick={() => void respond(request, "decline")} aria-label="Recusar"><X size={16} /></button></div></article>)}{outgoing.map((request) => <article className="invitation-card pending" key={request.id}><small><Clock3 size={12} /> Aguardando resposta</small><strong>{request.recipient_detail.name}</strong><p>{request.topic || "Convite para conversar."}</p><button className="button button-quiet" disabled={working} onClick={() => void respond(request, "cancel")}>Cancelar convite</button></article>)}{!activeConversations.length && !incoming.length && !outgoing.length && <div className="networking-aside-empty"><MessageSquare size={25} /><p>Você pode receber vários convites e escolher qual aceitar.</p></div>}</aside>
      </div>
    </>}
    {target && <div className="networking-dialog-backdrop" role="presentation" onMouseDown={() => setTarget(null)}><section className="networking-dialog" role="dialog" aria-modal="true" aria-labelledby="networking-dialog-title" onMouseDown={(event) => event.stopPropagation()}><button className="icon-button" onClick={() => setTarget(null)} aria-label="Fechar"><X size={17} /></button><span className="networking-avatar">{initials(target.registration_detail.name)}</span><p className="eyebrow">Convite 1:1</p><h2 id="networking-dialog-title">Conversar com {target.registration_detail.name}?</h2><p>A sala será criada somente depois que a pessoa aceitar.</p><label className="field"><span>Sobre o que você quer conversar? (opcional)</span><textarea value={topic} onChange={(event) => setTopic(event.target.value)} maxLength={180} placeholder="Ex.: parceria comercial, produto, projeto…" /></label><button className="button button-primary" disabled={working} onClick={() => void sendInvitation()}>{working ? <LoaderCircle className="spin" size={16} /> : <Handshake size={16} />} Enviar convite</button></section></div>}
    {salaOpen && <div className="networking-dialog-backdrop" role="presentation" onMouseDown={() => setSalaOpen(false)}><section className="networking-dialog" role="dialog" aria-modal="true" aria-labelledby="sala-dialog-title" onMouseDown={(event) => event.stopPropagation()}>
      <button className="icon-button" type="button" onClick={() => setSalaOpen(false)} aria-label="Fechar"><X size={17} /></button>
      <p className="eyebrow">Sala de matchmaking</p>
      <h2 id="sala-dialog-title">Criar sala da empresa</h2>
      <p>A sala fica visível para todos os inscritos no evento. Nome e empresa são obrigatórios.</p>
      <label className="field"><span>Nome da empresa <b>*</b></span><input value={salaForm.company_name} onChange={(event) => setSalaForm((current) => ({ ...current, company_name: event.target.value }))} maxLength={120} placeholder="Ex.: Acme Ltda." required /></label>
      <label className="field"><span>Seu nome <b>*</b></span><input value={salaForm.contact_name} onChange={(event) => setSalaForm((current) => ({ ...current, contact_name: event.target.value }))} maxLength={120} placeholder="Ex.: Ana Lima" required /></label>
      <label className="field"><span>Localização <small>Opcional</small></span><input value={salaForm.location} onChange={(event) => setSalaForm((current) => ({ ...current, location: event.target.value }))} maxLength={120} placeholder="Ex.: São Paulo, SP" /></label>
      <label className="field"><span>Assunto <small>Opcional</small></span><input value={salaForm.topic} onChange={(event) => setSalaForm((current) => ({ ...current, topic: event.target.value }))} maxLength={180} placeholder="Ex.: Parcerias comerciais" /></label>
      {salaError && <p className="form-error" role="alert">{salaError}</p>}
      <button className="button button-primary" type="button" disabled={salaWorking} onClick={() => void createSala()}>{salaWorking ? <LoaderCircle className="spin" size={16} /> : <DoorOpen size={16} />} Criar sala</button>
    </section></div>}
  </main></>;
}

function ConversationCard({ request, event, ownRegistrationId, working, onEnd }: { request: NetworkingRequest; event: EventData; ownRegistrationId: string; working: boolean; onEnd: () => void }) {
  const other = request.sender_registration === ownRegistrationId ? request.recipient_detail : request.sender_detail;
  return <article className="invitation-card active"><small><i /> 1:1 ativo</small><strong>{other.name}</strong><p>{request.topic || "Conversa de networking"}</p><div className="networking-active-actions"><Link className="button button-primary" href={`/eventos/${event.slug}/networking/${request.id}`}>Entrar na conversa</Link><button className="button button-secondary" type="button" disabled={working} onClick={onEnd}>Sair do 1:1</button></div></article>;
}

function initials(name: string) { return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase(); }
