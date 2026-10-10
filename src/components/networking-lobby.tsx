"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronLeft, ChevronRight, Handshake, Inbox, LoaderCircle, LockKeyhole, MessageSquare, Radio, RefreshCw, Search, Send, UsersRound, X } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { listAll } from "@/lib/api-pagination";
import { networkingPageLayout } from "@/lib/networking-layout";
import type { EventData, NetworkingPresence, NetworkingRequest, Registration } from "@/lib/api-types";
import { Dialog } from "./event-dashboard/shared";
import { HomeHeader } from "./home-header";
import { useSession } from "./session-provider";
import portal from "./event-portal.module.css";
import styles from "./networking-lobby.module.css";

type View = "people" | "received" | "sent" | "active";
type Snapshot = { open: boolean; people: NetworkingPresence[]; requests: NetworkingRequest[]; ownRegistrationId: string };
const titles: Record<View, string> = { people: "Pessoas no networking", received: "Convites recebidos", sent: "Convites enviados", active: "Sua conversa 1:1" };
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

export function NetworkingLobby({ event }: { event: EventData }) {
  const router = useRouter();
  const { user } = useSession();
  const [snapshot, setSnapshot] = useState<Snapshot>({ open: event.feature_flags.networking_open === true, people: [], requests: [], ownRegistrationId: "" });
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
  const [layout, setLayout] = useState(() => networkingPageLayout(1000, 400));
  const viewport = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);
  const generation = useRef(0);
  const operationRunning = useRef(false);
  const presenceJoined = useRef(false);

  const refresh = useCallback(async () => {
    const current = ++generation.current;
    const publicEvent = await apiClient<EventData>(`public/events/${encodeURIComponent(event.slug)}/`);
    const open = publicEvent.feature_flags.networking_open === true;
    const [pending, accepted, ownPresence] = await Promise.all([
      listAll<NetworkingRequest>(`networking-requests/?event=${event.id}&status=pending`),
      listAll<NetworkingRequest>(`networking-requests/?event=${event.id}&status=accepted`),
      open ? apiClient<NetworkingPresence>("networking-presences/heartbeat/", { method: "POST", body: { event: event.id } }) : Promise.resolve(null),
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
      setSnapshot({ open, people, requests, ownRegistrationId });
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
      catch (reason) { if (!stopped) setConnectionError(reason instanceof Error ? reason.message : "Não foi possível atualizar o networking."); }
      finally { polling = false; if (!stopped) setLoading(false); }
    };
    void poll();
    const interval = window.setInterval(() => void poll(), 5000);
    return () => {
      stopped = true; mounted.current = false; generation.current += 1; window.clearInterval(interval);
      if (presenceJoined.current) void apiClient("networking-presences/leave/", { method: "POST", body: { event: event.id } }).catch(() => undefined);
    };
  }, [event.id, refresh, router, user]);

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
  const items = view === "people" ? people : view === "received" ? incoming : view === "sent" ? outgoing : active;
  const pageCount = Math.max(1, Math.ceil(items.length / layout.pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const counts: Record<View, number> = { people: snapshot.people.length, received: incoming.length, sent: outgoing.length, active: active.length };
  const visiblePeople = people.slice(safePage * layout.pageSize, (safePage + 1) * layout.pageSize);
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
      catch (reason) { if (mounted.current) setConnectionError(reason instanceof Error ? reason.message : "A ação foi salva, mas a atualização falhou."); }
      return true;
    } catch (reason) { if (mounted.current) setError(reason instanceof Error ? reason.message : "Não foi possível concluir a ação."); return false; }
    finally { operationRunning.current = false; if (mounted.current) setWorking(false); }
  }

  async function sendInvitation(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    if (!target || !snapshot.open || hasConversation || !targetAvailable || pendingFor(target.registration)) return;
    if (await run("networking-requests/", { event: event.id, recipient_registration: target.registration, topic: topic.trim() }, "Convite enviado. A pessoa decide se quer conversar.")) {
      setTarget(null); setTopic("");
    }
  }

  async function respond(request: NetworkingRequest, action: "accept" | "decline" | "cancel") {
    if (action === "accept" && (!snapshot.open || hasConversation)) return;
    if (await run(`networking-requests/${request.id}/${action}/`, undefined, action === "accept" ? "Convite aceito. Sua conversa está pronta." : action === "decline" ? "Convite recusado." : "Convite cancelado.")) {
      if (action === "accept") { setView("active"); setPage(0); }
    }
  }

  return <div className={portal.portal}><HomeHeader /><main className={styles.main}>
    <div className={portal.context}><div><small>RODADAS DE NEGÓCIOS</small><strong>{event.name}</strong></div><Link className={portal.back} href={`/eventos/${event.slug}/lobby`}><ArrowLeft size={15} /> Voltar ao lobby</Link></div>
    <section className={styles.intro}><div><h1>Encontre pessoas. Comece uma conversa.</h1><p>Escolha alguém, envie um convite e, após o aceite, entre na sala privada 1:1.</p></div><span className={`${portal.badge} ${snapshot.open ? portal.open : ""}`}><i className={styles.statusDot} />{snapshot.open ? "Rodadas abertas" : "Fechadas pelo organizador"}</span></section>
    <nav className={styles.tabs} aria-label="Networking" role="tablist">{(["people", "received", "sent", "active"] as View[]).map((item) => {
      const Icon = item === "people" ? UsersRound : item === "received" ? Inbox : item === "sent" ? Send : MessageSquare;
      const label = item === "people" ? "Pessoas" : item === "received" ? "Recebidos" : item === "sent" ? "Enviados" : "Conversa 1:1";
      return <button type="button" key={item} role="tab" aria-label={label} aria-selected={view === item} aria-controls="networking-results" className={view === item ? styles.selected : ""} onClick={() => changeView(item)}><Icon size={15} />{item === "active" ? <><span className={styles.desktopLabel}>{label}</span><span className={styles.mobileLabel}>1:1</span></> : label}<span className={styles.tabCount}>{counts[item] > 99 ? "99+" : counts[item]}</span></button>;
    })}</nav>
    {(connectionError || (error && !target && !ending) || notice) && <div className={`${styles.feedback} ${connectionError || error ? styles.error : ""}`} role={connectionError || error ? "alert" : "status"}><span>{connectionError || error || notice}</span>{connectionError ? <button type="button" aria-label="Tentar atualizar" disabled={working} onClick={() => void refresh().catch(() => undefined)}><RefreshCw size={15} /></button> : <button type="button" aria-label="Fechar mensagem" onClick={() => { setError(""); setNotice(""); }}><X size={15} /></button>}</div>}
    <section className={styles.panel} id="networking-results" role="tabpanel" aria-label={titles[view]} aria-busy={loading || working}>
      <header className={styles.toolbar}><div><h2>{titles[view]}</h2><p>{hasConversation ? "Você tem um 1:1 ativo. Saia dele para iniciar outra conversa." : view === "people" ? "Veja quem está por aqui e encontre pontos em comum." : view === "received" ? "Você escolhe qual convite quer aceitar." : view === "sent" ? "Acompanhe os convites que aguardam resposta." : "Os convites aceitos aparecem aqui."}</p></div>{view === "people" && snapshot.open && <label className={styles.search}><Search size={16} /><input type="search" aria-label="Buscar pessoas no networking" placeholder="Nome, empresa, cargo ou e-mail" value={search} onChange={(change) => { setSearch(change.target.value); setPage(0); }} /></label>}</header>
      <div ref={viewport} className={`${styles.viewport} ${layout.compact ? styles.compact : ""}`} role="region" aria-label="Resultados do networking">
        {loading ? <div className={styles.empty}><LoaderCircle size={26} className="spin" /><p>Encontrando as pessoas no evento…</p></div> : view === "people" && !snapshot.open ? <div className={styles.empty}><LockKeyhole size={32} /><h2>As rodadas estão fechadas.</h2><p>Aguarde a liberação do organizador. Você pode voltar ao auditório ou continuar um 1:1 já aceito na aba Conversa 1:1.</p><Link className={portal.secondary} href={`/eventos/${event.slug}/lobby`}>Voltar ao lobby <ArrowRight size={16} /></Link></div> : !items.length ? <div className={styles.empty}>{view === "people" ? <UsersRound size={30} /> : <MessageSquare size={30} />}<h2>{view === "people" ? search ? "Nenhuma pessoa encontrada." : "Ninguém no networking agora." : view === "received" ? "Nenhum convite recebido por enquanto." : view === "sent" ? "Você não tem convites aguardando resposta." : "Você ainda não tem uma conversa ativa."}</h2><p>{view === "people" ? search ? "Tente buscar outro nome, empresa ou cargo." : "Continue aqui: as pessoas aparecem automaticamente ao entrar neste espaço." : view === "active" ? "Aceite um convite recebido ou encontre alguém na aba Pessoas." : "Use a aba Pessoas para começar uma conexão."}</p>{view !== "people" && <button className={portal.secondary} type="button" onClick={() => changeView("people")}>Encontrar pessoas</button>}</div> : <div className={styles.grid} style={{ "--network-columns": layout.columns, "--network-rows": layout.rows } as CSSProperties}>
          {view === "people" ? visiblePeople.map((presence) => <article className={styles.card} key={presence.id}><PersonIdentity person={presence.registration_detail} /><span className={styles.email} title={presence.registration_detail.email}>{presence.registration_detail.email}</span><div className={styles.cardMeta}><span><i className={styles.statusDot} /> Online no networking</span></div><div className={styles.actions}><button type="button" className={styles.actionPrimary} disabled={working || hasConversation || pendingFor(presence.registration)} onClick={() => { setTarget(presence); setTopic(""); setError(""); }}><Handshake size={14} />{hasConversation ? "Você está em um 1:1" : pendingFor(presence.registration) ? "Convite pendente" : "Convidar para conversar"}</button></div></article>)
            : visibleRequests.map((request) => {
              const person = request.sender_registration === snapshot.ownRegistrationId ? request.recipient_detail : request.sender_detail;
              return <article className={styles.card} key={request.id}><PersonIdentity person={person} /><p className={styles.topic} title={request.topic}>{request.topic || (view === "received" ? "Quer conversar com você em particular." : view === "sent" ? "Convite para uma conversa de negócios." : "Sua sala privada está pronta.")}</p><div className={styles.cardMeta}>{view === "active" ? "Conversa 1:1 ativa" : view === "received" ? "Convite recebido" : "Aguardando resposta"}</div><div className={styles.actions}>
                {view === "active" ? <><Link className={styles.actionPrimary} href={`/eventos/${event.slug}/networking/${request.id}`}>Entrar na conversa <ArrowRight size={14} /></Link><button type="button" className={styles.actionDanger} disabled={working} onClick={() => { setEnding(request); setError(""); }}>Sair do 1:1</button></>
                  : view === "received" ? <><button type="button" className={styles.actionPrimary} disabled={working || hasConversation || !snapshot.open} onClick={() => void respond(request, "accept")}><Check size={14} />{!snapshot.open ? "Rodadas fechadas" : hasConversation ? "1:1 ativo" : "Aceitar"}</button><button type="button" disabled={working} onClick={() => void respond(request, "decline")}>Recusar</button></>
                    : <button type="button" disabled={working} onClick={() => void respond(request, "cancel")}>Cancelar convite</button>}
              </div></article>;
            })}
        </div>}
      </div>
      <footer className={styles.pagination}><span>{view === "people" && !snapshot.open ? "Novos convites indisponíveis" : `${items.length} ${view === "people" ? "pessoas" : "conversas"} · ${layout.pageSize} por página`}</span><div><button type="button" aria-label="Página anterior" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}><ChevronLeft size={16} /></button><span>{safePage + 1} / {pageCount}</span><button type="button" aria-label="Próxima página" disabled={safePage >= pageCount - 1} onClick={() => setPage(safePage + 1)}><ChevronRight size={16} /></button></div></footer>
    </section>
    <footer className={portal.footer}><span>BR Events · Conexões deste evento</span><span className={styles.statusText}><Radio size={11} /> Atualização a cada 5 segundos</span></footer>
    {target && <Dialog title={`Conversar com ${target.registration_detail.name}?`} busy={working} onClose={() => setTarget(null)}><form className={styles.form} onSubmit={sendInvitation}><PersonIdentity person={target.registration_detail} /><p>{target.registration_detail.email}</p><p>A sala privada será criada quando a pessoa aceitar seu convite.</p>{(!snapshot.open || !targetAvailable) && <div className={styles.feedback}>{!snapshot.open ? "O organizador fechou as rodadas. Aguarde a abertura." : "Esta pessoa saiu do networking."}</div>}{error && <div className={`${styles.feedback} ${styles.error}`} role="alert">{error}</div>}<label className={styles.field}>Sobre o que você quer conversar? (opcional)<textarea value={topic} onChange={(change) => setTopic(change.target.value)} maxLength={180} placeholder="Uma parceria, produto, projeto ou ideia…" /></label><div className={styles.formActions}><button className={portal.secondary} type="button" disabled={working} onClick={() => setTarget(null)}>Cancelar</button><button className={portal.primary} disabled={working || !snapshot.open || !targetAvailable || hasConversation || pendingFor(target.registration)}>{working ? "Enviando…" : "Enviar convite"}</button></div></form></Dialog>}
    {ending && <Dialog title="Sair desta conversa 1:1?" busy={working} onClose={() => setEnding(null)}><p>Esta conversa será encerrada para os dois participantes. Depois você poderá enviar e aceitar outros convites.</p>{error && <div className={`${styles.feedback} ${styles.error}`} role="alert">{error}</div>}<div className={styles.formActions}><button className={portal.secondary} disabled={working} onClick={() => setEnding(null)}>Continuar no 1:1</button><button className={portal.primary} disabled={working} onClick={async () => { if (await run(`networking-requests/${ending.id}/end/`, undefined, "Conversa encerrada. Você pode iniciar novas conexões.")) { setEnding(null); setView("people"); setPage(0); } }}>Confirmar saída</button></div></Dialog>}
  </main></div>;
}

function PersonIdentity({ person }: { person: Registration }) {
  return <div className={styles.identity}><span className={styles.avatar}>{initials(person.name)}</span><div><strong className={styles.name} title={person.name}>{person.name}</strong><span className={styles.role} title={[person.profile?.company, person.profile?.role].filter(Boolean).join(" · ")}>{[person.profile?.company, person.profile?.role].filter(Boolean).join(" · ") || "Participante do evento"}</span></div></div>;
}
