"use client";

import { RefreshCw, Star } from "lucide-react";
import { useEffect, useState } from "react";

import { apiClient } from "@/lib/api-client";
import type { EventData, PostEventData, RoundFeedback } from "@/lib/api-types";
import { formatDateValue } from "@/lib/i18n";
import { useI18n } from "../i18n-provider";
import { Empty, Metric } from "./shared";
import styles from "./dashboard.module.css";

export function PostEventPanel({ event }: { event: EventData }) {
  const { t, locale } = useI18n();
  const [data, setData] = useState<PostEventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    try {
      setData(await apiClient<PostEventData>(`matchmaking/post-event/?event=${event.id}`));
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("Não foi possível carregar o pós-evento."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    apiClient<PostEventData>(`matchmaking/post-event/?event=${event.id}`)
      .then((result) => { if (active) { setData(result); setError(""); } })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : t("Não foi possível carregar o pós-evento.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [event.id, t]);

  if (loading && !data) return <Empty>{t("Carregando…")}</Empty>;
  if (!data) return <p className={styles.error} role="alert">{error}</p>;
  const feedbackFor = (round: PostEventData["rounds"][number], registration: string) =>
    round.feedback?.find((item) => item.registration === registration) ?? null;
  return <div className={styles.stack}>
    <section className={styles.card}>
      <div className={styles.cardHeading}>
        <div><h2>{t("Rodadas e feedbacks")}</h2><p>{t("Acompanhe as avaliações e quem quer continuar cada conversa.")}</p></div>
        <button type="button" className={styles.secondary} onClick={() => void load()} disabled={loading}><RefreshCw size={15} /> {t("Atualizar dados")}</button>
      </div>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <div className={styles.metrics}>
        <Metric label={t("Rodadas realizadas")} value={data.summary.rounds} />
        <Metric label={t("Respostas das rodadas")} value={`${data.summary.feedback_responses}/${data.summary.feedback_expected}`} detail={`${data.summary.response_rate}%`} />
        <Metric label={t("Feedbacks pendentes")} value={data.summary.feedback_pending} />
        <Metric label={t("Média das rodadas")} value={data.summary.average_rating ?? "—"} detail={t("Querem continuar: {count}", { count: data.summary.continue_intents })} />
      </div>
    </section>

    <section className={styles.card}>
      <div className={styles.cardHeading}><div><h2>{t("Feedback da rodada")}</h2><p>{t("Exportador e importador avaliam a conversa de forma independente.")}</p></div></div>
      {!data.rounds.length ? <Empty>{t("Nenhuma rodada encerrada até o momento.")}</Empty> : <div className={styles.tableWrap}><table className={styles.table}>
        <thead><tr><th>{t("Data")}</th><th>{t("Empresa")}</th><th>{t("Importador")}</th><th>{t("Avaliação do exportador")}</th><th>{t("Avaliação do importador")}</th><th>{t("Quer continuar")}</th></tr></thead>
        <tbody>{data.rounds.map((round) => {
          const exporterFeedback = feedbackFor(round, round.exporter.id);
          const importerFeedback = feedbackFor(round, round.importer.id);
          return <tr key={round.id}>
            <td>{formatDateValue(locale, round.ended_at ?? round.starts_at, { dateStyle: "short", timeStyle: "short" })}</td>
            <td>{round.exporter.company || round.exporter.name}</td>
            <td>{round.importer.name}</td>
            <td><FeedbackCell feedback={exporterFeedback} /></td>
            <td><FeedbackCell feedback={importerFeedback} /></td>
            <td>
              <span className={styles.badge}>{exporterFeedback?.wants_continue ? t("Exportador") : "—"} / {importerFeedback?.wants_continue ? t("Importador") : "—"}</span>
            </td>
          </tr>;
        })}</tbody>
      </table></div>}
    </section>

    <section className={styles.card}>
      <div className={styles.cardHeading}><div><h2>{t("Feedback do evento")}</h2><p>{t("Respostas do evento: {count} · Média: {average}", { count: data.event_feedback.responses, average: data.event_feedback.average_rating ?? "—" })}</p></div></div>
      {!data.event_feedback.items.length ? <Empty>{t("Nenhum feedback do evento recebido até o momento.")}</Empty> : <div className={styles.stack}>{data.event_feedback.items.map((item) => <article key={item.id} className={styles.card}><div className={styles.cardHeading}><div><h2>{item.participant_name}</h2><p>{item.participant_company || t("Participante")}</p></div><span className={styles.badge}><Star size={13} fill="currentColor" /> {item.rating}</span></div>{item.comment ? <p>{item.comment}</p> : <p>{t("Nenhum comentário.")}</p>}</article>)}</div>}
    </section>
  </div>;
}

function FeedbackCell({ feedback }: { feedback: RoundFeedback | null }) {
  const { t } = useI18n();
  if (!feedback) return <span className={styles.badge}>{t("Aguardando avaliação")}</span>;
  return <span className={styles.badge}><Star size={13} fill="currentColor" /> {feedback.rating}{feedback.wants_continue ? ` · ${t("Quer continuar")}` : ""}</span>;
}
