"use client";

import { useState } from "react";
import type { Analytics, EventData } from "@/lib/api-types";
import { formatDateValue } from "@/lib/i18n";
import { useI18n } from "../i18n-provider";
import { dateTime, duration, Empty, Metric } from "./shared";
import styles from "./dashboard.module.css";

type Activity = NonNullable<Analytics["daily_activity"]>[number];
const palette = ["#396bd8", "#2e9c75", "#f0b74a", "#a99bd5"];

function ActivityChart({ activity, networking = false }: { activity: Activity[]; networking?: boolean }) {
  const { t, locale } = useI18n();
  if (!activity.length) return <Empty>{t("O gráfico aparece assim que houver atividade registrada nos últimos 30 dias.")}</Empty>;
  const fields = networking ? ["networking"] as const : ["registrations", "visits", "messages"] as const;
  const labels = { registrations: "Inscrições", visits: "Visitas", messages: "Mensagens", networking: "Rodadas realizadas" };
  const totals = new Map(activity.map((item) => [item.date, item]));
  const start = new Date(`${activity[0].date}T12:00:00Z`);
  const end = new Date(`${activity[activity.length - 1].date}T12:00:00Z`);
  const points: Activity[] = [];
  for (const day = new Date(start); day <= end; day.setUTCDate(day.getUTCDate() + 1)) {
    const date = day.toISOString().slice(0, 10);
    points.push(totals.get(date) ?? { date, registrations: 0, visits: 0, messages: 0, networking: 0 });
  }
  const max = Math.max(1, ...points.flatMap((item) => fields.map((field) => item[field])));
  const x = (index: number) => points.length === 1 ? 330 : 40 + index / (points.length - 1) * 570;
  const y = (value: number) => 180 - value / max * 145;
  return <><svg className={styles.chart} viewBox="0 0 640 210" role="img" aria-label={t("Atividade diária nos últimos 30 dias: {labels}", { labels: fields.map((field) => t(labels[field])).join(", ") })}>
    {[0, .5, 1].map((ratio) => <g key={ratio}><line x1="40" x2="610" y1={y(max * ratio)} y2={y(max * ratio)} stroke="#e6edf6" strokeDasharray="4 4" /><text x="28" y={y(max * ratio) + 4} textAnchor="end" fontSize="10" fill="#8a9bb3">{Math.round(max * ratio)}</text></g>)}
    {fields.map((field, lineIndex) => <g key={field}><polyline points={points.map((item, index) => `${x(index)},${y(item[field])}`).join(" ")} fill="none" stroke={palette[lineIndex]} strokeWidth="3" strokeLinejoin="round" />{points.map((item, index) => <circle key={item.date} cx={x(index)} cy={y(item[field])} r="4" fill={palette[lineIndex]}><title>{item.date}: {item[field]} {t(labels[field])}</title></circle>)}</g>)}
  </svg><div className={styles.chartLabels}><span>{formatDateValue(locale, `${activity[0].date}T12:00:00Z`, { timeZone: "UTC" })}</span><span>{formatDateValue(locale, `${activity[activity.length - 1].date}T12:00:00Z`, { timeZone: "UTC" })}</span></div><div className={styles.legend}>{fields.map((field, index) => <span key={field}><i style={{ background: palette[index] }} />{t(labels[field])}</span>)}</div></>;
}

function RegistrationChart({ statuses, total }: { statuses: Record<string, number>; total: number }) {
  const { t } = useI18n();
  const keys = ["confirmed", "pending", "cancelled", "blocked"];
  const labels = ["Confirmadas", "Pendentes", "Canceladas", "Bloqueadas"];
  let offset = 0;
  const stops = keys.map((key, index) => { const start = offset; offset += total ? (statuses[key] ?? 0) / total * 100 : 0; return `${palette[index]} ${start}% ${offset}%`; });
  return <div className={styles.donutLayout}><div className={styles.donut} style={{ background: total ? `conic-gradient(${stops.join(", ")})` : "#eaf0f8" }} role="img" aria-label={keys.map((key, index) => t("{label}: {count}", { label: t(labels[index]), count: statuses[key] ?? 0 })).join(", ")}><div><strong>{total}</strong><small>{t("inscrições")}</small></div></div><div className={styles.donutLegend}>{keys.map((key, index) => <div key={key}><span><i style={{ background: palette[index] }} />{t(labels[index])}</span><strong>{statuses[key] ?? 0}</strong></div>)}</div></div>;
}

export function AnalyticsPanel({ event, data }: { event: EventData; data: Analytics | null }) {
  const { t, locale } = useI18n();
  const [view, setView] = useState<"audience" | "networking">("audience");
  if (!data) return <Empty>{t("Os resultados ainda não estão disponíveis.")}</Empty>;
  const networking = data.networking;
  const acceptedRate = networking?.invitations ? Math.round(networking.accepted / networking.invitations * 100) : 0;
  const statuses = data.registration_statuses ?? { confirmed: data.confirmed_registrations, pending: Math.max(0, data.registrations - data.confirmed_registrations) };
  const mainRooms = data.rooms.filter((room) => room.purpose !== "networking");
  return <div className={styles.stack}>
    <div className={styles.toolbar}><div className={styles.tabs}><button className={view === "audience" ? styles.selected : ""} onClick={() => setView("audience")}>{t("Audiência e participação")}</button><button className={view === "networking" ? styles.selected : ""} onClick={() => setView("networking")}>{t("Rodadas de negócios")}</button></div><small className={styles.hint}>{data.generated_at && t("Atualizado em {date}", { date: dateTime(data.generated_at, event.timezone, locale) })} · {t("atualização a cada 30s")}</small></div>
    {view === "audience" ? <>
      <div className={styles.metrics}><Metric label={t("Inscrições realizadas")} value={data.registrations} detail={t("{count} confirmadas", { count: data.confirmed_registrations })} /><Metric label={t("Pessoas com presença registrada")} value={data.unique_viewers} detail={t("Usuários com conta, sem duplicar visitas")} /><Metric label={t("Visitas às salas")} value={data.total_visits} detail={t("Inclui retornos e visitas aos 1:1")} /><Metric label={t("Permanência média por visita")} value={duration(data.average_duration_seconds)} detail={t("Calculada sobre visitas já encerradas")} /></div>
      <div className={styles.twoColumns}><section className={styles.card}><div className={styles.cardHeading}><div><h2>{t("Atividade ao longo dos dias")}</h2><p>{t("Últimos 30 dias · datas no fuso do evento.")}</p></div></div><ActivityChart activity={data.daily_activity ?? []} /></section><section className={styles.card}><div className={styles.cardHeading}><div><h2>{t("Situação das inscrições")}</h2><p>{t("Como está o acesso do seu público.")}</p></div></div><RegistrationChart statuses={statuses} total={data.registrations} /></section></div>
      <div className={styles.metrics}><Metric label={t("Mensagens no chat")} value={data.chat_messages} /><Metric label={t("Perguntas do público")} value={data.questions} detail={t("{count} respondidas", { count: data.answered_questions ?? 0 })} /><Metric label={t("Enquetes criadas")} value={data.polls ?? 0} detail={t("{count} pessoas votaram", { count: data.poll_voters ?? 0 })} /><Metric label={t("Votos nas enquetes")} value={data.poll_votes ?? 0} detail={t("Múltiplas escolhas contam como votos separados")} /></div>
      <section className={styles.card}><div className={styles.cardHeading}><div><h2>{t("Audiência do auditório")}</h2><p>{t("Presença e interação nas salas públicas do evento.")}</p></div></div>{mainRooms.length ? <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>{t("Auditório")}</th><th>{t("Pessoas")}</th><th>{t("Visitas")}</th><th>{t("Permanência média")}</th><th>{t("Mensagens")}</th><th>{t("Perguntas")}</th></tr></thead><tbody>{mainRooms.map((room) => <tr key={room.room_id}><td>{room.room_name}</td><td>{room.unique_viewers}</td><td>{room.visits}</td><td>{room.average_duration ? duration(Number(room.average_duration)) : "—"}</td><td>{room.chat_messages}</td><td>{room.questions}</td></tr>)}</tbody></table></div> : <Empty>{t("Sem presença registrada no auditório.")}</Empty>}</section>
    </> : <>
      <div className={styles.metrics}><Metric label={t("Convites enviados")} value={networking?.invitations ?? 0} /><Metric label={t("Convites aceitos")} value={networking?.accepted ?? 0} detail={t("{percent}% dos convites", { percent: acceptedRate })} /><Metric label={t("Conversas realizadas")} value={networking?.realized ?? 0} detail={t("Presença registrada dos dois participantes")} /><Metric label={t("Participantes dos 1:1")} value={networking?.participants ?? 0} detail={t("Pessoas únicas com entrada registrada")} /></div>
      <div className={styles.twoColumns}><section className={styles.card}><div className={styles.cardHeading}><div><h2>{t("Conexões ao longo dos dias")}</h2><p>{t("Rodadas realizadas, por data de criação do convite.")}</p></div></div><ActivityChart activity={data.daily_activity ?? []} networking /></section><section className={styles.card}><div className={styles.cardHeading}><h2>{t("Do convite à conversa")}</h2></div><div className={styles.pollResults}>{[{ label: t("Convites enviados"), value: networking?.invitations ?? 0 }, { label: t("Aceitos"), value: networking?.accepted ?? 0 }, { label: t("Conversas realizadas"), value: networking?.realized ?? 0 }, { label: t("Conversas encerradas após participação"), value: networking?.completed ?? 0 }].map((item, index) => <div key={item.label}><div className={styles.resultLabel}><span>{item.label}</span><strong>{item.value}</strong></div><div className={styles.resultBar}><span style={{ width: `${networking?.invitations ? item.value / networking.invitations * 100 : 0}%`, background: palette[index] }} /></div></div>)}</div></section></div>
      <section className={styles.card}><h2>{t("Respostas aos convites")}</h2><div className={styles.metrics} style={{ marginTop: 18 }}><Metric label={t("Aguardando resposta")} value={networking?.statuses.pending ?? 0} /><Metric label={t("Recusados")} value={networking?.statuses.declined ?? 0} /><Metric label={t("Cancelados")} value={networking?.statuses.cancelled ?? 0} /><Metric label={t("Aceitos ainda não encerrados")} value={networking?.statuses.accepted ?? 0} /></div><p className={styles.hint}>{t("Aceitar um convite não significa que a conversa ocorreu. Uma rodada realizada exige o registro de entrada das duas pessoas na sala privada.")}</p></section>
    </>}
    <p className={styles.hint}>{data.presence_scope || t("A audiência contabiliza presenças registradas de usuários com conta.")} {t("O tempo de transmissão se refere à sessão mais recente do auditório principal.")}</p>
  </div>;
}
