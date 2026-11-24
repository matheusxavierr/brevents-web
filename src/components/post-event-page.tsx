"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, CalendarDays, LoaderCircle, MessageSquare, Star } from "lucide-react";

import { apiClient } from "@/lib/api-client";
import type { EventData, MatchmakingRound, PostEventData } from "@/lib/api-types";
import { HomeHeader } from "./home-header";
import { SiteFooter } from "./site-footer";
import { RoundFeedbackForm } from "./round-feedback-form";
import { useI18n } from "./i18n-provider";
import { useSession } from "./session-provider";
import styles from "./post-event.module.css";

export function PostEventPage({ event }: { event: EventData }) {
  const router = useRouter();
  const { user } = useSession();
  const { t, intlLocale } = useI18n();
  const [data, setData] = useState<PostEventData | null>(null);
  const [error, setError] = useState("");
  const [editingRound, setEditingRound] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  async function reload() {
    try {
      const result = await apiClient<PostEventData>(`matchmaking/post-event/?event=${event.id}`);
      setData(result);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("Não foi possível carregar o pós-evento."));
    }
  }

  useEffect(() => {
    if (!user) {
      router.replace(`/entrar?next=${encodeURIComponent(`/eventos/${event.slug}/pos-evento`)}`);
      return;
    }
    let active = true;
    apiClient<PostEventData>(`matchmaking/post-event/?event=${event.id}`)
      .then((result) => { if (active) { setData(result); setError(""); } })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : t("Não foi possível carregar o pós-evento.")); });
    return () => { active = false; };
  }, [event.id, event.slug, router, t, user]);

  useEffect(() => {
    if (data?.role === "coordinator") router.replace(`/painel?event=${event.id}`);
  }, [data?.role, event.id, router]);

  if (!user) return <main className={styles.loading}><LoaderCircle className="spin" /> {t("Carregando…")}</main>;
  if (!data) return <><HomeHeader /><main className={styles.loading}>{error ? <p className={styles.error} role="alert">{error}</p> : <><LoaderCircle className="spin" /> {t("Carregando…")}</>}</main><SiteFooter /></>;

  const registrationId = data.registration?.id ?? "";
  const started = data.event.started;
  const isParticipant = data.role === "participant";
  const pending = data.summary.feedback_pending;
  const rounds = data.rounds;
  const myEventFeedback = data.event_feedback.mine;

  function updateFeedback() {
    setEditingRound(null);
    setNotice(t("Feedback da rodada enviado. Obrigado!"));
    void reload();
  }

  function dateLabel(value: string) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat(intlLocale, { dateStyle: "short", timeStyle: "short" }).format(date);
  }

  function roundDate(round: MatchmakingRound) {
    return dateLabel(round.ended_at ?? round.starts_at);
  }

  return <div className={styles.page}>
    <HomeHeader />
    <main className={styles.main}>
      <div className={styles.context}>
        <div><small>{t("Pós-evento")}</small><strong>{data.event.name}</strong></div>
        <div className={styles.contextLinks}><Link href={`/eventos/${event.slug}`}>{t("Voltar ao evento")} <ArrowLeft size={14} /></Link><Link href={`/eventos/${event.slug}/gravacoes`}>{t("Ver gravações")}</Link></div>
      </div>

      <section className={styles.hero}>
        <span className={styles.badge}><CalendarDays size={14} /> {dateLabel(data.event.ends_at)}</span>
        <h1>{t("Avaliações e conexões do evento")}</h1>
        <p>{t("Avalie as rodadas e o evento, e sinalize conexões que deseja retomar.")}</p>
      </section>

      {isParticipant && <section className={styles.metrics}>
        <div className={styles.metric}><span>{t("Suas rodadas")}</span><strong>{data.summary.rounds}</strong></div>
        <div className={styles.metric}><span>{t("Respostas")}</span><strong>{data.summary.feedback_responses}</strong><small>{t("{count} pendentes", { count: pending })}</small></div>
        <div className={styles.metric}><span>{t("Média")}</span><strong>{data.summary.average_rating ?? "—"}</strong><small>{t("Sua avaliação das rodadas")}</small></div>
        <div className={styles.metric}><span>{t("Quer continuar")}</span><strong>{data.summary.continue_intents}</strong><small>{t("Conexões sinalizadas")}</small></div>
      </section>}

      <div className={styles.grid}>
        <section className={styles.card}>
          <div><h2>{t("Suas rodadas")}</h2><p>{t("A avaliação fica disponível após o fim de cada rodada.")}</p></div>
          {notice && <p className={styles.success} role="status">{notice}</p>}
          {error && <p className={styles.error} role="alert">{error}</p>}
          {!rounds.length ? <div className={styles.empty}><MessageSquare size={26} /><span>{t("Nenhuma rodada encerrada até o momento.")}</span></div> : <div className={styles.roundList}>
            {rounds.map((round) => {
              const feedback = round.feedback?.[0] ?? null;
              const counterpart = round.importer.id === registrationId ? round.exporter : round.importer;
              const editing = editingRound === round.id;
              return <article className={styles.roundCard} key={round.id}>
                <header className={styles.roundHead}>
                  <div><h3>{counterpart.name}</h3><p>{counterpart.company || t("Participante")} · {roundDate(round)}</p></div>
                  {feedback && !editing && <div className={styles.badgeRow}><span className={`${styles.badge} ${feedback.wants_continue ? styles.badgeSuccess : styles.badgeMuted}`}>{feedback.wants_continue ? t("Quero continuar") : t("Sem interesse em continuar")}</span></div>}
                </header>
                {feedback && !editing ? <div className={styles.summary}>
                  <div><div className={styles.stars} aria-label={t("Sua avaliação")}>{[1, 2, 3, 4, 5].map((value) => <Star key={value} size={16} fill={feedback.rating >= value ? "currentColor" : "none"} aria-hidden="true" />)}</div>{feedback.note && <p className={styles.note}>{feedback.note}</p>}</div>
                  <div className={styles.summaryActions}><button type="button" className={styles.secondary} onClick={() => setEditingRound(round.id)}>{t("Editar avaliação")}</button></div>
                </div> : <RoundFeedbackForm eventId={event.id} round={round} registrationId={registrationId} existing={feedback} onSaved={updateFeedback} onCancel={feedback ? () => setEditingRound(null) : undefined} />}
              </article>;
            })}
          </div>}
        </section>

        <aside className={styles.card}>
          <div><h2>{t("Avalie o evento")}</h2><p>{t("Sua opinião ajuda a organização a melhorar o evento.")}</p></div>
          {started ? <EventFeedbackForm key={myEventFeedback?.id ?? "new"} eventId={event.id} existing={myEventFeedback} onSaved={() => { setNotice(t("Avaliação do evento enviada.")); void reload(); }} /> : <p className={styles.empty}>{t("Este evento ainda não começou. Você poderá avaliar após o início.")}</p>}
          {isParticipant && <p className={styles.note}>{t("A coordenação acompanha os retornos e as intenções de continuar.")}</p>}
        </aside>
      </div>
    </main>
    <SiteFooter />
  </div>;
}

function EventFeedbackForm({ eventId, existing, onSaved }: { eventId: string; existing: { rating: number; comment: string } | null; onSaved: () => void }) {
  const { t } = useI18n();
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [comment, setComment] = useState(existing?.comment ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!rating) {
      setError(t("Escolha uma nota de 1 a 5."));
      return;
    }
    setSaving(true);
    setError("");
    try {
      await apiClient("matchmaking/event-feedback/", { method: "POST", body: { event: eventId, rating, comment: comment.trim() } });
      onSaved();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("Não foi possível enviar sua avaliação."));
    } finally {
      setSaving(false);
    }
  }

  return <div className={styles.eventForm}>
    <span className={styles.field}>{t("Como foi sua experiência no evento?")}</span>
    <div className={styles.starPicker} role="group" aria-label={t("Avaliação do evento")}>{[1, 2, 3, 4, 5].map((value) => <button key={value} type="button" className={styles.starButton} aria-label={`${t("Nota")} ${value}`} aria-pressed={rating >= value} disabled={saving} onClick={() => setRating(value)}><Star size={20} fill={rating >= value ? "currentColor" : "none"} aria-hidden="true" /></button>)}</div>
    <label className={styles.field}>{t("Comentário (opcional)")}<textarea value={comment} maxLength={2000} disabled={saving} onChange={(event) => setComment(event.target.value)} placeholder={t("Deixe um comentário sobre o evento (opcional).")} /></label>
    {error && <p className={styles.error} role="alert">{error}</p>}
    <button type="button" className={styles.primary} disabled={saving} onClick={() => void submit()}>{saving ? t("Enviando…") : existing ? t("Atualizar avaliação") : t("Enviar avaliação do evento")}</button>
    {existing && <p className={styles.note}>{t("Você pode atualizar sua avaliação a qualquer momento.")}</p>}
  </div>;
}
