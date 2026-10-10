"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BarChart3, CalendarDays, Check, ChevronDown, ExternalLink, Film, LayoutDashboard, LogOut, MessageSquare, Plus, Radio, RefreshCw, Settings, Users } from "lucide-react";
import { Brand } from "./brand";
import { useSession } from "./session-provider";
import { apiClient } from "@/lib/api-client";
import type { Analytics, EventData, Registration, Room, Session, Speaker } from "@/lib/api-types";
import { AgendaPanel } from "./event-dashboard/agenda-panel";
import { InteractionsPanel } from "./event-dashboard/interactions-panel";
import { AnalyticsPanel } from "./event-dashboard/analytics-panel";
import { ParticipantsPanel, SettingsPanel, TransmissionPanel } from "./event-dashboard/management-panels";
import { dateTime, duration, Empty, listAll, mainRoom, Metric, type DashboardAction } from "./event-dashboard/shared";
import styles from "./event-dashboard/dashboard.module.css";

type Tab = "overview" | "agenda" | "stream" | "participants" | "interactions" | "analytics" | "settings";
const navigation = [
  { id: "overview", label: "Visão geral", icon: LayoutDashboard },
  { id: "agenda", label: "Programação", icon: CalendarDays },
  { id: "stream", label: "Auditório e rodadas", icon: Radio },
  { id: "participants", label: "Participantes", icon: Users },
  { id: "interactions", label: "Interações", icon: MessageSquare },
  { id: "analytics", label: "Resultados", icon: BarChart3 },
  { id: "settings", label: "Configurações", icon: Settings },
] as const;
const descriptions: Record<Tab, string> = {
  overview: "Prepare e acompanhe seu evento em um só lugar.", agenda: "Organize as palestras, os horários e quem vai apresentar.",
  stream: "O palco principal e as conversas de negócios deste evento.", participants: "Inscrições, informações profissionais e controle de acesso.",
  interactions: "Crie enquetes e organize as perguntas do público.", analytics: "Audiência, participação e conexões geradas pelo evento.",
  settings: "Informações públicas, inscrições e disponibilidade do evento.",
};

export function OrganizerDashboard({ initialEventId, initialTab = "overview" }: { initialEventId?: string; initialTab?: Tab }) {
  const router = useRouter();
  const { user } = useSession();
  const [events, setEvents] = useState<EventData[]>([]);
  const [activeId, setActiveId] = useState("");
  const [tab, setTab] = useState<Tab>(initialTab);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const generation = useRef(0);
  const activeEvent = events.find((item) => item.id === activeId);

  useEffect(() => {
    let cancelled = false;
    if (!user) { router.replace("/entrar?next=/painel"); return; }
    if (user.account_type !== "organizer" && !user.is_staff) { router.replace("/"); return; }
    listAll<EventData>("events/?managed=true").then((items) => {
      if (cancelled) return;
      const webEvents = items.filter((item) => item.public_config.product_type !== "meeting");
      setEvents(webEvents);
      setActiveId(webEvents.some((item) => item.id === initialEventId) ? initialEventId! : webEvents[0]?.id ?? "");
      if (!webEvents.length) setLoading(false);
    }).catch((reason: unknown) => { if (!cancelled) { setError(reason instanceof Error ? reason.message : "Não foi possível carregar os eventos."); setLoading(false); } });
    return () => { cancelled = true; };
  }, [initialEventId, router, user]);

  const load = useCallback(async (eventId: string) => {
    const current = ++generation.current;
    const [roomData, speakerData, sessionData, registrationData, metrics] = await Promise.all([
      listAll<Room>(`rooms/?event=${eventId}`), listAll<Speaker>(`speakers/?event=${eventId}`),
      listAll<Session>(`sessions/?event=${eventId}`), listAll<Registration>(`registrations/?event=${eventId}`),
      apiClient<Analytics>(`events/${eventId}/analytics/`),
    ]);
    if (current !== generation.current) return;
    setRooms(roomData); setSpeakers(speakerData); setSessions(sessionData); setRegistrations(registrationData); setAnalytics(metrics);
  }, []);

  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    load(activeId).catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "Não foi possível carregar o evento."); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; generation.current += 1; };
  }, [activeId, load]);

  useEffect(() => {
    if (!activeId || (tab !== "overview" && tab !== "analytics")) return;
    let cancelled = false;
    const timer = window.setInterval(() => {
      apiClient<Analytics>(`events/${activeId}/analytics/`).then((data) => { if (!cancelled) setAnalytics(data); }).catch(() => undefined);
    }, 30_000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [activeId, tab]);

  const action: DashboardAction = async (operation, message, onError) => {
    if (busy) return false;
    setBusy(true); setError(""); setNotice("");
    try {
      await operation();
      const items = await listAll<EventData>("events/?managed=true");
      setEvents(items.filter((item) => item.public_config.product_type !== "meeting"));
      await load(activeId); setNotice(message); return true;
    } catch (reason) { if (onError) onError(reason); else setError(reason instanceof Error ? reason.message : "Não foi possível salvar."); return false; }
    finally { setBusy(false); }
  };
  async function logout() { await fetch("/api/auth/logout", { method: "POST" }); router.push("/entrar"); router.refresh(); }

  return <main className={styles.workspace}>
    <aside className={styles.sidebar}><Brand href="/" /><small className={styles.navCaption}>GESTÃO DO EVENTO</small>
      <nav aria-label="Painel do evento">
        {navigation.filter((item) => item.id !== "settings").map(({ id, label, icon: Icon }) => <button key={id} type="button" aria-current={tab === id ? "page" : undefined} className={tab === id ? styles.navActive : ""} onClick={() => setTab(id)}><Icon size={18} /><span>{label}</span></button>)}
        <span className={styles.comingSoon} tabIndex={0} aria-label="Gravações: em breve"><button type="button" disabled><Film size={18} /><span>Gravações</span></button><span className={styles.tooltip} role="tooltip">Em breve: gravações do evento</span></span>
      </nav>
      <footer><button type="button" className={tab === "settings" ? styles.navActive : ""} onClick={() => setTab("settings")}><Settings size={18} /> Configurações</button><div className={styles.account}><span>{user?.first_name?.[0] || "O"}</span><div><strong>{user?.name || user?.username}</strong><small>Organizador</small></div><button type="button" aria-label="Sair da conta" onClick={logout}><LogOut size={18} /></button></div></footer>
    </aside>
    <section className={styles.main}>
      <header className={styles.topbar}><div><span className={styles.kicker}>PAINEL DO ORGANIZADOR</span><h1>{navigation.find((item) => item.id === tab)?.label}</h1><p>{descriptions[tab]}</p></div><div className={styles.headerActions}>
        {events.length > 0 && <label className={styles.eventSelector}><CalendarDays size={20} /><span><small>Evento selecionado</small><select aria-label="Evento selecionado" value={activeId} disabled={busy} onChange={(event) => { setLoading(true); setError(""); setNotice(""); setRooms([]); setAnalytics(null); setActiveId(event.target.value); }}>{events.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></span><ChevronDown size={16} /></label>}
        <Link className={styles.primary} href="/painel/eventos/novo"><Plus size={17} /> Novo evento</Link>
      </div></header>
      {(error || notice) && <div className={error ? styles.error : styles.success} role={error ? "alert" : "status"}>{error || notice}<button type="button" onClick={() => { setError(""); setNotice(""); }} aria-label="Fechar mensagem">×</button></div>}
      <div className={styles.content} aria-busy={loading || busy}>
        {loading ? <Empty>Carregando informações do evento…</Empty> : !activeEvent ? <Empty><h2>Vamos criar seu primeiro evento?</h2><p>Configure as informações principais e receba um auditório pronto para testes.</p><Link className={styles.primary} href="/painel/eventos/novo">Criar evento</Link></Empty> : <div key={activeId}>
          {tab === "overview" && <Overview event={activeEvent} analytics={analytics} rooms={rooms} onNavigate={setTab} />}
          {tab === "agenda" && <AgendaPanel event={activeEvent} rooms={rooms} sessions={sessions} speakers={speakers} action={action} busy={busy} />}
          {tab === "stream" && <TransmissionPanel event={activeEvent} rooms={rooms} analytics={analytics} action={action} busy={busy} />}
          {tab === "participants" && <ParticipantsPanel event={activeEvent} items={registrations} action={action} busy={busy} />}
          {tab === "interactions" && <InteractionsPanel event={activeEvent} rooms={rooms} />}
          {tab === "analytics" && <AnalyticsPanel event={activeEvent} data={analytics} />}
          {tab === "settings" && <SettingsPanel event={activeEvent} action={action} busy={busy} />}
        </div>}
      </div>
      <footer className={styles.statusbar}><span><i />{activeEvent?.name || "BR Events"}</span><button type="button" disabled={busy || loading || !activeId} onClick={() => void action(async () => undefined, "Dados atualizados.")}><RefreshCw size={13} /> Atualizar dados</button></footer>
    </section>
  </main>;
}

function Overview({ event, analytics, rooms, onNavigate }: { event: EventData; analytics: Analytics | null; rooms: Room[]; onNavigate: (tab: Tab) => void }) {
  const room = mainRoom(rooms, event.id);
  const steps: Array<{ label: string; detail: string; done: boolean; tab: Tab }> = [
    { label: "Evento criado", detail: "Nome, descrição e horários definidos", done: true, tab: "settings" },
    { label: "Inscrições abertas", detail: "O público pode confirmar sua participação", done: event.registration_open, tab: "settings" },
    { label: "Auditório Zoom configurado", detail: "Sala principal pronta para receber o evento", done: !!room?.zoom_session?.configured, tab: "stream" },
    { label: "Evento publicado", detail: "Página disponível para os participantes", done: event.status === "published", tab: "settings" },
  ];
  const ready = steps.filter((item) => item.done).length;
  const ended = event.status === "ended" || event.status === "archived";
  return <div className={styles.stack}>
    <div className={styles.eventBanner}><div><span className={styles.badge}>{ended ? "Encerrado" : event.status === "published" ? "Publicado" : "Rascunho"}</span><h2>{event.name}</h2><p><CalendarDays size={16} />{dateTime(event.starts_at, event.timezone)} — {dateTime(event.ends_at, event.timezone)}</p></div><button className={styles.secondary} onClick={() => onNavigate("settings")}><Settings size={16} /> Editar evento</button></div>
    <div className={styles.metrics}><Metric label="Inscrições realizadas" value={analytics?.registrations ?? 0} detail={`${analytics?.confirmed_registrations ?? 0} confirmadas`} /><Metric label="Interações no chat" value={analytics?.chat_messages ?? 0} detail="Mensagens enviadas no evento" /><Metric label={analytics?.is_live ? "Transmissão ativa há" : "Tempo da última transmissão"} value={duration(analytics?.live_duration_seconds)} detail="Tempo do auditório principal" /><Metric label="Rodadas de negócios realizadas" value={analytics?.networking?.realized ?? 0} detail="Conversas 1:1 com presença dos dois participantes" /></div>
    <div className={styles.twoColumns}><section className={styles.card}><div className={styles.cardHeading}><div><h2>Preparação do evento</h2><p>Quatro passos para receber seu público.</p></div><span className={styles.badge}>{ready}/4</span></div><div className={styles.progress} role="progressbar" aria-label="Preparação do evento" aria-valuenow={ready} aria-valuemin={0} aria-valuemax={4}><span style={{ width: `${ready * 25}%` }} /></div><div className={styles.checklist}>{steps.map((step) => <button type="button" key={step.label} onClick={() => onNavigate(step.tab)}><span className={step.done ? styles.checkDone : styles.checkPending}>{step.done && <Check size={15} />}</span><div><strong>{step.label}</strong><small>{step.detail}</small></div></button>)}</div></section>
      <section className={styles.card}><div className={styles.cardHeading}><div><h2>Acessos rápidos</h2><p>Prévia, operação e conteúdo do evento.</p></div></div><div className={styles.quickLinks}>{!ended && <><Link href={`/eventos/${event.slug}`} target="_blank">Página do evento <ExternalLink size={17} /></Link><Link href={`/eventos/${event.slug}/ao-vivo`} target="_blank">Entrar no auditório principal <ExternalLink size={17} /></Link><Link href={`/eventos/${event.slug}/lobby`} target="_blank">Lobby e rodadas de negócios <ExternalLink size={17} /></Link></>}{ended && <p>O evento foi encerrado. Você pode reabri-lo nas configurações.</p>}<button onClick={() => onNavigate("agenda")}>Organizar programação e palestrantes <CalendarDays size={17} /></button></div><p className={styles.hint}>A programação é opcional. Gravações estarão disponíveis em breve.</p></section>
    </div>
  </div>;
}
