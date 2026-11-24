"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Building2, Clock3, Handshake, LoaderCircle, ShieldCheck } from "lucide-react";
import type { EventData } from "@/lib/api-types";
import { HomeHeader } from "./home-header";
import { useI18n } from "./i18n-provider";
import { useSession } from "./session-provider";
import { RoundFeedbackForm } from "./round-feedback-form";
import { useMatchmaking } from "./use-matchmaking";
import { MatchmakingBoard } from "./matchmaking-board";
import styles from "./matchmaking.module.css";

export function MatchmakingLobby({ event }: { event: EventData }) {
  const { user } = useSession();
  const { t } = useI18n();
  const router = useRouter();
  const { data, error, refresh } = useMatchmaking(event.id, Boolean(user), false, t);
  const [dismissedFeedback, setDismissedFeedback] = useState<string | null>(null);
  useEffect(() => {
    if (!data || data.role === "coordinator") return;
    if ((data.role === "exporter" || data.round) && data.own_room_available !== false && data.room && (data.open || data.round)) router.replace(`/eventos/${event.slug}/networking/salas/${data.room.id}`);
  }, [data, event.slug, router]);
  const pendingFeedback = data?.pending_feedback?.find((item) => item.id !== dismissedFeedback);
  return <div className={styles.page}><HomeHeader /><main className={styles.main}><div className={styles.topline}><span>{event.name} · {t("Matchmaking")}</span><span className={styles.toplineLinks}><Link href={`/eventos/${event.slug}/pos-evento`}>{t("Pós-evento")}</Link><Link href={`/eventos/${event.slug}/lobby`}>{t("Voltar ao lobby")}</Link></span></div>
    {pendingFeedback && data?.registration && <div className={styles.feedbackPrompt}><RoundFeedbackForm compact eventId={event.id} round={pendingFeedback} registrationId={data.registration.id} onSaved={() => { setDismissedFeedback(pendingFeedback.id); void refresh(); }} onCancel={() => setDismissedFeedback(pendingFeedback.id)} /></div>}
    {data?.role === "coordinator" ? <MatchmakingBoard event={event} /> : <section className={styles.waiting}>
      <span className={styles.waitingIcon}>{data?.role === "exporter" ? <Building2 size={38} /> : <Handshake size={38} />}</span><span className={styles.eyebrow}>{data?.role === "exporter" ? t("SUA EMPRESA NO EVENTO") : t("ÁREA DE ESPERA")}</span>
      <h1>{!user ? t("Entre para participar das rodadas") : !data ? t("Preparando suas conexões…") : !data.open ? t("As rodadas ainda estão fechadas") : data.role === "exporter" ? t("Abrindo sua sala…") : t("Tudo pronto, {name}?", { name: data.registration?.name.split(" ")[0] || t("vamos conversar") })}</h1>
      <p>{!user ? t("Use a conta associada à sua inscrição para encontrar empresas e conversar.") : !data?.open ? t("Você será direcionado quando o organizador abrir as rodadas. Pode aguardar aqui.") : t("A coordenação está organizando suas próximas conversas. Quando uma empresa for selecionada, a sala abrirá automaticamente para você.")}</p>
      <div className={styles.steps}><div><ShieldCheck size={23} /><strong>{t("Direcionamento pela coordenação")}</strong><small>{t("Você não precisa escolher ou procurar uma sala.")}</small></div><div><Clock3 size={23} /><strong>{t("Até 10 minutos por conversa")}</strong><small>{t("Ao finalizar, você volta para cá e aguarda a próxima conexão.")}</small></div></div>
      {error && <p className={styles.error} role="alert">{error}</p>}{!data && user && !error && <LoaderCircle className="spin" aria-label={t("Carregando")} />}
      {data?.role === "importer" && Boolean(data.companies?.length) && <section aria-label={t("Empresas da rodada")}>
        <h2>{t("Empresas da rodada")}</h2>
        <ul>{data.companies?.map((company) => <li key={company.id}>{company.name} · {company.visited ? t("Já participou") : t("Ainda não participou")}</li>)}</ul>
      </section>}
      {!user && <Link className={styles.primary} href={`/entrar?next=${encodeURIComponent(`/eventos/${event.slug}/networking`)}`}>{t("Entrar na minha conta")}</Link>}
      {data?.open && <span className={styles.badge}><span className={styles.pulse} /> {t("Aguardando direcionamento · atualização automática")}</span>}
    </section>}
  </main></div>;
}
