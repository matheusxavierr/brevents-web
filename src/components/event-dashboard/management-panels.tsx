"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ExternalLink, Radio, Search, Settings, Users } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { ensureEventAuditorium } from "@/lib/event-room";
import type { Analytics, EventData, Registration, Room } from "@/lib/api-types";
import { dateTime, Dialog, Empty, localDateTime, mainRoom, Metric, type DashboardAction } from "./shared";
import styles from "./dashboard.module.css";
import { ImporterEnrollment } from "./importer-enrollment";

const registrationLabels = { confirmed: "Confirmada", pending: "Pendente", cancelled: "Cancelada", blocked: "Bloqueada" };
export const networkingLabels: Record<string, string> = { pending: "Aguardando", accepted: "Aceita", declined: "Recusada", cancelled: "Cancelada", ended: "Encerrada" };
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function ParticipantsPanel({ event, items, action, busy }: { event: EventData; items: Registration[]; action: DashboardAction; busy: boolean }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const filtered = items.filter((item) => normalize(`${item.name} ${item.email} ${item.profile.company || ""} ${item.profile.role || ""}`).includes(normalize(search)));
  const pages = Math.max(1, Math.ceil(filtered.length / 10));
  const safePage = Math.min(page, pages - 1);
  return <section className={styles.card}>
    <div className={`${styles.cardHeading} ${styles.participantsHeading}`}><div><h2>Inscrições do evento</h2><p>{items.length} pessoas inscritas · informações fornecidas na inscrição</p></div><ImporterEnrollment event={event} action={action} busy={busy} /></div>
    <div className={styles.toolbar}><label className={styles.search}><Search size={17} /><input type="search" aria-label="Buscar participantes" placeholder="Nome, e-mail, empresa ou cargo" value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} /></label>
      <div className={styles.pagination}><span>{filtered.length} resultados · 10 por página</span><button type="button" aria-label="Página anterior" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}><ChevronLeft size={16} /></button><span>{safePage + 1} / {pages}</span><button type="button" aria-label="Próxima página" disabled={safePage >= pages - 1} onClick={() => setPage(safePage + 1)}><ChevronRight size={16} /></button></div>
    </div>
    {filtered.length ? <div className={styles.tableWrap}><table className={styles.table}>
      <thead><tr><th>Nome</th><th>E-mail</th><th>Inscrição</th><th>Possui conta?</th><th>Empresa</th><th>Cargo</th><th>Matchmaking</th><th>Status</th></tr></thead>
      <tbody>{filtered.slice(safePage * 10, safePage * 10 + 10).map((item) => <tr key={item.id}>
        <td>{item.name}</td><td>{item.email}</td><td>{dateTime(item.created_at, event.timezone)}</td><td><span className={styles.badge}>{item.user ? "Sim" : "Não"}</span></td><td>{item.profile.company || "—"}</td><td>{item.profile.role || "—"}</td>
        <td><select aria-label={`Perfil de matchmaking de ${item.name}`} value={item.matchmaking_role || "importer"} disabled={busy} onChange={(change) => void action(() => apiClient(`registrations/${item.id}/`, { method: "PATCH", body: { matchmaking_role: change.target.value } }), "Perfil atualizado. A sala do exportador é criada automaticamente.")}><option value="importer">Importador</option><option value="exporter">Exportador</option></select></td>
        <td><select aria-label={`Status de ${item.name}`} value={item.status} disabled={busy} onChange={(change) => void action(() => apiClient(`registrations/${item.id}/`, { method: "PATCH", body: { status: change.target.value } }), "Status da inscrição atualizado.")}>{Object.entries(registrationLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></td>
      </tr>)}</tbody></table></div> : <Empty>Nenhum participante encontrado.</Empty>}
    <p className={styles.hint}>Exportadores têm uma sala por empresa; importadores aguardam o direcionamento da coordenação. Para inscrições antigas, escolha o perfil acima.</p>
    <p className={styles.hint}>Bloquear uma inscrição impede novos acessos. A remoção de quem já está na transmissão é feita pela lista de participantes do auditório.</p>
  </section>;
}

export function TransmissionPanel({ event, rooms, analytics, action, busy }: { event: EventData; rooms: Room[]; analytics: Analytics | null; action: DashboardAction; busy: boolean }) {
  const room = mainRoom(rooms, event.id);
  const [editing, setEditing] = useState(false);
  const [networkingChange, setNetworkingChange] = useState<boolean | null>(null);
  const networkingOpen = event.feature_flags.networking_open === true;
  const ended = event.status === "ended" || event.status === "archived";
  const questionConfig = room?.module_config?.find((item) => item.type === "question")?.config;
  async function save(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    if (!room) return;
    const data = new FormData(formEvent.currentTarget);
    const questionModule = { type: "question", config: { active: data.has("questions"), requires_moderation: data.has("moderation") } };
    const modules = [...(room.module_config ?? []).filter((item) => item.type !== "question"), questionModule];
    if (await action(() => apiClient(`rooms/${room.id}/`, { method: "PATCH", body: { name: data.get("name"), description: data.get("description"), module_config: modules } }), "Auditório atualizado.")) setEditing(false);
  }
  return <div className={styles.stack}>
    {networkingChange !== null && <Dialog title={networkingChange ? "Abrir rodadas de negócios?" : "Fechar rodadas de negócios?"} onClose={() => setNetworkingChange(null)} busy={busy}><p>{networkingChange ? "Exportadores acessarão suas salas e importadores entrarão na espera. A coordenação poderá direcionar as conversas 1:1." : "Novos direcionamentos ficarão indisponíveis. Reuniões em andamento poderão concluir seus dez minutos normalmente."}</p><div className={styles.formActions}><button className={styles.secondary} disabled={busy} onClick={() => setNetworkingChange(null)}>Cancelar</button><button className={networkingChange ? styles.primary : styles.danger} disabled={busy} onClick={async () => { if (await action(() => apiClient(`events/${event.id}/networking-state/`, { method: "POST", body: { open: networkingChange } }), networkingChange ? "Rodadas de negócios abertas." : "Rodadas de negócios fechadas.")) setNetworkingChange(null); }}>Confirmar</button></div></Dialog>}
    <div className={styles.twoColumns}>
      <section className={styles.card}><div className={styles.cardHeading}><div><h2>Auditório principal</h2><p>Onde o organizador e os convidados apresentam ao público.</p></div><Radio size={22} /></div>{room ? <><div className={styles.roomVisual}><Radio size={32} /><strong>{room.name}</strong><span className={styles.badge}>{room.zoom_session?.configured ? room.zoom_session.is_live ? "Transmissão ativa" : "Zoom configurado" : "Zoom não configurado"}</span></div><p>Participantes entram como espectadores. Os convites para usar microfone e câmera são feitos dentro da transmissão.</p><div className={styles.rowActions}>{!ended && <Link className={styles.primary} href={`/eventos/${event.slug}/ao-vivo`} target="_blank"><ExternalLink size={16} /> Abrir auditório</Link>}<button className={styles.secondary} type="button" onClick={() => setEditing(true)}><Settings size={16} /> Configurar auditório</button></div>{!room.zoom_session?.configured && <p className={styles.hint}>A equipe BR Events precisa configurar a integração Zoom para liberar a transmissão.</p>}</> : <Empty><p>Este evento ainda não tem um auditório principal.</p><button type="button" className={styles.primary} disabled={busy || ended} onClick={() => void action(() => ensureEventAuditorium(event.id), "Auditório preparado. Você já pode publicar o evento nas configurações.")}><Radio size={16} /> Preparar auditório</button></Empty>}</section>
      <section className={styles.card}><div className={styles.cardHeading}><div><h2>Rodadas de negócios</h2><p>Conversas privadas entre um exportador e um importador.</p></div><Users size={22} /></div><div className={styles.rowActions}><span className={styles.badge}>{networkingOpen ? "Abertas pelo organizador" : "Fechadas pelo organizador"}</span><button type="button" className={networkingOpen ? styles.danger : styles.primary} disabled={busy || ended} onClick={() => setNetworkingChange(!networkingOpen)}>{networkingOpen ? "Fechar rodadas" : "Abrir rodadas"}</button></div><p>As salas das empresas são criadas na inscrição dos exportadores. A coordenação seleciona um importador da espera e direciona para uma empresa disponível.</p><div className={styles.metrics} style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}><Metric label="Empresas com sala" value={rooms.filter((item) => item.coordinated).length} /><Metric label="Limite por conversa" value="10 min" /></div>{!ended && <Link className={styles.secondary} href={`/eventos/${event.slug}/networking`} target="_blank" style={{ marginTop: 18 }}><ExternalLink size={16} /> Gerenciar rodadas</Link>}<p className={styles.hint}>Na aba Salas e matchmaking, acompanhe a espera, quem entrou nas salas e o tempo restante de cada conversa.</p></section>
    </div>
    <section className={styles.card}><div className={styles.cardHeading}><div><h2>Conversas vinculadas ao evento</h2><p>Até 100 convites mais recentes; o total completo está em Resultados.</p></div></div>{analytics?.networking?.conversations?.length ? <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Participantes</th><th>Assunto</th><th>Data</th><th>Status</th><th>Presença dos dois</th></tr></thead><tbody>{analytics.networking.conversations.map((item) => <tr key={item.id}><td>{item.sender} ↔ {item.recipient}</td><td>{item.topic || "Conversa de negócios"}</td><td>{dateTime(item.created_at, event.timezone)}</td><td>{networkingLabels[item.status] ?? item.status}</td><td>{item.realized ? "Registrada" : "Não registrada"}</td></tr>)}</tbody></table></div> : <Empty>As conversas aparecerão aqui quando os participantes enviarem convites pelo lobby.</Empty>}</section>
    {editing && room && <Dialog title="Configurar auditório" onClose={() => setEditing(false)} busy={busy}><form className={styles.form} onSubmit={save}><label className={styles.field}>Nome do auditório<input name="name" defaultValue={room.name} maxLength={200} required /></label><label className={styles.field}>Descrição<textarea name="description" defaultValue={room.description} /></label><label className={styles.checkField}><input name="questions" type="checkbox" defaultChecked={!!questionConfig?.active} /> Permitir perguntas do público</label><label className={styles.checkField}><input name="moderation" type="checkbox" defaultChecked={questionConfig?.requires_moderation !== false} /> Revisar perguntas antes de exibir ao público</label><p className={styles.hint}>Cada participante pode enviar uma pergunta a cada cinco minutos, em todo o evento.</p><div className={styles.formActions}><button className={styles.secondary} type="button" onClick={() => setEditing(false)} disabled={busy}>Cancelar</button><button className={styles.primary} disabled={busy}>Salvar auditório</button></div></form></Dialog>}
  </div>;
}

export function SettingsPanel({ event, action, busy }: { event: EventData; action: DashboardAction; busy: boolean }) {
  const [confirm, setConfirm] = useState<"publish" | "end" | "reopen" | null>(null);
  const ended = event.status === "ended" || event.status === "archived";
  async function save(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault(); const data = new FormData(formEvent.currentTarget);
    await action(() => apiClient(`events/${event.id}/`, { method: "PATCH", body: {
      name: data.get("name"), description: data.get("description"), starts_at: new Date(String(data.get("starts_at"))).toISOString(), ends_at: new Date(String(data.get("ends_at"))).toISOString(),
      access_mode: data.get("access_mode"), registration_open: data.has("registration_open"), public_config: { ...event.public_config, subtitle: data.get("subtitle") },
    } }), "Configurações salvas.");
  }
  return <div className={styles.twoColumns}><section className={styles.card}><div className={styles.cardHeading}><div><h2>Informações do evento</h2><p>Esses dados aparecem na página pública.</p></div></div><form key={`${event.id}-${event.starts_at}-${event.name}`} className={styles.form} onSubmit={save}>
    <label className={styles.field}>Nome do evento *<input name="name" defaultValue={event.name} required maxLength={200} /></label><label className={styles.field}>Frase principal<input name="subtitle" defaultValue={String(event.public_config.subtitle ?? "")} /></label><label className={styles.field}>Descrição<textarea name="description" defaultValue={event.description} /></label>
    <div className={styles.formGrid}><label className={styles.field}>Início *<input name="starts_at" type="datetime-local" defaultValue={localDateTime(event.starts_at)} required /></label><label className={styles.field}>Término *<input name="ends_at" type="datetime-local" defaultValue={localDateTime(event.ends_at)} required /></label></div><small className={styles.hint}>Horários no fuso do seu dispositivo. O evento é exibido em {event.timezone}.</small>
    <label className={styles.field}>Quem pode acessar?<select name="access_mode" defaultValue={event.access_mode}><option value="registration">Inscrição obrigatória</option><option value="public">Público</option><option value="invite">Somente convidados</option></select></label><label className={styles.checkField}><input name="registration_open" type="checkbox" defaultChecked={event.registration_open} /> Inscrições abertas</label><div className={styles.formActions}><button className={styles.primary} disabled={busy}>Salvar alterações</button></div>
  </form></section><div className={styles.stack}><section className={styles.card}><div className={styles.cardHeading}><h2>Disponibilidade</h2><span className={styles.badge}>{ended ? "Encerrado" : event.status === "published" ? "Publicado" : "Rascunho"}</span></div><p>{ended ? "O acesso público e as inscrições estão fechados. Reabra o evento se quiser receber participantes novamente." : event.status === "published" ? "Sua página está publicada. Use o link abaixo para conferir o que o público vê." : "Publique o evento para disponibilizar a página e receber inscrições."}</p><div className={styles.rowActions}>{ended ? <button className={styles.primary} onClick={() => setConfirm("reopen")}>Reabrir evento</button> : event.status !== "published" ? <button className={styles.primary} onClick={() => setConfirm("publish")}>Publicar evento</button> : <Link className={styles.secondary} href={`/eventos/${event.slug}`} target="_blank"><ExternalLink size={16} /> Ver página pública</Link>}</div></section>{event.status === "published" && <section className={styles.card}><h2>Encerrar evento</h2><p>Encerra o acesso à página pública, às inscrições e às salas ao vivo.</p><button className={styles.danger} onClick={() => setConfirm("end")}>Encerrar evento</button></section>}</div>
    {confirm && <Dialog title={confirm === "end" ? "Encerrar este evento?" : confirm === "reopen" ? "Reabrir este evento?" : "Publicar este evento?"} onClose={() => setConfirm(null)} busy={busy}><p>{confirm === "end" ? "Os participantes perderão o acesso à página e às salas. Você poderá reabrir o evento posteriormente." : "A página pública e as inscrições ficarão disponíveis para o público conforme as regras de acesso."}</p><div className={styles.formActions}><button className={styles.secondary} disabled={busy} onClick={() => setConfirm(null)}>Cancelar</button><button className={confirm === "end" ? styles.danger : styles.primary} disabled={busy} onClick={async () => { if (await action(() => apiClient(`events/${event.id}/${confirm}/`, { method: "POST" }), confirm === "end" ? "Evento encerrado." : "Evento publicado e disponível.")) setConfirm(null); }}>{busy ? "Salvando…" : "Confirmar"}</button></div></Dialog>}
  </div>;
}
