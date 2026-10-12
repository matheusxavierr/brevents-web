"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Check, MessageSquare, Pencil, Pin, Plus, RefreshCw, Trash2 } from "lucide-react";
import type { EventData, Poll, Question, Room } from "@/lib/api-types";
import { apiClient } from "@/lib/api-client";
import { dateTime, Dialog, Empty, listAll, mainRoom } from "./shared";
import styles from "./dashboard.module.css";

const pollStates: Record<string, string> = { draft: "Rascunho", open: "Aberta", closed: "Encerrada", archived: "Arquivada" };
const questionStates: Record<string, string> = { mod_queue: "Aguardando revisão", visible: "Aprovada", archived: "Arquivada" };
type Editor = { kind: "poll"; item?: Poll } | { kind: "question"; item?: Question };

export function InteractionsPanel({ event, rooms }: { event: EventData; rooms: Room[] }) {
  const [view, setView] = useState<"polls" | "questions">("polls");
  const [polls, setPolls] = useState<Poll[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [filter, setFilter] = useState("all");
  const [editor, setEditor] = useState<Editor | null>(null);
  const [removing, setRemoving] = useState<Editor | null>(null);
  const [options, setOptions] = useState(["", ""]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const room = mainRoom(rooms);
  const load = useCallback(async () => {
    const [pollData, questionData] = await Promise.all([listAll<Poll>(`polls/?room__event=${event.id}`), listAll<Question>(`questions/?room__event=${event.id}`)]);
    return { pollData, questionData };
  }, [event.id]);
  useEffect(() => {
    let cancelled = false;
    const refresh = () => { void load().then(({ pollData, questionData }) => { if (!cancelled) { setPolls(pollData); setQuestions(questionData); setNow(Date.now()); } }).catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "Não foi possível carregar as interações."); }).finally(() => { if (!cancelled) setLoading(false); }); };
    refresh(); const timer = window.setInterval(refresh, 30_000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [load]);

  async function run(operation: () => Promise<unknown>, message: string) {
    if (busy) return false;
    setBusy(true); setError(""); setNotice("");
    try { await operation(); const { pollData, questionData } = await load(); setPolls(pollData); setQuestions(questionData); setNow(Date.now()); setNotice(message); return true; }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível salvar."); return false; }
    finally { setBusy(false); }
  }
  function openEditor(value: Editor) { setError(""); setEditor(value); setOptions(value.kind === "poll" ? value.item?.options.map((option) => option.text) ?? ["", ""] : []); }
  async function save(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault(); if (!editor || !room) return;
    const data = new FormData(formEvent.currentTarget);
    const payload = editor.kind === "poll" ? {
      room: editor.item?.room ?? room.id, question: data.get("question"),
      ...(editor.item?.total_votes ? {} : { options: options.map((text) => ({ text: text.trim() })), allows_multiple: data.has("allows_multiple") }),
      show_results_before_close: data.has("show_results_before_close"),
    } : { room: editor.item?.room ?? room.id, content: data.get("content") };
    const resource = editor.kind === "poll" ? "polls" : "questions";
    if (await run(() => apiClient(`${resource}/${editor.item ? `${editor.item.id}/` : ""}`, { method: editor.item ? "PATCH" : "POST", body: payload }), "Interação salva.")) setEditor(null);
  }

  const visibleQuestions = questions.filter((item) => filter === "all" || (filter === "answered" ? item.answered : item.state === filter));
  return <div className={styles.stack}>
    <div className={styles.toolbar}><div className={styles.tabs}><button className={view === "polls" ? styles.selected : ""} onClick={() => setView("polls")}>Enquetes ({polls.length})</button><button className={view === "questions" ? styles.selected : ""} onClick={() => setView("questions")}>Perguntas ({questions.length})</button></div><div className={styles.rowActions}><button className={styles.secondary} disabled={busy} onClick={() => void run(async () => undefined, "Interações atualizadas.")}><RefreshCw size={16} /> Atualizar</button><button className={styles.primary} disabled={!room || busy} onClick={() => openEditor({ kind: view === "polls" ? "poll" : "question" })}><Plus size={16} /> {view === "polls" ? "Nova enquete" : "Adicionar pergunta"}</button></div></div>
    {error && !editor && <p className={styles.error} role="alert">{error}</p>}{notice && <p className={styles.success} role="status">{notice}</p>}
    {loading ? <Empty>Carregando interações…</Empty> : view === "polls" ? <div className={styles.twoColumns}>{polls.length ? polls.map((poll) => <section className={styles.card} key={poll.id}><div className={styles.cardHeading}><span className={styles.badge}>{pollStates[poll.state]}</span><div className={styles.rowActions}><button className={styles.iconButton} aria-label={`Editar enquete ${poll.question}`} onClick={() => openEditor({ kind: "poll", item: poll })}><Pencil size={16} /></button><button className={styles.iconButton} aria-label={`Excluir enquete ${poll.question}`} onClick={() => setRemoving({ kind: "poll", item: poll })}><Trash2 size={16} /></button></div></div><h2>{poll.question}</h2><p>{poll.total_votes ?? 0} votos{poll.allows_multiple ? " (múltiplas escolhas)" : ""}</p>
      <div className={styles.pollResults}>{poll.options.map((option) => { const percent = poll.total_votes ? Math.round((option.votes ?? 0) / poll.total_votes * 100) : 0; return <div key={option.id}><div className={styles.resultLabel}><span>{option.text}</span><strong>{option.votes ?? 0} · {percent}%</strong></div><div className={styles.resultBar} role="meter" aria-label={option.text} aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${percent}%` }} /></div></div>; })}</div>
      <div className={styles.formActions}>{poll.state === "draft" || poll.state === "closed" ? <button className={styles.primary} disabled={busy} onClick={() => void run(() => apiClient(`polls/${poll.id}/transition/`, { method: "POST", body: { state: "open" } }), "Enquete aberta.")}>{poll.state === "closed" ? "Reabrir votação" : "Abrir votação"}</button> : poll.state === "open" ? <button className={styles.secondary} disabled={busy} onClick={() => void run(() => apiClient(`polls/${poll.id}/transition/`, { method: "POST", body: { state: "closed" } }), "Votação encerrada.")}>Encerrar votação</button> : <button className={styles.secondary} disabled={busy} onClick={() => void run(() => apiClient(`polls/${poll.id}/transition/`, { method: "POST", body: { state: "draft" } }), "Enquete restaurada.")}>Restaurar rascunho</button>}</div>
    </section>) : <Empty>Crie uma enquete para ouvir seu público. Ela só aparece para votação quando for aberta.</Empty>}</div> : <section className={styles.card}>
      <div className={styles.cardHeading}><div><h2>Moderação das perguntas</h2><p>Uma pergunta a cada cinco minutos por participante, em todo o evento.</p></div><select className={styles.secondary} aria-label="Filtrar perguntas" value={filter} onChange={(change) => setFilter(change.target.value)}><option value="all">Todas</option><option value="mod_queue">Aguardando revisão</option><option value="visible">Aprovadas</option><option value="answered">Respondidas</option><option value="archived">Arquivadas</option></select></div>
      <div className={styles.list}>{visibleQuestions.length ? visibleQuestions.map((item) => {
        const latest = questions.filter((question) => question.sender?.id === item.sender?.id).map((question) => question.created_at ? new Date(question.created_at).getTime() : 0);
        const remaining = item.sender?.id ? Math.max(0, Math.ceil((Math.max(...latest) + 300_000 - now) / 60_000)) : 0;
        return <article className={styles.listRow} key={item.id}><div><div className={styles.rowActions}><span className={styles.badge}>{questionStates[item.state]}</span>{item.answered && <span className={styles.badge}>Respondida</span>}{item.is_pinned && <Pin size={14} />}</div><h3 style={{ marginTop: 9 }}>{item.content}</h3><p>{item.sender?.name || [item.sender?.first_name, item.sender?.last_name].filter(Boolean).join(" ") || item.sender?.username || "Participante"} · {item.score} votos{item.created_at && ` · ${dateTime(item.created_at, event.timezone)}`}</p>{remaining > 0 && <p>Próxima pergunta deste participante em até {remaining} min.</p>}</div><div className={styles.rowActions}>
          {item.state !== "visible" && <button className={styles.secondary} disabled={busy} onClick={() => void run(() => apiClient(`questions/${item.id}/moderate/`, { method: "POST", body: { state: "visible" } }), "Pergunta aprovada.")}>Aprovar</button>}
          {!item.answered && <button className={styles.iconButton} disabled={busy} aria-label={`Marcar como respondida: ${item.content}`} onClick={() => void run(() => apiClient(`questions/${item.id}/moderate/`, { method: "POST", body: { state: item.state, answered: true } }), "Pergunta marcada como respondida.")}><Check size={16} /></button>}
          <button className={styles.iconButton} disabled={busy} aria-label={`${item.is_pinned ? "Desafixar" : "Fixar"} pergunta`} onClick={() => void run(() => apiClient(`questions/${item.id}/moderate/`, { method: "POST", body: { state: item.state, is_pinned: !item.is_pinned } }), "Destaque atualizado.")}><Pin size={16} /></button>
          {item.state !== "archived" && <button className={styles.secondary} disabled={busy} onClick={() => void run(() => apiClient(`questions/${item.id}/moderate/`, { method: "POST", body: { state: "archived" } }), "Pergunta arquivada.")}>Arquivar</button>}
          <button className={styles.iconButton} aria-label={`Editar pergunta ${item.content}`} onClick={() => openEditor({ kind: "question", item })}><Pencil size={16} /></button><button className={styles.iconButton} aria-label={`Excluir pergunta ${item.content}`} onClick={() => setRemoving({ kind: "question", item })}><Trash2 size={16} /></button>
        </div></article>;
      }) : <Empty><MessageSquare size={24} />Nenhuma pergunta neste filtro.</Empty>}</div>
    </section>}
    {editor && <Dialog title={editor.kind === "poll" ? editor.item ? "Editar enquete" : "Nova enquete" : editor.item ? "Editar pergunta" : "Adicionar pergunta"} onClose={() => setEditor(null)} busy={busy}><form className={styles.form} onSubmit={save}>{error && <p className={styles.error} role="alert">{error}</p>}{editor.kind === "poll" ? <><label className={styles.field}>Pergunta da enquete *<input name="question" defaultValue={editor.item?.question} required maxLength={500} /></label><div className={styles.options}>{options.map((option, index) => <div key={index}><input aria-label={`Opção ${index + 1}`} required maxLength={300} value={option} disabled={!!editor.item?.total_votes} onChange={(change) => setOptions((current) => current.map((value, position) => position === index ? change.target.value : value))} />{!editor.item?.total_votes && options.length > 2 && <button className={styles.iconButton} type="button" aria-label={`Remover opção ${index + 1}`} onClick={() => setOptions((current) => current.filter((_, position) => position !== index))}><Trash2 size={16} /></button>}</div>)}</div>{!editor.item?.total_votes ? <><button type="button" className={styles.secondary} disabled={options.length >= 12} onClick={() => setOptions((current) => [...current, ""])}>Adicionar opção</button><label className={styles.checkField}><input name="allows_multiple" type="checkbox" defaultChecked={editor.item?.allows_multiple} /> Permitir múltiplas escolhas</label></> : <p className={styles.hint}>As opções ficam preservadas após o primeiro voto.</p>}<label className={styles.checkField}><input name="show_results_before_close" type="checkbox" defaultChecked={editor.item?.show_results_before_close ?? true} /> Mostrar resultados aos participantes durante a votação</label><p className={styles.hint}>A enquete será vinculada ao auditório principal. Novas enquetes são salvas como rascunho.</p></> : <label className={styles.field}>Pergunta *<textarea name="content" defaultValue={editor.item?.content} required maxLength={3000} /></label>}<div className={styles.formActions}><button className={styles.secondary} type="button" onClick={() => setEditor(null)} disabled={busy}>Cancelar</button><button className={styles.primary} disabled={busy}>{busy ? "Salvando…" : "Salvar"}</button></div></form></Dialog>}
    {removing && <Dialog title="Excluir esta interação?" onClose={() => setRemoving(null)} busy={busy}><p>A interação e seus votos serão excluídos permanentemente.</p>{error && <p className={styles.error} role="alert">{error}</p>}<div className={styles.formActions}><button className={styles.secondary} disabled={busy} onClick={() => setRemoving(null)}>Cancelar</button><button className={styles.danger} disabled={busy} onClick={async () => { if (await run(() => apiClient(`${removing.kind === "poll" ? "polls" : "questions"}/${removing.item?.id}/`, { method: "DELETE" }), "Interação excluída.")) setRemoving(null); }}>Excluir</button></div></Dialog>}
  </div>;
}
