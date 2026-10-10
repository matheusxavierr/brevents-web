"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, CheckCircle, Handshake, LockKeyhole, Radio, UserRound, UsersRound } from "lucide-react";
import { ApiError, apiClient } from "@/lib/api-client";
import type { EventData } from "@/lib/api-types";
import { HomeHeader } from "./home-header";
import { useSession } from "./session-provider";
import { useEventEntry } from "./use-event-entry";
import styles from "./event-portal.module.css";

export function EventLobby({ event, hasGuestTicket = false }: { event: EventData; hasGuestTicket?: boolean }) {
  const entry = useEventEntry(event, hasGuestTicket);
  const { user } = useSession();
  const [networkingOpen, setNetworkingOpen] = useState(event.feature_flags.networking_open === true);
  const [available, setAvailable] = useState(event.status === "published");
  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      try {
        const current = await apiClient<EventData>(`public/events/${encodeURIComponent(event.slug)}/`);
        if (!cancelled) { setNetworkingOpen(current.feature_flags.networking_open === true); setAvailable(current.status === "published"); }
      } catch (reason) { if (!cancelled) { setNetworkingOpen(false); if (reason instanceof ApiError && (reason.status === 404 || reason.status === 410)) setAvailable(false); } }
    }
    void refresh(); const timer = window.setInterval(() => void refresh(), 5000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [event.slug]);
  const ready = entry === "ready" && available;
  return <div className={styles.portal}><HomeHeader /><main className={styles.main}>
    <div className={styles.context}><div><small>LOBBY DO EVENTO</small><strong>{event.name}</strong></div><Link className={styles.back} href={`/eventos/${event.slug}`}><ArrowLeft size={15} /> Página do evento</Link></div>
    <div className={`${styles.body} ${styles.lobbyBody}`} role="region" aria-label="Destinos do lobby"><div className={styles.lobbyContent}>
      <section className={styles.lobbyIntro}><div><span className={styles.kicker}>BEM-VINDO AO ENCONTRO</span><h1>{user?.first_name ? `Olá, ${user.first_name}. Para onde vamos?` : "Escolha como participar."}</h1><p>Acompanhe as apresentações no auditório ou encontre outras pessoas para uma conversa de negócios em particular.</p></div><Handshake size={48} /></section>
      {entry === "register" && <div className={styles.note}><LockKeyhole size={22} /><div><strong>Confirme sua inscrição para participar.</strong>Depois de se inscrever, você retorna para este lobby e escolhe seu destino.</div><Link className={styles.primary} href={`/eventos/${event.slug}/inscricao`}>Fazer inscrição <ArrowRight size={15} /></Link></div>}
      {entry === "checking" && <div className={styles.note}>Verificando sua inscrição…</div>}
      {ready && <div className={`${styles.note} ${styles.accessNote}`}><CheckCircle size={20} /><div><strong>Seu acesso ao evento está liberado.</strong>Você pode voltar a este lobby sempre que quiser mudar de ambiente.</div></div>}
      {!available && <div className={styles.note}>O evento ainda não está disponível para acesso do público.</div>}
      <section className={styles.destinations} aria-label="Ambientes do evento">
        <article className={styles.destination}><header><span className={styles.kicker}>PROGRAMAÇÃO OFICIAL</span><span className={styles.badge}><Radio size={12} /> Auditório</span></header><div className={styles.visual} aria-hidden="true"><div><Radio size={36} /></div><div><UsersRound size={36} /></div></div><h2>Auditório principal</h2><p>Assista às palestras e apresentações. Participe pelo chat, pelas perguntas e pelas enquetes do evento.</p>{ready ? <Link className={styles.primary} href={`/eventos/${event.slug}/ao-vivo`}>Entrar no auditório <ArrowRight size={16} /></Link> : <button className={styles.secondary} disabled>Confirme sua inscrição para entrar</button>}</article>
        <article className={styles.destination}><header><span className={styles.kicker}>CONEXÕES EM PARTICULAR</span><span className={`${styles.badge} ${networkingOpen ? styles.open : ""}`}>{networkingOpen ? "Aberta pelo organizador" : "Fechada pelo organizador"}</span></header><div className={`${styles.visual} ${styles.networkVisual} ${networkingOpen ? "" : styles.closedVisual}`} aria-hidden="true"><div><UserRound size={32} /></div><Handshake size={28} /><div><UserRound size={32} /></div></div><h2>Rodadas de negócios</h2><p>{networkingOpen ? "Encontre pessoas disponíveis, envie um convite e converse em uma sala privada 1:1." : "O organizador libera este espaço durante o evento. Você verá o acesso disponível aqui assim que ele abrir as rodadas."}</p>{!networkingOpen ? <button className={styles.secondary} disabled><LockKeyhole size={16} /> Aguardando abertura</button> : ready ? <Link className={styles.primary} href={user ? `/eventos/${event.slug}/networking` : `/entrar?next=${encodeURIComponent(`/eventos/${event.slug}/networking`)}`}>{user ? "Encontrar pessoas" : "Entrar na conta para conversar"} <ArrowRight size={16} /></Link> : <button className={styles.secondary} disabled>Confirme sua inscrição para entrar</button>}</article>
      </section>
      <div className={styles.note}><CalendarDays size={20} /><div><strong>Quer conferir os horários e palestrantes?</strong>A programação está na página do evento, e você pode consultá-la sem sair da plataforma.</div><Link className={styles.secondary} href={`/eventos/${event.slug}/agenda`}>Ver programação</Link></div>
    </div></div>
    <footer className={styles.footer}><span>BR Events · Lobby do evento</span><span>Disponibilidade das rodadas atualizada automaticamente.</span></footer>
  </main></div>;
}
