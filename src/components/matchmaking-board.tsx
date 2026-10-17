"use client";

import { useState } from "react";
import { Building2, Clock3, Search, Users, ArrowRight, Radio } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import type { EventData, MatchmakingRound } from "@/lib/api-types";
import { Dialog } from "./event-dashboard/shared";
import { roundClock, useMatchmaking } from "./use-matchmaking";
import styles from "./matchmaking.module.css";

export function MatchmakingBoard({ event }: { event: EventData }) {
  const { data, error, now, refresh } = useMatchmaking(event.id);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [ending, setEnding] = useState<MatchmakingRound | null>(null);
  const [page, setPage] = useState(0);
  async function operate(path: string, body: object) {
    setBusy(true); setFeedback("");
    try { await apiClient(path, { method: "POST", body: { event: event.id, ...body } }); await refresh(); return true; }
    catch (reason) { setFeedback(reason instanceof Error ? reason.message : "Não foi possível concluir a ação."); return false; }
    finally { setBusy(false); }
  }
  const waiting = data?.waiting ?? [];
  const rooms = (data?.rooms ?? []).filter(({ room }) => `${room.company_name} ${room.contact_name}`.toLowerCase().includes(search.toLowerCase()));
  const pages = Math.max(1, Math.ceil(rooms.length / 6));
  const safePage = Math.min(page, pages - 1);
  return <section className={styles.board} aria-label="Gestão das rodadas">
    <header className={styles.heading}><div><span className={styles.eyebrow}>MATCHMAKING COORDENADO</span><h2>Conexões sob seu comando</h2><p>Selecione quem está esperando e direcione para uma empresa disponível. Cada conversa dura até 10 minutos.</p></div><div className={styles.actions}><span className={`${styles.badge} ${data?.open ? styles.online : ""}`}><Radio size={14} />{data?.open ? "Rodadas abertas" : "Rodadas fechadas"}</span><button className={styles.primary} disabled={busy || !data} onClick={() => void operate(`events/${event.id}/networking-state/`, { open: !data?.open })}>{data?.open ? "Fechar rodadas" : "Abrir rodadas"}</button></div></header>
    <div className={styles.metrics}><div><Users size={20} /><strong>{waiting.length}</strong><span>na espera</span></div><div><Building2 size={20} /><strong>{data?.rooms?.length ?? 0}</strong><span>empresas</span></div><div><Clock3 size={20} /><strong>{data?.rooms?.filter((item) => item.round).length ?? 0}</strong><span>em reunião</span></div></div>
    {(error || feedback) && <p className={styles.error} role="alert">{feedback || error}</p>}
    <div className={styles.columns}><aside className={styles.queue}><h3>Área de espera <span>{waiting.length}</span></h3><p>Participantes online, disponíveis para conversar.</p><div className={styles.queueList}>{waiting.length ? waiting.map((person) => <button key={person.id} aria-pressed={selected === person.id} onClick={() => setSelected(person.id)}><span className={styles.avatar}>{person.name.slice(0, 2).toUpperCase()}</span><span><strong>{person.name}</strong><small>{person.company || "Importador"}</small></span></button>) : <div className={styles.empty}>Quem entrar no matchmaking aparecerá aqui.</div>}</div></aside>
      <div className={styles.roomArea}><label className={styles.search}><Search size={17} /><input aria-label="Buscar empresa ou exportador" placeholder="Buscar empresa ou exportador" value={search} onChange={(change) => { setSearch(change.target.value); setPage(0); }} /></label><div className={styles.rooms}>{rooms.slice(safePage * 6, safePage * 6 + 6).map(({ room, exporter, online, round, exporter_connected, importer_connected }) => <article className={styles.roomCard} key={room.id}>
        <div className={styles.cardTop}><Building2 size={23} /><span className={`${styles.badge} ${online ? styles.online : ""}`}>{round ? "Em reunião · 1:1" : online ? "Disponível" : "Exportador offline"}</span></div><h3>{room.company_name}</h3><p>{exporter?.name || room.contact_name} · {exporter_connected ? "Na sala" : online ? "Preparando entrada" : "Offline"}</p>
        {round ? <><div className={styles.round}><Users size={17} /><span>{round.importer.name}<small>{round.importer.company} · {importer_connected ? "Na sala" : "Aguardando entrada"}</small></span><time aria-label="Tempo restante">{roundClock(round.expires_at, now)}</time></div><button className={styles.danger} disabled={busy} onClick={() => setEnding(round)}>Encerrar e devolver à espera</button></> : <><p className={styles.hint}>Uma pessoa por vez. A coordenação acompanha sem entrar na chamada.</p><button className={styles.primary} disabled={busy || !online || !data?.open || !waiting.some((person) => person.id === selected)} onClick={() => void operate("matchmaking/assign/", { importer: selected, room: room.id }).then((ok) => { if (ok) setSelected(""); })}>Direcionar participante <ArrowRight size={16} /></button></>}
      </article>)}</div>{!rooms.length && <p className={styles.empty}>As salas são criadas automaticamente quando os exportadores se inscrevem.</p>}<nav className={styles.pagination} aria-label="Páginas de salas"><button disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>Anterior</button><span>{safePage + 1} / {pages}</span><button disabled={safePage === pages - 1} onClick={() => setPage(safePage + 1)}>Próxima</button></nav></div>
    </div>
    {Boolean(data?.recent?.length) && <details className={styles.history}><summary>Últimas reuniões encerradas</summary>{data?.recent?.map((item) => <p key={item.id}>{item.exporter.company} · {item.importer.name} <span>{item.end_reason === "timeout" ? "10 minutos concluídos" : "Encerrada"}</span></p>)}</details>}
    {ending && <Dialog title="Encerrar esta reunião?" busy={busy} onClose={() => setEnding(null)}><p>{ending.importer.name} voltará à área de espera. O exportador continua na sala da empresa, disponível para a próxima conversa.</p>{feedback && <p role="alert">{feedback}</p>}<div className={styles.actions}><button onClick={() => setEnding(null)} disabled={busy}>Continuar reunião</button><button className={styles.danger} disabled={busy} onClick={() => void operate("matchmaking/end/", { round: ending.id }).then((ok) => { if (ok) setEnding(null); })}>Encerrar reunião</button></div></Dialog>}
  </section>;
}
