"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, ChevronLeft, ChevronRight, Handshake, MapPin, Radio, ShieldCheck, UsersRound } from "lucide-react";
import type { EventData } from "@/lib/api-types";
import { HomeHeader } from "./home-header";
import { useEventEntry } from "./use-event-entry";
import styles from "./event-portal.module.css";

type Tab = "overview" | "program" | "speakers";
const tabNames = { overview: "Sobre o evento", program: "Programação", speakers: "Palestrantes" };
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
function date(value: string, timezone: string) { return new Date(value).toLocaleString("pt-BR", { timeZone: timezone, dateStyle: "long", timeStyle: "short" }); }

export function EventLanding({ event, hasGuestTicket = false, initialTab = "overview" }: { event: EventData; hasGuestTicket?: boolean; initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(6);
  useEffect(() => {
    const update = () => setPageSize(window.innerWidth <= 767 ? 2 : window.innerHeight < 800 ? 4 : 6);
    const frame = window.requestAnimationFrame(update);
    window.addEventListener("resize", update);
    return () => { window.cancelAnimationFrame(frame); window.removeEventListener("resize", update); };
  }, []);
  const entry = useEventEntry(event, hasGuestTicket);
  const sessions = (event.sessions ?? []).filter((item) => item.status === "published").sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const speakers = event.speakers ?? Array.from(new Map(sessions.flatMap((item) => item.speakers_detail ?? []).map((speaker) => [speaker.id, speaker])).values());
  const subtitle = typeof event.public_config.subtitle === "string" && event.public_config.subtitle.trim() ? event.public_config.subtitle : event.name;
  const preview = event.status !== "published";
  const count = tab === "program" ? sessions.length : speakers.length;
  const pageCount = Math.max(1, Math.ceil(count / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const cover = typeof event.public_config.cover_image_url === "string" ? event.public_config.cover_image_url : "";
  const entryHref = `/eventos/${event.slug}/${entry === "ready" ? "lobby" : "inscricao"}`;
  const entryLabel = entry === "ready" ? "Entrar no lobby" : "Inscrever-se";
  const entryButton = (compact = false) => entry === "checking"
    ? <span className={styles.badge}>Verificando sua inscrição…</span>
    : preview ? <span className={styles.badge}>Prévia privada</span> : <Link className={styles.primary} href={entryHref}>{compact ? entryLabel : entry === "ready" ? "Ir para o lobby do evento" : "Confirmar minha participação"}<ArrowRight size={16} /></Link>;

  return <div className={styles.portal}><HomeHeader /><main className={styles.main}>
    <div className={styles.context}><div><small>PÁGINA DO EVENTO</small><strong>{event.name}</strong></div><Link className={styles.back} href="/"><ArrowLeft size={15} /> Página inicial</Link></div>
    <nav className={styles.navigation} aria-label="Conteúdo do evento"><div className={styles.tabs} role="tablist">{(Object.keys(tabNames) as Tab[]).map((item) => <button key={item} type="button" role="tab" aria-selected={tab === item} aria-controls="event-content" className={tab === item ? styles.active : ""} onClick={() => { setTab(item); setPage(0); }}>{tabNames[item]}</button>)}</div>{entryButton(true)}</nav>
    <div className={styles.body} id="event-content" role="tabpanel" aria-label={tabNames[tab]}>
      {tab === "overview" ? <div className={styles.overview}>
        <section className={styles.hero}>{cover && <div className={styles.cover} style={{ backgroundImage: `url(${JSON.stringify(cover)})` }} />}<div><span className={styles.kicker}><Radio size={16} /> {preview ? "Prévia do evento" : "Encontro online · BR Events"}</span><h1>{subtitle}</h1><p>{event.description || "Uma oportunidade para acompanhar ideias, conversar com especialistas e criar conexões."}</p></div>
          <div className={styles.metadata}><div><CalendarDays size={21} /><span><small>Quando acontece</small>{date(event.starts_at, event.timezone)}<small>Até {date(event.ends_at, event.timezone)}</small></span></div><div><MapPin size={21} /><span><small>Onde participar</small>{String(event.public_config.location ?? "Online, no BR Events")}<small>Horários em {event.timezone}</small></span></div></div>
        </section>
        <aside className={styles.side}><section className={styles.card}><span className={`${styles.badge} ${entry === "ready" ? styles.open : ""}`}><ShieldCheck size={13} />{preview ? "Acesso do organizador" : entry === "ready" ? "Seu acesso está liberado" : "Participe do evento"}</span><h2>{entry === "ready" ? "Sua próxima parada é o lobby." : "Reserve seu lugar."}</h2><p>{entry === "ready" ? "Escolha entre acompanhar o auditório principal ou conversar em uma rodada de negócios, quando liberada pelo organizador." : "Após confirmar sua inscrição, você entra no lobby e escolhe como participar deste encontro."}</p>{entryButton()}</section>
          <section className={styles.card}><h2>O que você encontra aqui</h2><div className={styles.feature}><Radio size={20} /><div><strong>Auditório principal</strong><small>Palestras, apresentações e interações com o público.</small></div></div><div className={styles.feature}><CalendarDays size={20} /><div><strong>{sessions.length ? `${sessions.length} momentos na programação` : "Programação em preparação"}</strong><small>Confira horários e temas na aba Programação.</small></div></div><div className={styles.feature}><Handshake size={20} /><div><strong>Rodadas de negócios 1:1</strong><small>O organizador define quando o espaço de networking fica aberto.</small></div></div></section>
        </aside>
      </div> : <section className={styles.card}><div className={styles.heading}><div><h1>{tab === "program" ? "Programação do evento" : "Conheça quem vai apresentar"}</h1><p>{tab === "program" ? `Horários em ${event.timezone} · ${sessions.length} atividades` : `${speakers.length} palestrantes neste encontro`}</p></div>{pageCount > 1 && <div className={styles.pagination}><button type="button" aria-label="Página anterior" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}><ChevronLeft size={16} /></button><span>{safePage + 1} / {pageCount}</span><button type="button" aria-label="Próxima página" disabled={safePage >= pageCount - 1} onClick={() => setPage(safePage + 1)}><ChevronRight size={16} /></button></div>}</div>
        {tab === "program" ? sessions.length ? <div className={styles.agenda}>{sessions.slice(safePage * pageSize, safePage * pageSize + pageSize).map((item) => <article key={item.id} className={styles.talk}><time dateTime={item.starts_at}>{new Date(item.starts_at).toLocaleTimeString("pt-BR", { timeZone: event.timezone, hour: "2-digit", minute: "2-digit" })}<small>{new Date(item.starts_at).toLocaleDateString("pt-BR", { timeZone: event.timezone, day: "2-digit", month: "2-digit" })}</small></time><div><h3>{item.title}</h3><p>{item.speakers_detail?.map((speaker) => speaker.name).join(" · ") || "Apresentadores a confirmar"}</p>{item.description && <p>{item.description}</p>}{item.track && <span className={styles.badge}>{item.track}</span>}</div></article>)}</div> : <div className={styles.empty}><CalendarDays size={32} /><h2>A programação será divulgada em breve.</h2><p>Seu acesso ao evento não depende de uma agenda publicada. Depois de se inscrever, você pode entrar no lobby.</p></div>
          : speakers.length ? <div className={styles.speakers}>{speakers.slice(safePage * pageSize, safePage * pageSize + pageSize).map((speaker) => <article key={speaker.id} className={styles.speaker}><div className={styles.portrait}>{speaker.avatar_url ? <Image src={speaker.avatar_url} alt={speaker.name} width={62} height={62} unoptimized /> : initials(speaker.name)}</div><h3>{speaker.name}</h3><p>{speaker.bio || "Participante da programação deste evento."}</p></article>)}</div> : <div className={styles.empty}><UsersRound size={32} /><h2>Palestrantes em preparação.</h2><p>Os nomes e as apresentações aparecerão aqui assim que forem cadastrados pelo organizador.</p></div>}
      </section>}
    </div>
    <footer className={styles.footer}><span>BR Events · Eventos que aproximam pessoas</span><span>Auditório, programação e conexões em um só lugar.</span></footer>
  </main></div>;
}
