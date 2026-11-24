"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Building2, Check, ChevronLeft, ChevronRight, DoorOpen, Handshake, Inbox, LoaderCircle, LockKeyhole, MessageSquare, Radio, RefreshCw, Search, Send, UsersRound, X } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { listAll } from "@/lib/api-pagination";
import { networkingPageLayout } from "@/lib/networking-layout";
import { isOwnCompanyRoom } from "@/lib/company-rooms";
import type { EventData, NetworkingPresence, NetworkingRequest, Registration, Room } from "@/lib/api-types";
import { Dialog } from "./event-dashboard/shared";
import { HomeHeader } from "./home-header";
import { useI18n } from "./i18n-provider";
import { useSession } from "./session-provider";
import portal from "./event-portal.module.css";
import styles from "./networking-lobby.module.css";

type View = "people" | "salas" | "received" | "sent" | "active";
type Snapshot = { open: boolean; people: NetworkingPresence[]; requests: NetworkingRequest[]; rooms: Room[]; ownRegistrationId: string; ownCompany: string };
type SalaForm = { company_name: string; contact_name: string; location: string; topic: string };
const titles: Record<View, string> = { people: "Pessoas no networking", salas: "Salas das empresas", received: "Convites recebidos", sent: "Convites enviados", active: "Sua conversa 1:1" };
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const EMPTY_SALA: SalaForm = { company_name: "", contact_name: "", location: "", topic: "" };

export function NetworkingLobby({ event }: { event: EventData }) {
  const router = useRouter();
  const { t, intlLocale } = useI18n();
  const { user } = useSession();
  const [snapshot, setSnapshot] = useState<Snapshot>({ open: event.feature_flags.networking_open === true, people: [], requests: [], rooms: [], ownRegistrationId: "", ownCompany: "" });
  const [view, setView] = useState<View>("people");
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [target, setTarget] = useState<NetworkingPresence | null>(null);
  const [ending, setEnding] = useState<NetworkingRequest | null>(null);
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [connectionError, setConnectionError] = useState("");
  const [notice, setNotice] = useState("");
  const [salaOpen, setSalaOpen] = useState(false);
  const [salaForm, setSalaForm] = useState<SalaForm>(EMPTY_SALA);
  const [salaError, setSalaError] = useState("");
  const [salaWorking, setSalaWorking] = useState(false);
  const [layout, setLayout] = useState(() => networkingPageLayout(1000, 400));
  const viewport = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);
  const generation = useRef(0);
  const operationRunning = useRef(false);
  const presenceJoined = useRef(false);
  const initialViewSelected = useRef(false);

  const refresh = useCallback(async () => {
    const current = ++generation.current;
    const publicEvent = await apiClient<EventData>(`public/events/${encodeURIComponent(event.slug)}/`);
    const open = publicEvent.feature_flags.networking_open === true;
    const [pending, accepted, ownPresence, rooms] = await Promise.all([
      listAll<NetworkingRequest>(`networking-requests/?event=${event.id}&status=pending`),
      listAll<NetworkingRequest>(`networking-requests/?event=${event.id}&status=accepted`),
      open ? apiClient<NetworkingPresence>("networking-presences/heartbeat/", { method: "POST", body: { event: event.id } }) : Promise.resolve(null),
      listAll<Room>(`rooms/?event=${event.id}&purpose=networking&visibility=public`),
    ]);
    if (ownPresence) presenceJoined.current = true;
    const people = open ? await apiClient<NetworkingPresence[]>(`networking-presences/online/?event=${event.id}`) : [];
    const requests = [...pending, ...accepted].sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")));
    const isOwn = (person: Registration) => person.user === user?.id || Boolean(user?.email && normalize(person.email || "") === normalize(user.email));
    const ownRequest = requests.find((request) => [request.sender_detail, request.recipient_detail].some(isOwn));
    const ownRegistrationId = ownPresence?.registration ?? (ownRequest
      ? isOwn(ownRequest.sender_detail) ? ownRequest.sender_registration : ownRequest.recipient_registration
      : "");
    if (mounted.current && current === generation.current) {
      const ownPerson = ownPresence?.registration_detail || people.find((person) => isOwn(person.registration_detail))?.registration_detail
        || (ownRequest ? isOwn(ownRequest.sender_detail) ? ownRequest.sender_detail : ownRequest.recipient_detail : undefined);
      const ownCompany = ownPerson?.profile?.company || "";
      setSnapshot({ open, people, requests, rooms, ownRegistrationId, ownCompany });
      if (!initialViewSelected.current) {
        initialViewSelected.current = true;
        if (rooms.some((room) => isOwnCompanyRoom(room, ownRegistrationId, ownCompany))) setView("salas");
      }
      setConnectionError("");
    }
  }, [event.id, event.slug, user]);

  useEffect(() => {
    if (!user) { router.replace(`/entrar?next=${encodeURIComponent(window.location.pathname)}`); return; }
    mounted.current = true;
    let stopped = false;
    let polling = false;
    const poll = async () => {
      if (stopped || polling || operationRunning.current) return;
      polling = true;
      try { await refresh(); }
      catch (reason) { if (!stopped) setConnectionError(reason instanceof Error ? reason.message : t("Não foi possível atualizar o networking.")); }
      finally { polling = false; if (!stopped) setLoading(false); }
    };
    void poll();
    const interval = window.setInterval(() => void poll(), 5000);
    return () => {
      stopped = true; mounted.current = false; generation.current += 1; window.clearInterval(interval);
      if (presenceJoined.current) void apiClient("networking-presences/leave/", { method: "POST", body: { event: event.id } }).catch(() => undefined);
    };
  }, [event.id, refresh, router, t, user]);

  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const update = () => {
      const size = element.getBoundingClientRect();
      const computed = window.getComputedStyle(element);
      const width = size.width - parseFloat(computed.paddingLeft) - parseFloat(computed.paddingRight);
      const height = size.height - parseFloat(computed.paddingTop) - parseFloat(computed.paddingBottom);
      if (width > 0 && height > 0) setLayout(networkingPageLayout(width, height));
    };
    const frame = window.requestAnimationFrame(update);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(element);
    window.addEventListener("resize", update);
    return () => { window.cancelAnimationFrame(frame); observer?.disconnect(); window.removeEventListener("resize", update); };
  }, []);

  const incoming = snapshot.requests.filter((request) => request.status === "pending" && request.recipient_registration === snapshot.ownRegistrationId);
  const outgoing = snapshot.requests.filter((request) => request.status === "pending" && request.sender_registration === snapshot.ownRegistrationId);
  const active = snapshot.requests.filter((request) => request.status === "accepted");
  const hasConversation = active.length > 0;
  const people = snapshot.people.filter(({ registration_detail: person }) => normalize(`${person.name} ${person.email} ${person.profile?.company ?? ""} ${person.profile?.role ?? ""}`).includes(normalize(search)));
  const rooms = [...snapshot.rooms].sort((a, b) => {
    const mineA = isOwnCompanyRoom(a, snapshot.ownRegistrationId, snapshot.ownCompany) ? 0 : 1;
    const mineB = isOwnCompanyRoom(b, snapshot.ownRegistrationId, snapshot.ownCompany) ? 0 : 1;
    if (mineA !== mineB) return mineA - mineB;
    return (a.company_name || a.name).localeCompare(b.company_name || b.name, intlLocale);
  });
  const items = view === "people" ? people : view === "salas" ? rooms : view === "received" ? incoming : view === "sent" ? outgoing : active;
  const pageCount = Math.max(1, Math.ceil(items.length / layout.pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const counts: Record<View, number> = { people: snapshot.people.length, salas: snapshot.rooms.length, received: incoming.length, sent: outgoing.length, active: active.length };
  const visiblePeople = people.slice(safePage * layout.pageSize, (safePage + 1) * layout.pageSize);
  const visibleRooms = rooms.slice(safePage * layout.pageSize, (safePage + 1) * layout.pageSize);
  const visibleRequests = (view === "received" ? incoming : view === "sent" ? outgoing : active).slice(safePage * layout.pageSize, (safePage + 1) * layout.pageSize);
  const pendingFor = (registrationId: string) => snapshot.requests.some((request) => request.status === "pending" && (request.sender_registration === registrationId || request.recipient_registration === registrationId));
  const targetAvailable = !!target && snapshot.people.some((person) => person.registration === target.registration);

  function changeView(next: View) { setView(next); setPage(0); setError(""); setNotice(""); }

  async function run(path: string, body: unknown, message: string) {
    if (operationRunning.current) return false;
    operationRunning.current = true; generation.current += 1;
    setWorking(true); setError(""); setNotice("");
    try {
      const updated = await apiClient<NetworkingRequest>(path, { method: "POST", ...(body === undefined ? {} : { body }) });
      if (!mounted.current) return true;
      if (updated?.id) setSnapshot((previous) => ({ ...previous, requests: [
        ...previous.requests.filter((request) => request.id !== updated.id),
        ...(["pending", "accepted"].includes(updated.status) ? [updated] : []),
      ] }));
      setNotice(message);
      try { await refresh(); }
      catch (reason) { if (mounted.current) setConnectionError(reason instanceof Error ? reason.message : t("A ação foi salva, mas a atualização falhou.")); }
      return true;
    } catch (reason) { if (mounted.current) setError(reason instanceof Error ? reason.message : t("Não foi possível concluir a ação.")); return false; }
    finally { operationRunning.current = false; if (mounted.current) setWorking(false); }
  }

  async function sendInvitation(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    if (!target || !snapshot.open || hasConversation || !targetAvailable || pendingFor(target.registration)) return;
    if (await run("networking-requests/", { event: event.id, recipient_registration: target.registration, topic: topic.trim() }, t("Convite enviado. A pessoa decide se quer conversar."))) {
      setTarget(null); setTopic("");
    }
  }

  async function respond(request: NetworkingRequest, action: "accept" | "decline" | "cancel") {
    if (action === "accept" && (!snapshot.open || hasConversation)) return;
    if (await run(`networking-requests/${request.id}/${action}/`, undefined, action === "accept" ? t("Convite aceito. Sua conversa está pronta.") : action === "decline" ? t("Convite recusado.") : t("Convite cancelado."))) {
      if (action === "accept") { setView("active"); setPage(0); }
    }
  }

  function openSalaDialog() {
    setSalaError("");
    setSalaForm((current) => ({ ...current, company_name: current.company_name || snapshot.ownCompany, contact_name: current.contact_name || user?.name || "" }));
    setSalaOpen(true);
  }

  async function createSala(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    const company = salaForm.company_name.trim();
    const contact = salaForm.contact_name.trim();
    if (!company) { setSalaError(t("Informe o nome da empresa.")); return; }
    if (!contact) { setSalaError(t("Informe o seu nome.")); return; }
    if (operationRunning.current) return;
    operationRunning.current = true; generation.current += 1;
    setSalaWorking(true); setSalaError(""); setNotice("");
    try {
      const created = await apiClient<Room>("rooms/networking/", {
        method: "POST",
        body: { event: event.id, company_name: company, contact_name: contact, location: salaForm.location.trim(), topic: salaForm.topic.trim() },
      });
      if (!mounted.current) return;
      setSnapshot((previous) => ({ ...previous, rooms: [...previous.rooms.filter((room) => room.id !== created.id), created] }));
      setSalaOpen(false);
      setNotice(t("Sala criada. Abra a sua sala para receber visitas."));
      try { await refresh(); }
      catch (reason) { if (mounted.current) setConnectionError(reason instanceof Error ? reason.message : t("A sala foi criada, mas a atualização falhou.")); }
    } catch (reason) {
      if (mounted.current) setSalaError(reason instanceof Error ? reason.message : t("Não foi possível criar a sala."));
    } finally { operationRunning.current = false; if (mounted.current) setSalaWorking(false); }
  }

  return <div className={portal.portal}><HomeHeader /><main className={styles.main}>
    <div className={portal.context}><div><small>{t("RODADAS DE NEGÓCIOS")}</small><strong>{event.name}</strong></div><Link className={portal.back} href={`/eventos/${event.slug}/lobby`}><ArrowLeft size={15} /> {t("Voltar ao lobby")}</Link></div>
    <section className={styles.intro}><div><h1>{t("Encontre pessoas. Comece uma conversa.")}</h1><p>{t("Envie um convite, entre na sala de uma empresa ou crie a sala da sua empresa para receber visitas.")}</p></div><div className={styles.introActions}><Link className={portal.secondary} href={`/eventos/${event.slug}/pos-evento`}>{t("Pós-evento")}</Link><span className={`${portal.badge} ${snapshot.open ? portal.open : ""}`}><i className={styles.statusDot} />{snapshot.open ? t("Rodadas abertas") : t("Fechadas pelo organizador")}</span></div></section>
    <nav className={styles.tabs} aria-label={t("Networking")} role="tablist">{(["people", "salas", "received", "sent", "active"] as View[]).map((item) => {
      const Icon = item === "people" ? UsersRound : item === "salas" ? Building2 : item === "received" ? Inbox : item === "sent" ? Send : MessageSquare;
      const label = item === "people" ? t("Pessoas") : item === "salas" ? t("Salas") : item === "received" ? t("Recebidos") : item === "sent" ? t("Enviados") : t("Conversa 1:1");
      return <button type="button" key={item} role="tab" aria-label={label} aria-selected={view === item} aria-controls="networking-results" className={view === item ? styles.selected : ""} onClick={() => changeView(item)}><Icon size={15} />{item === "active" ? <><span className={styles.desktopLabel}>{label}</span><span className={styles.mobileLabel}>1:1</span></> : label}<span className={styles.tabCount}>{counts[item] > 99 ? "99+" : counts[item]}</span></button>;
    })}</nav>
    {(connectionError || (error && !target && !ending && !salaOpen) || notice) && <div className={`${styles.feedback} ${connectionError || error ? styles.error : ""}`} role={connectionError || error ? "alert" : "status"}><span>{connectionError || error || notice}</span>{connectionError ? <button type="button" aria-label={t("Tentar atualizar")} disabled={working} onClick={() => void refresh().catch(() => undefined)}><RefreshCw size={15} /></button> : <button type="button" aria-label={t("Fechar mensagem")} onClick={() => { setError(""); setNotice(""); }}><X size={15} /></button>}</div>}
    <section className={styles.panel} id="networking-results" role="tabpanel" aria-label={t(titles[view])} aria-busy={loading || working || salaWorking}>
      <header className={styles.toolbar}><div><h2>{t(titles[view])}</h2><p>{view === "salas" ? snapshot.open ? t("Crie a sala da sua empresa, com seu nome e localização, e receba visitas no matchmaking.") : t("As rodadas estão fechadas; as salas abertas continuam acessíveis.") : hasConversation ? t("Você tem um 1:1 ativo. Saia dele para iniciar outra conversa.") : view === "people" ? t("Veja quem está por aqui e encontre pontos em comum.") : view === "received" ? t("Você escolhe qual convite quer aceitar.") : view === "sent" ? t("Acompanhe os convites que aguardam resposta.") : t("Os convites aceitos aparecem aqui.")}</p></div>{view === "people" && snapshot.open && <label className={styles.search}><Search size={16} /><input type="search" aria-label={t("Buscar pessoas no networking")} placeholder={t("Nome, empresa, cargo ou e-mail")} value={search} onChange={(change) => { setSearch(change.target.value); setPage(0); }} /></label>}{view === "salas" && <button className={portal.primary} type="button" disabled={working || salaWorking || !snapshot.open} onClick={openSalaDialog}><DoorOpen size={15} /> {snapshot.open ? t("Criar sala") : t("Rodadas fechadas")}</button>}</header>
      <div ref={viewport} className={`${styles.viewport} ${layout.compact ? styles.compact : ""}`} role="region" aria-label={t("Resultados do networking")}>
        {loading ? <div className={styles.empty}><LoaderCircle size={26} className="spin" /><p>{t("Encontrando as pessoas no evento…")}</p></div> : view === "salas" ? (!snapshot.open && !visibleRooms.length ? <div className={styles.empty}><LockKeyhole size={32} /><h2>{t("As rodadas estão fechadas.")}</h2><p>{t("O organizador libera as salas durante o evento. Você pode voltar ao auditório ou continuar um 1:1 já aceito na aba Conversa 1:1.")}</p><Link className={portal.secondary} href={`/eventos/${event.slug}/lobby`}>{t("Voltar ao lobby")} <ArrowRight size={16} /></Link></div> : !visibleRooms.length ? <div className={styles.empty}><Building2 size={30} /><h2>{t("Nenhuma sala aberta ainda.")}</h2><p>{snapshot.open ? t("Crie a primeira sala com o nome da sua empresa e o seu nome.") : t("Assim que o organizador abrir as rodadas, as salas das empresas aparecem aqui.")}</p></div> : <div className={styles.grid} style={{ "--network-columns": layout.columns, "--network-rows": layout.rows } as CSSProperties}>
          {visibleRooms.map((room) => {
            const mine = isOwnCompanyRoom(room, snapshot.ownRegistrationId, snapshot.ownCompany);
            return <article className={styles.card} key={room.id}>
              <div className={styles.identity}><span className={styles.avatar}>{initials(room.company_name || room.name)}</span><div><strong className={styles.name} title={room.company_name || room.name}>{room.company_name || room.name}</strong><span className={styles.role} title={[room.contact_name, room.location].filter(Boolean).join(" · ")}>{[room.contact_name, room.location].filter(Boolean).join(" · ") || t("Participante do evento")}</span></div></div>
              {room.description && <p className={styles.topic} title={room.description}>{room.description}</p>}
              <div className={styles.cardMeta}>{mine ? t("Sua sala neste evento") : t("Sala aberta para visitas")}</div>
              <div className={styles.actions}><Link className={styles.actionPrimary} href={`/eventos/${event.slug}/networking/salas/${room.id}`}>{mine ? t("Abrir minha sala") : t("Entrar na sala")} <ArrowRight size={14} /></Link></div>
            </article>;
          })}
        </div>) : view === "people" && !snapshot.open ? <div className={styles.empty}><LockKeyhole size={32} /><h2>{t("As rodadas estão fechadas.")}</h2><p>{t("Aguarde a liberação do organizador. Você pode voltar ao auditório ou continuar um 1:1 já aceito na aba Conversa 1:1.")}</p><Link className={portal.secondary} href={`/eventos/${event.slug}/lobby`}>{t("Voltar ao lobby")} <ArrowRight size={16} /></Link></div> : !items.length ? <div className={styles.empty}>{view === "people" ? <UsersRound size={30} /> : <MessageSquare size={30} />}<h2>{view === "people" ? search ? t("Nenhuma pessoa encontrada.") : t("Ninguém no networking agora.") : view === "received" ? t("Nenhum convite recebido por enquanto.") : view === "sent" ? t("Você não tem convites aguardando resposta.") : t("Você ainda não tem uma conversa ativa.")}</h2><p>{view === "people" ? search ? t("Tente buscar outro nome, empresa ou cargo.") : t("Continue aqui: as pessoas aparecem automaticamente ao entrar neste espaço.") : view === "active" ? t("Aceite um convite recebido ou encontre alguém na aba Pessoas.") : t("Use a aba Pessoas para começar uma conexão.")}</p>{view !== "people" && <button className={portal.secondary} type="button" onClick={() => changeView("people")}>{t("Encontrar pessoas")}</button>}</div> : <div className={styles.grid} style={{ "--network-columns": layout.columns, "--network-rows": layout.rows } as CSSProperties}>
          {view === "people" ? visiblePeople.map((presence) => <article className={styles.card} key={presence.id}><PersonIdentity person={presence.registration_detail} /><span className={styles.email} title={presence.registration_detail.email}>{presence.registration_detail.email}</span><div className={styles.cardMeta}><span><i className={styles.statusDot} /> {t("Online no networking")}</span></div><div className={styles.actions}><button type="button" className={styles.actionPrimary} disabled={working || hasConversation || pendingFor(presence.registration)} onClick={() => { setTarget(presence); setTopic(""); setError(""); }}><Handshake size={14} />{hasConversation ? t("Você está em um 1:1") : pendingFor(presence.registration) ? t("Convite pendente") : t("Convidar para conversar")}</button></div></article>)
            : visibleRequests.map((request) => {
              const person = request.sender_registration === snapshot.ownRegistrationId ? request.recipient_detail : request.sender_detail;
              return <article className={styles.card} key={request.id}><PersonIdentity person={person} /><p className={styles.topic} title={request.topic}>{request.topic || (view === "received" ? t("Quer conversar com você em particular.") : view === "sent" ? t("Convite para uma conversa de negócios.") : t("Sua sala privada está pronta."))}</p><div className={styles.cardMeta}>{view === "active" ? t("Conversa 1:1 ativa") : view === "received" ? t("Convite recebido") : t("Aguardando resposta")}</div><div className={styles.actions}>
                {view === "active" ? <><Link className={styles.actionPrimary} href={`/eventos/${event.slug}/networking/${request.id}`}>{t("Entrar na conversa")} <ArrowRight size={14} /></Link><button type="button" className={styles.actionDanger} disabled={working} onClick={() => { setEnding(request); setError(""); }}>{t("Sair do 1:1")}</button></>
                  : view === "received" ? <><button type="button" className={styles.actionPrimary} disabled={working || hasConversation || !snapshot.open} onClick={() => void respond(request, "accept")}><Check size={14} />{!snapshot.open ? t("Rodadas fechadas") : hasConversation ? t("1:1 ativo") : t("Aceitar")}</button><button type="button" disabled={working} onClick={() => void respond(request, "decline")}>{t("Recusar")}</button></>
                    : <button type="button" disabled={working} onClick={() => void respond(request, "cancel")}>{t("Cancelar convite")}</button>}
              </div></article>;
            })}
        </div>}
      </div>
      <footer className={styles.pagination}><span>{view === "people" && !snapshot.open ? t("Novos convites indisponíveis") : view === "people" ? t("{count} pessoas · {pageSize} por página", { count: items.length, pageSize: layout.pageSize }) : view === "salas" ? t("{count} salas · {pageSize} por página", { count: items.length, pageSize: layout.pageSize }) : t("{count} conversas · {pageSize} por página", { count: items.length, pageSize: layout.pageSize })}</span><div><button type="button" aria-label={t("Página anterior")} disabled={safePage === 0} onClick={() => setPage(safePage - 1)}><ChevronLeft size={16} /></button><span>{safePage + 1} / {pageCount}</span><button type="button" aria-label={t("Próxima página")} disabled={safePage >= pageCount - 1} onClick={() => setPage(safePage + 1)}><ChevronRight size={16} /></button></div></footer>
    </section>
    <footer className={portal.footer}><span>{t("BR Events · Conexões deste evento")}</span><span className={styles.statusText}><Radio size={11} /> {t("Atualização a cada 5 segundos")}</span></footer>
    {target && <Dialog title={t("Conversar com {name}?", { name: target.registration_detail.name })} busy={working} onClose={() => setTarget(null)}><form className={styles.form} onSubmit={sendInvitation}><PersonIdentity person={target.registration_detail} /><p>{target.registration_detail.email}</p><p>{t("A sala privada será criada quando a pessoa aceitar seu convite.")}</p>{(!snapshot.open || !targetAvailable) && <div className={styles.feedback}>{!snapshot.open ? t("O organizador fechou as rodadas. Aguarde a abertura.") : t("Esta pessoa saiu do networking.")}</div>}{error && <div className={`${styles.feedback} ${styles.error}`} role="alert">{error}</div>}<label className={styles.field}>{t("Sobre o que você quer conversar? (opcional)")}<textarea value={topic} onChange={(change) => setTopic(change.target.value)} maxLength={180} placeholder={t("Uma parceria, produto, projeto ou ideia…")} /></label><div className={styles.formActions}><button className={portal.secondary} type="button" disabled={working} onClick={() => setTarget(null)}>{t("Cancelar")}</button><button className={portal.primary} disabled={working || !snapshot.open || !targetAvailable || hasConversation || pendingFor(target.registration)}>{working ? t("Enviando…") : t("Enviar convite")}</button></div></form></Dialog>}
    {salaOpen && <Dialog title={t("Criar sala da empresa")} busy={salaWorking} onClose={() => setSalaOpen(false)}><form className={styles.form} onSubmit={createSala} noValidate><p>{t("A sala fica visível para todos os inscritos no evento. Nome e empresa são obrigatórios.")}</p><label className={styles.field}>{t("Nome da empresa *")}<input value={salaForm.company_name} onChange={(change) => setSalaForm((current) => ({ ...current, company_name: change.target.value }))} maxLength={120} placeholder={t("Ex.: Acme Ltda.")} required /></label><label className={styles.field}>{t("Seu nome *")}<input value={salaForm.contact_name} onChange={(change) => setSalaForm((current) => ({ ...current, contact_name: change.target.value }))} maxLength={120} placeholder={t("Ex.: Ana Lima")} required /></label><label className={styles.field}>{t("Localização (opcional)")}<input value={salaForm.location} onChange={(change) => setSalaForm((current) => ({ ...current, location: change.target.value }))} maxLength={120} placeholder={t("Ex.: São Paulo, SP")} /></label><label className={styles.field}>{t("Assunto (opcional)")}<input value={salaForm.topic} onChange={(change) => setSalaForm((current) => ({ ...current, topic: change.target.value }))} maxLength={180} placeholder={t("Ex.: Parcerias comerciais")} /></label>{salaError && <div className={`${styles.feedback} ${styles.error}`} role="alert">{salaError}</div>}{!snapshot.open && <div className={styles.feedback}>{t("O organizador fechou as rodadas. Aguarde a abertura para criar a sala.")}</div>}<div className={styles.formActions}><button className={portal.secondary} type="button" disabled={salaWorking} onClick={() => setSalaOpen(false)}>{t("Cancelar")}</button><button className={portal.primary} disabled={salaWorking || !snapshot.open}>{salaWorking ? t("Criando…") : t("Criar sala")}</button></div></form></Dialog>}
    {ending && <Dialog title={t("Sair desta conversa 1:1?")} busy={working} onClose={() => setEnding(null)}><p>{t("Esta conversa será encerrada para os dois participantes. Depois você poderá enviar e aceitar outros convites.")}</p>{error && <div className={`${styles.feedback} ${styles.error}`} role="alert">{error}</div>}<div className={styles.formActions}><button className={portal.secondary} disabled={working} onClick={() => setEnding(null)}>{t("Continuar no 1:1")}</button><button className={portal.primary} disabled={working} onClick={async () => { if (await run(`networking-requests/${ending.id}/end/`, undefined, t("Conversa encerrada. Você pode iniciar novas conexões."))) { setEnding(null); setView("people"); setPage(0); } }}>{t("Confirmar saída")}</button></div></Dialog>}
  </main></div>;
}

function PersonIdentity({ person }: { person: Registration }) {
  const { t } = useI18n();
  return <div className={styles.identity}><span className={styles.avatar}>{initials(person.name)}</span><div><strong className={styles.name} title={person.name}>{person.name}</strong><span className={styles.role} title={[person.profile?.company, person.profile?.role].filter(Boolean).join(" · ")}>{[person.profile?.company, person.profile?.role].filter(Boolean).join(" · ") || t("Participante do evento")}</span></div></div>;
}
