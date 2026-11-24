"use client";

import { Star } from "lucide-react";
import { useState } from "react";

import { apiClient } from "@/lib/api-client";
import type { MatchmakingRound, RoundFeedback } from "@/lib/api-types";
import { useI18n } from "./i18n-provider";
import styles from "./round-feedback.module.css";

type Props = {
  eventId: string;
  round: MatchmakingRound;
  registrationId: string;
  existing?: RoundFeedback | null;
  onSaved?: (feedback: RoundFeedback) => void;
  onCancel?: () => void;
  compact?: boolean;
};

export function RoundFeedbackForm({ eventId, round, registrationId, existing = null, onSaved, onCancel, compact = false }: Props) {
  const { t, intlLocale } = useI18n();
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [wantsContinue, setWantsContinue] = useState(existing?.wants_continue ?? false);
  const [note, setNote] = useState(existing?.note ?? "");
  const [showNote, setShowNote] = useState(Boolean(existing?.note));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const myRole = round.importer.id === registrationId ? "importer" : "exporter";
  const counterpart = myRole === "importer" ? round.exporter : round.importer;
  const date = new Date(round.ended_at ?? round.starts_at);
  const dateLabel = Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat(intlLocale, { dateStyle: "short", timeStyle: "short" }).format(date);

  async function submit() {
    if (!rating) {
      setError(t("Escolha uma nota de 1 a 5."));
      return;
    }
    setSaving(true);
    setError("");
    try {
      const feedback = await apiClient<RoundFeedback>("matchmaking/feedback/", {
        method: "POST",
        body: {
          event: eventId,
          round: round.id,
          rating,
          wants_continue: wantsContinue,
          note: note.trim(),
        },
      });
      setSaved(true);
      onSaved?.(feedback);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("Não foi possível enviar sua avaliação."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={`${styles.card}${compact ? ` ${styles.compact}` : ""}`} aria-label={t("Avalie a conversa")}>
      <header className={styles.head}>
        <div>
          <span className={styles.eyebrow}>{t("Avaliação rápida")}</span>
          <h3>{t("Como foi sua conversa com {name}?", { name: counterpart.name })}</h3>
          <p>{counterpart.company || t("Participante")}{dateLabel ? ` · ${t("Rodada de {date}", { date: dateLabel })}` : ""}</p>
        </div>
        {saved && <span className={styles.saved}>{t("Feedback enviado. Obrigado!")}</span>}
      </header>

      <div>
        <span className={styles.eyebrow}>{t("Sua avaliação")}</span>
        <div className={styles.stars} role="group" aria-label={t("Sua avaliação")}>
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              className={styles.star}
              aria-label={`${t("Nota")} ${value}`}
              aria-pressed={rating >= value}
              disabled={saving}
              onClick={() => { setRating(value); setSaved(false); }}
            >
              <Star size={19} fill={rating >= value ? "currentColor" : "none"} aria-hidden="true" />
            </button>
          ))}
        </div>
      </div>

      <label className={styles.continue}>
        <input type="checkbox" checked={wantsContinue} disabled={saving} onChange={(event) => { setWantsContinue(event.target.checked); setSaved(false); }} />
        <span>
          {t("Quero continuar esta conversa")}
          <small>{t("A coordenação verá seu interesse e poderá retomar o contato. Isso não bloqueia a próxima rodada.")}</small>
        </span>
      </label>

      {showNote ? (
        <label className={styles.note}>
          <span className={styles.eyebrow}>{t("Comentário (opcional)")}</span>
          <textarea value={note} maxLength={1000} disabled={saving} onChange={(event) => { setNote(event.target.value); setSaved(false); }} placeholder={t("Conte em uma frase o que foi útil ou o que poderia melhorar.")} />
        </label>
      ) : (
        <button type="button" className={styles.noteToggle} onClick={() => setShowNote(true)}>{t("Comentário (opcional)")}</button>
      )}

      {error && <p className={styles.error} role="alert">{error}</p>}
      <div className={styles.actions}>
        {onCancel && <button type="button" className={styles.secondary} disabled={saving} onClick={onCancel}>{t("Responder depois")}</button>}
        <button type="button" className={styles.primary} disabled={saving} onClick={() => void submit()}>
          {saving ? t("Enviando…") : saved ? t("Salvar") : existing ? t("Editar avaliação") : t("Enviar avaliação")}
        </button>
      </div>
    </section>
  );
}
