"use client";

import { useState } from "react";
import type { Analytics, EventData } from "@/lib/api-types";
import { dateTime, duration, Empty, Metric } from "./shared";
import styles from "./dashboard.module.css";

type Activity = NonNullable<Analytics["daily_activity"]>[number];
const palette = ["#396bd8", "#2e9c75", "#f0b74a", "#a99bd5"];

function ActivityChart({ activity, networking = false }: { activity: Activity[]; networking?: boolean }) {
  if (!activity.length) return <Empty>O gráfico aparece assim que houver atividade registrada nos últimos 30 dias.</Empty>;
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
  return <><svg className={styles.chart} viewBox="0 0 640 210" role="img" aria-label={`Atividade diária nos últimos 30 dias: ${fields.map((field) => labels[field]).join(", ")}`}>
    {[0, .5, 1].map((ratio) => <g key={ratio}><line x1="40" x2="610" y1={y(max * ratio)} y2={y(max * ratio)} stroke="#e6edf6" strokeDasharray="4 4" /><text x="28" y={y(max * ratio) + 4} textAnchor="end" fontSize="10" fill="#8a9bb3">{Math.round(max * ratio)}</text></g>)}
    {fields.map((field, lineIndex) => <g key={field}><polyline points={points.map((item, index) => `${x(index)},${y(item[field])}`).join(" ")} fill="none" stroke={palette[lineIndex]} strokeWidth="3" strokeLinejoin="round" />{points.map((item, index) => <circle key={item.date} cx={x(index)} cy={y(item[field])} r="4" fill={palette[lineIndex]}><title>{item.date}: {item[field]} {labels[field]}</title></circle>)}</g>)}
  </svg><div className={styles.chartLabels}><span>{start.toLocaleDateString("pt-BR", { timeZone: "UTC" })}</span><span>{end.toLocaleDateString("pt-BR", { timeZone: "UTC" })}</span></div><div className={styles.legend}>{fields.map((field, index) => <span key={field}><i style={{ background: palette[index] }} />{labels[field]}</span>)}</div></>;
}

function RegistrationChart({ statuses, total }: { statuses: Record<string, number>; total: number }) {
  const keys = ["confirmed", "pending", "cancelled", "blocked"];
  const labels = ["Confirmadas", "Pendentes", "Canceladas", "Bloqueadas"];
  let offset = 0;
  const stops = keys.map((key, index) => { const start = offset; offset += total ? (statuses[key] ?? 0) / total * 100 : 0; return `${palette[index]} ${start}% ${offset}%`; });
  return <div className={styles.donutLayout}><div className={styles.donut} style={{ background: total ? `conic-gradient(${stops.join(", ")})` : "#eaf0f8" }} role="img" aria-label={keys.map((key, index) => `${labels[index]}: ${statuses[key] ?? 0}`).join(", ")}><div><strong>{total}</strong><small>inscrições</small></div></div><div className={styles.donutLegend}>{keys.map((key, index) => <div key={key}><span><i style={{ background: palette[index] }} />{labels[index]}</span><strong>{statuses[key] ?? 0}</strong></div>)}</div></div>;
}

export function AnalyticsPanel({ event, data }: { event: EventData; data: Analytics | null }) {
  const [view, setView] = useState<"audience" | "networking">("audience");
  if (!data) return <Empty>Os resultados ainda não estão disponíveis.</Empty>;
  const networking = data.networking;
  const acceptedRate = networking?.invitations ? Math.round(networking.accepted / networking.invitations * 100) : 0;
  const statuses = data.registration_statuses ?? { confirmed: data.confirmed_registrations, pending: Math.max(0, data.registrations - data.confirmed_registrations) };
  const mainRooms = data.rooms.filter((room) => room.purpose !== "networking");
  return <div className={styles.stack}>
    <div className={styles.toolbar}><div className={styles.tabs}><button className={view === "audience" ? styles.selected : ""} onClick={() => setView("audience")}>Audiência e participação</button><button className={view === "networking" ? styles.selected : ""} onClick={() => setView("networking")}>Rodadas de negócios</button></div><small className={styles.hint}>{data.generated_at && `Atualizado em ${dateTime(data.generated_at, event.timezone)}`} · atualização a cada 30s</small></div>
    {view === "audience" ? <>
      <div className={styles.metrics}><Metric label="Inscrições realizadas" value={data.registrations} detail={`${data.confirmed_registrations} confirmadas`} /><Metric label="Pessoas com presença registrada" value={data.unique_viewers} detail="Usuários com conta, sem duplicar visitas" /><Metric label="Visitas às salas" value={data.total_visits} detail="Inclui retornos e visitas aos 1:1" /><Metric label="Permanência média por visita" value={duration(data.average_duration_seconds)} detail="Calculada sobre visitas já encerradas" /></div>
      <div className={styles.twoColumns}><section className={styles.card}><div className={styles.cardHeading}><div><h2>Atividade ao longo dos dias</h2><p>Últimos 30 dias · datas no fuso do evento.</p></div></div><ActivityChart activity={data.daily_activity ?? []} /></section><section className={styles.card}><div className={styles.cardHeading}><div><h2>Situação das inscrições</h2><p>Como está o acesso do seu público.</p></div></div><RegistrationChart statuses={statuses} total={data.registrations} /></section></div>
      <div className={styles.metrics}><Metric label="Mensagens no chat" value={data.chat_messages} /><Metric label="Perguntas do público" value={data.questions} detail={`${data.answered_questions ?? 0} respondidas`} /><Metric label="Enquetes criadas" value={data.polls ?? 0} detail={`${data.poll_voters ?? 0} pessoas votaram`} /><Metric label="Votos nas enquetes" value={data.poll_votes ?? 0} detail="Múltiplas escolhas contam como votos separados" /></div>
      <section className={styles.card}><div className={styles.cardHeading}><div><h2>Audiência do auditório</h2><p>Presença e interação nas salas públicas do evento.</p></div></div>{mainRooms.length ? <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Auditório</th><th>Pessoas</th><th>Visitas</th><th>Permanência média</th><th>Mensagens</th><th>Perguntas</th></tr></thead><tbody>{mainRooms.map((room) => <tr key={room.room_id}><td>{room.room_name}</td><td>{room.unique_viewers}</td><td>{room.visits}</td><td>{room.average_duration ? duration(Number(room.average_duration)) : "—"}</td><td>{room.chat_messages}</td><td>{room.questions}</td></tr>)}</tbody></table></div> : <Empty>Sem presença registrada no auditório.</Empty>}</section>
    </> : <>
      <div className={styles.metrics}><Metric label="Convites enviados" value={networking?.invitations ?? 0} /><Metric label="Convites aceitos" value={networking?.accepted ?? 0} detail={`${acceptedRate}% dos convites`} /><Metric label="Conversas realizadas" value={networking?.realized ?? 0} detail="Presença registrada dos dois participantes" /><Metric label="Participantes dos 1:1" value={networking?.participants ?? 0} detail="Pessoas únicas com entrada registrada" /></div>
      <div className={styles.twoColumns}><section className={styles.card}><div className={styles.cardHeading}><div><h2>Conexões ao longo dos dias</h2><p>Rodadas realizadas, por data de criação do convite.</p></div></div><ActivityChart activity={data.daily_activity ?? []} networking /></section><section className={styles.card}><div className={styles.cardHeading}><h2>Do convite à conversa</h2></div><div className={styles.pollResults}>{[{ label: "Convites enviados", value: networking?.invitations ?? 0 }, { label: "Aceitos", value: networking?.accepted ?? 0 }, { label: "Conversas realizadas", value: networking?.realized ?? 0 }, { label: "Conversas encerradas após participação", value: networking?.completed ?? 0 }].map((item, index) => <div key={item.label}><div className={styles.resultLabel}><span>{item.label}</span><strong>{item.value}</strong></div><div className={styles.resultBar}><span style={{ width: `${networking?.invitations ? item.value / networking.invitations * 100 : 0}%`, background: palette[index] }} /></div></div>)}</div></section></div>
      <section className={styles.card}><h2>Respostas aos convites</h2><div className={styles.metrics} style={{ marginTop: 18 }}><Metric label="Aguardando resposta" value={networking?.statuses.pending ?? 0} /><Metric label="Recusados" value={networking?.statuses.declined ?? 0} /><Metric label="Cancelados" value={networking?.statuses.cancelled ?? 0} /><Metric label="Aceitos ainda não encerrados" value={networking?.statuses.accepted ?? 0} /></div><p className={styles.hint}>Aceitar um convite não significa que a conversa ocorreu. Uma rodada realizada exige o registro de entrada das duas pessoas na sala privada.</p></section>
    </>}
    <p className={styles.hint}>{data.presence_scope || "A audiência contabiliza presenças registradas de usuários com conta."} O tempo de transmissão se refere à sessão mais recente do auditório principal.</p>
  </div>;
}
