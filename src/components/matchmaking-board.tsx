"use client";

import Link from "next/link";
import { useState } from "react";
import { Building2, Clock3, Search, Users, ArrowRight, Radio } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import type { EventData, MatchmakingRound } from "@/lib/api-types";
import { Dialog } from "./event-dashboard/shared";
import { useI18n } from "./i18n-provider";
import { roundClock, useMatchmaking } from "./use-matchmaking";
import styles from "./matchmaking.module.css";

export function MatchmakingBoard({ event }: { event: EventData }) {
  const { t } = useI18n();
  const { data, error, now, refresh } = useMatchmaking(event.id, false, true, t);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [ending, setEnding] = useState<MatchmakingRound | null>(null);
  const [page, setPage] = useState(0);
  async function operate(path: string, body: object) {
    setBusy(true); setFeedback("");
    try { await apiClient(path, { method: "POST", body: { event: event.id, ...body } }); await refresh(); return true; }
    catch (reason) { setFeedback(reason instanceof Error ? reason.message : t("Não foi possível concluir a ação.")); return false; }
    finally { setBusy(false); }
  }
  const waiting = data?.waiting ?? [];
  const rooms = (data?.rooms ?? []).filter(({ room }) => `${room.company_name} ${room.contact_name}`.toLowerCase().includes(search.toLowerCase()));
  const selectedImporter = waiting.find((person) => person.id === selected);
  const supportRooms = data?.rooms?.filter((item) => item.round?.support_requested_at) ?? [];
  const pages = Math.max(1, Math.ceil(rooms.length / 6));
  const safePage = Math.min(page, pages - 1);
  return <section className={styles.board} aria-label={t("Gestão das rodadas")}>
    <header className={styles.heading}><div><span className={styles.eyebrow}>{t("MATCHMAKING COORDENADO")}</span><h2>{t("Conexões sob seu comando")}</h2><p>{t("Selecione quem está esperando e direcione para uma empresa disponível. Cada conversa dura até 10 minutos.")}</p></div><div className={styles.actions}><span className={`${styles.badge} ${data?.open ? styles.online : ""}`}><Radio size={14} />{data?.open ? t("Rodadas abertas") : t("Rodadas fechadas")}</span><button className={styles.primary} disabled={busy || !data} onClick={() => void operate(`events/${event.id}/networking-state/`, { open: !data?.open })}>{data?.open ? t("Fechar rodadas") : t("Abrir rodadas")}</button></div></header>
    <div className={styles.metrics}><div><Users size={20} /><strong>{waiting.length}</strong><span>{t("na espera")}</span></div><div><Building2 size={20} /><strong>{data?.rooms?.length ?? 0}</strong><span>{t("empresas")}</span></div><div><Clock3 size={20} /><strong>{data?.rooms?.filter((item) => item.round).length ?? 0}</strong><span>{t("em reunião")}</span></div></div>
    {(error || feedback) && <p className={styles.error} role="alert">{feedback || error}</p>}
    <div aria-live="polite">{supportRooms.map(({ room, round }) => <p className={styles.error} key={room.id}>
      {t("Suporte solicitado · {company} · {importer}", { company: room.company_name ?? "", importer: round?.importer.name ?? "" })}{" "}
      <Link href={`/eventos/${event.slug}/networking/salas/${room.id}`}>{t("Entrar para prestar suporte")}</Link>
    </p>)}</div>
    <div className={styles.columns}><aside className={styles.queue}><h3>{t("Área de espera")} <span>{waiting.length}</span></h3><p>{t("Participantes online, disponíveis para conversar.")}</p><div className={styles.queueList}>{waiting.length ? waiting.map((person) => <button key={person.id} aria-pressed={selected === person.id} onClick={() => setSelected(person.id)}><span className={styles.avatar}>{person.name.slice(0, 2).toUpperCase()}</span><span><strong>{person.name}</strong><small>{person.company || t("Importador")}</small></span></button>) : <div className={styles.empty}>{t("Quem entrar no matchmaking aparecerá aqui.")}</div>}</div></aside>
      <div className={styles.roomArea}><label className={styles.search}><Search size={17} /><input aria-label={t("Buscar empresa ou exportador")} placeholder={t("Buscar empresa ou exportador")} value={search} onChange={(change) => { setSearch(change.target.value); setPage(0); }} /></label><div className={styles.rooms}>{rooms.slice(safePage * 6, safePage * 6 + 6).map(({ room, exporter, online, round, exporter_connected, importer_connected }) => <article className={styles.roomCard} key={room.id}>
        <div className={styles.cardTop}><Building2 size={23} /><span className={`${styles.badge} ${online ? styles.online : ""}`}>{round ? t("Em reunião") : online ? t("Disponível") : t("Exportador offline")}</span></div><h3>{room.company_name}</h3><p>{exporter?.name || room.contact_name} · {exporter_connected ? t("Na sala") : online ? t("Preparando entrada") : t("Offline")}</p>
        {round ? <><div className={styles.round}><Users size={17} /><span>{round.importer.name}<small>{round.importer.company} · {importer_connected ? t("Na sala") : t("Aguardando entrada")}</small></span><time aria-label={t("Tempo restante")}>{roundClock(round.expires_at, now)}</time></div><Link className={styles.primary} href={`/eventos/${event.slug}/networking/salas/${room.id}`}>{t("Entrar na reunião")}</Link><button className={styles.danger} disabled={busy} onClick={() => setEnding(round)}>{t("Encerrar e devolver à espera")}</button></> : <><p className={styles.hint}>{selectedImporter ? selectedImporter.visited_rooms?.includes(room.id) ? t("Já participou com esta empresa") : t("Ainda não participou com esta empresa") : t("Selecione um importador para ver o histórico.")}</p><button className={styles.primary} disabled={busy || !online || !data?.open || !selectedImporter || selectedImporter.visited_rooms?.includes(room.id)} onClick={() => void operate("matchmaking/assign/", { importer: selected, room: room.id }).then((ok) => { if (ok) setSelected(""); })}>{t("Direcionar participante")} <ArrowRight size={16} /></button></>}
      </article>)}</div>{!rooms.length && <p className={styles.empty}>{t("As salas são criadas automaticamente quando os exportadores se inscrevem.")}</p>}<nav className={styles.pagination} aria-label={t("Páginas de salas")}><button disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>{t("Anterior")}</button><span>{safePage + 1} / {pages}</span><button disabled={safePage === pages - 1} onClick={() => setPage(safePage + 1)}>{t("Próxima")}</button></nav></div>
    </div>
    {Boolean(data?.recent?.length) && <details className={styles.history}><summary>{t("Últimas reuniões encerradas")}</summary>{data?.recent?.map((item) => <p key={item.id}>{item.exporter.company} · {item.importer.name} <span>{item.end_reason === "timeout" ? t("10 minutos concluídos") : t("Encerrada")}</span></p>)}</details>}
    {ending && <Dialog title={t("Encerrar esta reunião?")} busy={busy} onClose={() => setEnding(null)}><p>{t("{name} voltará à área de espera. O exportador continua na sala da empresa, disponível para a próxima conversa.", { name: ending.importer.name })}</p>{feedback && <p role="alert">{feedback}</p>}<div className={styles.actions}><button onClick={() => setEnding(null)} disabled={busy}>{t("Continuar reunião")}</button><button className={styles.danger} disabled={busy} onClick={() => void operate("matchmaking/end/", { round: ending.id }).then((ok) => { if (ok) setEnding(null); })}>{t("Encerrar reunião")}</button></div></Dialog>}
  </section>;
}
