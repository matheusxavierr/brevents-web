"use client";

import { useState, type FormEvent } from "react";
import { CalendarDays, Pencil, Plus, Trash2, UserRound } from "lucide-react";
import type { EventData, Room, Session, Speaker } from "@/lib/api-types";
import { ApiError, apiClient, readError } from "@/lib/api-client";
import { useI18n } from "../i18n-provider";
import { dateTime, Dialog, Empty, localDateTime, mainRoom, type DashboardAction } from "./shared";
import styles from "./dashboard.module.css";

type Editor = { kind: "speaker"; item?: Speaker } | { kind: "talk"; item?: Session };

const fieldLabels: Record<string, string> = { title: "Título", room: "Auditório", event: "Evento", speakers: "Palestrantes", starts_at: "Início", ends_at: "Término", name: "Nome", email: "E-mail", avatar_url: "Foto", track: "Categoria", slug: "Endereço", status: "Exibição" };
function editorErrorMessage(reason: unknown, t: (key: string) => string) {
  if (reason instanceof ApiError && reason.status === 400 && reason.details && typeof reason.details === "object" && !Array.isArray(reason.details)) {
    return Object.entries(reason.details).map(([field, value]) => `${fieldLabels[field] ? `${t(fieldLabels[field])}: ` : ""}${readError(value)}`).join("\n");
  }
  return reason instanceof Error ? reason.message : t("Não foi possível salvar este cadastro.");
}

export function AgendaPanel({ event, rooms, sessions, speakers, action, busy }: { event: EventData; rooms: Room[]; sessions: Session[]; speakers: Speaker[]; action: DashboardAction; busy: boolean }) {
  const { t, locale } = useI18n();
  const [view, setView] = useState<"talks" | "speakers">("talks");
  const [editor, setEditor] = useState<Editor | null>(null);
  const [removing, setRemoving] = useState<Editor | null>(null);
  const [editorError, setEditorError] = useState("");
  const room = mainRoom(rooms, event.id);
  const talkLabels: Record<string, string> = { draft: "Rascunho", published: "Publicada", cancelled: "Cancelada" };
  function openEditor(value: Editor) { setEditorError(""); setEditor(value); }
  async function save(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    if (!editor) return;
    setEditorError("");
    const data = new FormData(formEvent.currentTarget);
    const payload = editor.kind === "speaker" ? { event: event.id, name: data.get("name"), email: data.get("email"), bio: data.get("bio"), avatar_url: data.get("avatar_url") } : {
      event: event.id, room: room?.id ?? null, title: data.get("title"), description: data.get("description"), track: data.get("track"),
      slug: editor.item?.slug ?? `${String(data.get("title")).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 70)}-${Date.now()}`,
      starts_at: new Date(String(data.get("starts_at"))).toISOString(), ends_at: new Date(String(data.get("ends_at"))).toISOString(),
      speakers: data.getAll("speakers"), status: data.get("status"), tags: editor.item?.tags ?? [],
    };
    const resource = editor.kind === "speaker" ? "speakers" : "sessions";
    if (await action(() => apiClient(`${resource}/${editor.item ? `${editor.item.id}/` : ""}`, { method: editor.item ? "PATCH" : "POST", body: payload }), editor.kind === "speaker" ? editor.item ? t("Palestrante atualizado.") : t("Palestrante adicionado.") : t("Programação salva."), (reason) => setEditorError(editorErrorMessage(reason, t)))) setEditor(null);
  }
  return <div className={styles.stack}>
    <div className={styles.eventBanner}><div><h2>{t("O que é a programação?")}</h2><p>{t("É a agenda pública: abertura, palestras, painéis e encerramento, com horários e apresentadores.")}</p><p>{t("Ela é opcional e não cria outra sala nem inicia a transmissão automaticamente.")}</p></div><CalendarDays size={32} /></div>
    <section className={styles.card}><div className={styles.toolbar}><div className={styles.tabs}><button className={view === "talks" ? styles.selected : ""} onClick={() => setView("talks")}><CalendarDays size={16} /> {t("Programação ({count})", { count: sessions.length })}</button><button className={view === "speakers" ? styles.selected : ""} onClick={() => setView("speakers")}><UserRound size={16} /> {t("Palestrantes ({count})", { count: speakers.length })}</button></div><button className={styles.primary} onClick={() => openEditor({ kind: view === "talks" ? "talk" : "speaker" })}><Plus size={16} /> {view === "talks" ? t("Adicionar à programação") : t("Adicionar palestrante")}</button></div>
      <div className={styles.list}>{view === "talks" ? sessions.length ? [...sessions].sort((a, b) => a.starts_at.localeCompare(b.starts_at)).map((item) => <article className={styles.listRow} key={item.id}><div><span className={styles.badge}>{t(talkLabels[item.status])}</span><h3 style={{ marginTop: 8 }}>{item.title}</h3><p>{dateTime(item.starts_at, event.timezone, locale)} — {dateTime(item.ends_at, event.timezone, locale)}</p><p>{item.speakers_detail?.map((speaker) => speaker.name).join(" · ") || t("Sem palestrante associado")}{item.track && ` · ${item.track}`}</p></div><div className={styles.rowActions}><button className={styles.iconButton} aria-label={t("Editar {name}", { name: item.title })} onClick={() => openEditor({ kind: "talk", item })}><Pencil size={16} /></button><button className={styles.iconButton} aria-label={t("Excluir {name}", { name: item.title })} onClick={() => setRemoving({ kind: "talk", item })}><Trash2 size={16} /></button></div></article>) : <Empty>{t("Adicione a abertura, uma palestra ou outro momento da sua programação.")}</Empty> : speakers.length ? speakers.map((item) => <article className={styles.listRow} key={item.id}><div><h3>{item.name}</h3><p>{item.email || t("E-mail não informado")}</p><p>{item.bio || t("Sem apresentação cadastrada")}</p></div><div className={styles.rowActions}><button className={styles.iconButton} aria-label={t("Editar {name}", { name: item.name })} onClick={() => openEditor({ kind: "speaker", item })}><Pencil size={16} /></button><button className={styles.iconButton} aria-label={t("Excluir {name}", { name: item.name })} onClick={() => setRemoving({ kind: "speaker", item })}><Trash2 size={16} /></button></div></article>) : <Empty>{t("Cadastre quem vai apresentar. Também é possível cadastrar palestrantes ao criar o evento.")}</Empty>}</div>
    </section>
    {editor && <Dialog title={editor.kind === "speaker" ? editor.item ? t("Editar palestrante") : t("Adicionar palestrante") : editor.item ? t("Editar programação") : t("Adicionar à programação")} onClose={() => { setEditor(null); setEditorError(""); }} busy={busy}><form className={styles.form} onSubmit={save}>
      {editorError && <div className={styles.inlineError} role="alert">{editorError}</div>}
      {editor.kind === "speaker" ? <><label className={styles.field}>{t("Nome")} *<input name="name" placeholder={t("Nome")} defaultValue={editor.item?.name} required maxLength={200} /></label><label className={styles.field}>{t("E-mail")}<input name="email" type="email" placeholder={t("E-mail")} defaultValue={editor.item?.email} /></label><label className={styles.field}>{t("Apresentação")}<textarea name="bio" placeholder={t("Mini bio")} defaultValue={editor.item?.bio} /></label><label className={styles.field}>{t("Foto (URL)")}<input name="avatar_url" type="url" defaultValue={editor.item?.avatar_url} /></label></> : <>
        <label className={styles.field}>{t("Título")} *<input name="title" defaultValue={editor.item?.title} placeholder={t("Ex.: Abertura ou palestra sobre inovação")} required maxLength={200} /></label><label className={styles.field}>{t("Descrição")}<textarea name="description" defaultValue={editor.item?.description} /></label>
        <div className={styles.formGrid}><label className={styles.field}>{t("Início")} *<input name="starts_at" type="datetime-local" defaultValue={localDateTime(editor.item?.starts_at ?? event.starts_at)} required /></label><label className={styles.field}>{t("Término")} *<input name="ends_at" type="datetime-local" defaultValue={localDateTime(editor.item?.ends_at ?? event.ends_at)} required /></label></div><small className={styles.hint}>{t("* Campos obrigatórios. Horários no fuso do dispositivo.")} {room ? t("Vinculada ao auditório deste evento.") : t("Você pode salvar a programação agora e preparar o auditório em Auditório e rodadas.")}</small>
        <div className={styles.formGrid}><label className={styles.field}>{t("Categoria (opcional)")}<input name="track" aria-describedby="program-category-help" defaultValue={editor.item?.track} placeholder={t("Ex.: Tecnologia ou Negócios")} /></label><label className={styles.field}>{t("Exibição")}<select name="status" defaultValue={editor.item?.status ?? "published"}><option value="published">{t("Publicada na agenda")}</option><option value="draft">{t("Rascunho")}</option><option value="cancelled">{t("Cancelada")}</option></select></label></div>
        <small id="program-category-help" className={styles.hint}>{t("A categoria serve apenas para agrupar apresentações por assunto na agenda. Pode deixá-la em branco.")}</small>
        <span className={styles.hint}>{t("Palestrantes (opcional)")}</span>{speakers.length ? speakers.map((speaker) => <label className={styles.checkField} key={speaker.id}><input name="speakers" type="checkbox" value={speaker.id} defaultChecked={editor.item?.speakers.includes(speaker.id)} /> {speaker.name}</label>) : <p className={styles.hint}>{t("Cadastre palestrantes na aba ao lado para vinculá-los à programação.")}</p>}
      </>}
      <div className={styles.formActions}><button className={styles.secondary} type="button" onClick={() => setEditor(null)} disabled={busy}>{t("Cancelar")}</button><button className={styles.primary} disabled={busy}>{busy ? t("Salvando…") : editor.kind === "speaker" && !editor.item ? t("Adicionar palestrante") : t("Salvar")}</button></div>
    </form></Dialog>}
    {removing && <Dialog title={t("Excluir este cadastro?")} onClose={() => setRemoving(null)} busy={busy}><p>{removing.kind === "speaker" ? t("O palestrante {name} será removido e desvinculado da programação.", { name: removing.item?.name ?? "" }) : t("O item {name} será removido da programação.", { name: removing.item?.title ?? "" })}</p><div className={styles.formActions}><button className={styles.secondary} disabled={busy} onClick={() => setRemoving(null)}>{t("Cancelar")}</button><button className={styles.danger} disabled={busy} onClick={async () => { if (await action(() => apiClient(`${removing.kind === "speaker" ? "speakers" : "sessions"}/${removing.item?.id}/`, { method: "DELETE" }), t("Cadastro excluído."))) setRemoving(null); }}>{t("Excluir")}</button></div></Dialog>}
  </div>;
}
