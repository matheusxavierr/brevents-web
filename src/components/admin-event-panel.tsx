"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BarChart3, CalendarClock, CheckCircle2, ExternalLink, Radio, Settings, Users, Video } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import type { Analytics, Paginated, Registration, Room } from "@/lib/api-types";
import { formatDateValue } from "@/lib/i18n";
import { useI18n } from "./i18n-provider";

type ManagedEvent = {
  id: string; owner: number; name: string; slug: string; description: string;
  status: "draft" | "published" | "ended" | "archived";
  access_mode: "public" | "registration" | "invite";
  starts_at: string; ends_at: string;
};
type ManagedUser = { id: number; username: string; first_name: string; last_name: string; email: string };
type PanelTab = "overview" | "live" | "participants" | "settings";

export function AdminEventPanel({ event, users, onBack, onEventUpdated }: { event: ManagedEvent; users: ManagedUser[]; onBack: () => void; onEventUpdated: () => Promise<void> }) {
  const { t, locale } = useI18n();
  const [tab, setTab] = useState<PanelTab>("overview");
  const [rooms, setRooms] = useState<Room[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const owner = users.find((user) => user.id === event.owner);
  const liveRooms = useMemo(() => rooms.filter((room) => room.zoom_session?.is_live), [rooms]);

  const loadOperations = useCallback(async () => {
    try {
      const [roomData, registrationData, analyticsData] = await Promise.all([
        apiClient<Paginated<Room>>(`rooms/?event=${event.id}`),
        apiClient<Paginated<Registration>>(`registrations/?event=${event.id}`),
        apiClient<Analytics>(`events/${event.id}/analytics/`),
      ]);
      setRooms(roomData.results);
      setRegistrations(registrationData.results);
      setAnalytics(analyticsData);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("Não foi possível carregar a operação do evento."));
    }
  }, [event.id, t]);

  useEffect(() => {
    let active = true;
    async function bootstrap() {
      await loadOperations();
      if (active) setLoading(false);
    }
    void bootstrap();
    const poll = window.setInterval(() => { void loadOperations(); }, 15_000);
    return () => { active = false; window.clearInterval(poll); };
  }, [loadOperations]);

  async function saveSettings(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    const data = Object.fromEntries(new FormData(formEvent.currentTarget));
    try {
      await apiClient(`admin/events/${event.id}/`, {
        method: "PATCH",
        body: {
          name: data.name,
          slug: data.slug,
          description: data.description,
          owner: data.owner,
          access_mode: data.access_mode,
          status: data.status,
          starts_at: new Date(String(data.starts_at)).toISOString(),
          ends_at: new Date(String(data.ends_at)).toISOString(),
        },
      });
      await onEventUpdated();
      setNotice(t("Configurações do evento atualizadas."));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("Não foi possível salvar o evento."));
    }
  }

  async function markLiveEnded(room: Room) {
    if (!room.zoom_session || !window.confirm(t("Marcar a transmissão de {name} como encerrada?", { name: room.name }))) return;
    try {
      await apiClient(`zoom-sessions/${room.zoom_session.id}/end-live/`, { method: "POST" });
      await loadOperations();
      setNotice(t("Status da transmissão encerrado."));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("Não foi possível encerrar o status da transmissão."));
    }
  }

  return (
    <div className="admin-event-panel">
      <button className="admin-context-back" type="button" onClick={onBack}><ArrowLeft size={17} /> {t("Voltar para todos os eventos")}</button>
      <nav className="admin-breadcrumb" aria-label={t("Localização")}><span>{t("Admin")}</span><span>/</span><span>{t("Todos os eventos")}</span><span>/</span><strong>{event.name}</strong></nav>
      <header className="admin-event-heading">
        <div><p className="eyebrow">{t("Gerenciamento como superadmin")}</p><h1>{event.name}</h1><p>{t("Você abriu a operação deste evento sem sair do painel administrativo global.")}</p></div>
        <div className={liveRooms.length ? "admin-live-state active" : "admin-live-state"}><span className="live-dot" /><div><strong>{liveRooms.length ? t("Transmissão ao vivo") : t("Nenhuma live ativa")}</strong><small>{liveRooms.length ? t("{count} sala(s) transmitindo agora", { count: liveRooms.length }) : t("Aguardando um host entrar na sala")}</small></div></div>
      </header>

      <nav className="admin-event-tabs" aria-label={t("Seções do evento")}>
        <button className={tab === "overview" ? "active" : ""} onClick={() => setTab("overview")}><BarChart3 size={17} /> {t("Visão geral")}</button>
        <button className={tab === "live" ? "active" : ""} onClick={() => setTab("live")}><Radio size={17} /> {t("Transmissão")} {liveRooms.length > 0 && <span>{liveRooms.length}</span>}</button>
        <button className={tab === "participants" ? "active" : ""} onClick={() => setTab("participants")}><Users size={17} /> {t("Participantes")}</button>
        <button className={tab === "settings" ? "active" : ""} onClick={() => setTab("settings")}><Settings size={17} /> {t("Configurações")}</button>
      </nav>

      {error && <p className="form-error" role="alert">{error}</p>}
      {notice && <p className="form-success"><CheckCircle2 size={15} /> {notice}</p>}
      {loading ? <div className="admin-panel-loading"><span className="navigation-spinner" /><span>{t("Carregando operação…")}</span></div> : (
        <>
          {tab === "overview" && <div className="admin-event-overview"><section className="stat-grid"><EventStat label={t("Inscritos")} value={analytics?.registrations ?? 0} /><EventStat label={t("Pessoas únicas")} value={analytics?.unique_viewers ?? 0} /><EventStat label={t("Visitas")} value={analytics?.total_visits ?? 0} /><EventStat label={t("Salas ao vivo")} value={liveRooms.length} live={liveRooms.length > 0} /></section><div className="admin-event-columns"><section className="dashboard-card admin-operation-card"><div className="card-header"><h2>{t("Contexto do evento")}</h2></div><dl><div><dt>{t("Responsável")}</dt><dd>{owner ? `${owner.first_name || owner.username} ${owner.last_name}` : t("Usuário #{id}", { id: event.owner })}</dd></div><div><dt>{t("E-mail")}</dt><dd>{owner?.email ?? t("Não localizado")}</dd></div><div><dt>{t("Publicação")}</dt><dd>{statusLabel(event.status, t)}</dd></div><div><dt>{t("Acesso")}</dt><dd>{accessLabel(event.access_mode, t)}</dd></div><div><dt>{t("Início")}</dt><dd>{formatDateValue(locale, event.starts_at, { dateStyle: "short", timeStyle: "medium" })}</dd></div></dl></section><section className="dashboard-card admin-operation-card"><div className="card-header"><div><h2>{t("Acessos rápidos")}</h2><span className="muted">{event.status === "published" ? t("Visão pública") : t("Prévia privada de gestor")}</span></div></div><div className="admin-operation-links"><Link href={`/eventos/${event.slug}`} target="_blank">{event.status === "published" ? t("Página pública") : t("Pré-visualizar página")} <ExternalLink size={15} /></Link><Link href={`/eventos/${event.slug}/ao-vivo`} target="_blank">{event.status === "published" ? t("Abrir sala ao vivo") : t("Testar sala ao vivo")} <ExternalLink size={15} /></Link><button type="button" onClick={() => setTab("live")}>{t("Monitorar transmissão")} <Radio size={15} /></button><button type="button" onClick={() => setTab("settings")}>{t("Editar configurações")} <Settings size={15} /></button></div></section></div></div>}

          {tab === "live" && <section className="dashboard-card admin-live-monitor"><div className="card-header"><div><h2>{t("Monitor de transmissão")}</h2><span className="muted">{t("Atualização automática a cada 15 segundos")}</span></div><button className="button button-secondary" type="button" onClick={() => void loadOperations()}>{t("Atualizar agora")}</button></div>{rooms.length ? <div className="admin-room-monitor-list">{rooms.map((room) => <article key={room.id}><div className={room.zoom_session?.is_live ? "room-live-icon active" : "room-live-icon"}><Video size={19} /></div><div><strong>{room.name}</strong><span>{room.mode === "meeting" ? t("Meeting colaborativo") : t("Evento moderado")}{room.zoom_session?.session_name ? ` · ${room.zoom_session.session_name}` : ""}</span></div><div className={room.zoom_session?.is_live ? "status-pill status-live" : "status-pill status-soon"}>{room.zoom_session?.is_live ? t("AO VIVO") : room.zoom_session ? t("OFFLINE") : t("SEM ZOOM")}</div>{room.zoom_session?.host_last_seen_at && <small>{t("Host visto {time}", { time: formatDateValue(locale, room.zoom_session.host_last_seen_at, { timeStyle: "medium" }) })}</small>}{room.zoom_session?.is_live && <button className="button button-secondary" type="button" onClick={() => void markLiveEnded(room)}>{t("Marcar encerrada")}</button>}</article>)}</div> : <div className="empty-inline"><Video size={28} /><strong>{t("Nenhuma sala configurada")}</strong><span>{t("O organizador ainda não criou uma sala para este evento.")}</span></div>}</section>}

          {tab === "participants" && <section className="dashboard-card"><div className="card-header"><div><h2>{t("Participantes inscritos")}</h2><span className="muted">{t("{count} registros carregados", { count: registrations.length })}</span></div></div><div className="data-table"><div className="data-row data-head"><span>{t("Nome")}</span><span>{t("E-mail")}</span><span>{t("Tipo")}</span><span>{t("Status")}</span></div>{registrations.map((registration) => <div className="data-row" key={registration.id}><strong>{registration.name}</strong><span>{registration.email}</span><span>{registration.user ? t("Conta") : t("Visitante")}</span><span>{registration.status}</span></div>)}</div></section>}

          {tab === "settings" && <section className="dashboard-card admin-settings-wide"><div className="card-header"><div><h2>{t("Configurações administrativas")}</h2><span className="muted">{t("Alterações feitas aqui afetam o evento do organizador.")}</span></div></div><form className="compact-form" key={`${event.id}-${event.name}`} onSubmit={saveSettings}><div className="form-grid"><label className="field"><span>{t("Nome")}</span><input name="name" defaultValue={event.name} required /></label><label className="field"><span>{t("Slug")}</span><input name="slug" defaultValue={event.slug} required /></label></div><label className="field"><span>{t("Descrição")}</span><textarea name="description" defaultValue={event.description} rows={4} /></label><label className="field"><span>{t("Organizador responsável")}</span><select name="owner" defaultValue={event.owner}>{users.map((user) => <option key={user.id} value={user.id}>{user.first_name || user.username} · {user.email}</option>)}</select></label><div className="form-grid"><label className="field"><span>{t("Início")}</span><input name="starts_at" type="datetime-local" defaultValue={localDateTime(event.starts_at)} required /></label><label className="field"><span>{t("Término")}</span><input name="ends_at" type="datetime-local" defaultValue={localDateTime(event.ends_at)} required /></label></div><div className="form-grid"><label className="field"><span>{t("Acesso")}</span><select name="access_mode" defaultValue={event.access_mode}><option value="public">{t("Público")}</option><option value="registration">{t("Conta obrigatória")}</option><option value="invite">{t("Convidados")}</option></select></label><label className="field"><span>{t("Status")}</span><select name="status" defaultValue={event.status}><option value="draft">{t("Rascunho")}</option><option value="published">{t("Publicado")}</option><option value="ended">{t("Encerrado")}</option><option value="archived">{t("Arquivado")}</option></select></label></div><button className="button button-primary">{t("Salvar alterações")}</button></form></section>}
        </>
      )}
    </div>
  );
}

function EventStat({ label, value, live = false }: { label: string; value: number; live?: boolean }) { const { t } = useI18n(); return <article className={live ? "stat-card live" : "stat-card"}><div className="stat-card-label"><span>{label}</span>{live ? <Radio size={17} /> : <CalendarClock size={17} />}</div><strong>{value}</strong><span className="trend">{t("dados da operação")}</span></article>; }
function localDateTime(value: string) { const date = new Date(value); const offset = date.getTimezoneOffset() * 60_000; return new Date(date.getTime() - offset).toISOString().slice(0, 16); }
function statusLabel(status: ManagedEvent["status"], t: (key: string) => string) { return { draft: t("Rascunho"), published: t("Publicado"), ended: t("Encerrado"), archived: t("Arquivado") }[status]; }
function accessLabel(access: ManagedEvent["access_mode"], t: (key: string) => string) { return { public: t("Público"), registration: t("Conta obrigatória"), invite: t("Somente convidados") }[access]; }
