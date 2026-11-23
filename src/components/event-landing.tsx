"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, ChevronLeft, ChevronRight, Handshake, MapPin, Radio, ShieldCheck, UsersRound } from "lucide-react";
import type { EventData } from "@/lib/api-types";
import { formatDateValue } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";
import { HomeHeader } from "./home-header";
import { useEventEntry } from "./use-event-entry";
import { useI18n } from "./i18n-provider";
import styles from "./event-portal.module.css";

type Tab = "overview" | "program" | "speakers";
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
function date(locale: Locale, value: string, timezone: string) { return formatDateValue(locale, value, { timeZone: timezone, dateStyle: "long", timeStyle: "short" }); }

export function EventLanding({ event, hasGuestTicket = false, initialTab = "overview" }: { event: EventData; hasGuestTicket?: boolean; initialTab?: Tab }) {
  const { locale, t } = useI18n();
  const tabNames = { overview: t("Sobre o evento"), program: t("Programação"), speakers: t("Palestrantes") };
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
  const entryLabel = entry === "ready" ? t("Entrar no lobby") : t("Inscrever-se");
  const entryButton = (compact = false) => entry === "checking"
    ? <span className={styles.badge}>{t("Verificando sua inscrição…")}</span>
    : preview ? <span className={styles.badge}>{t("Prévia privada")}</span> : <Link className={styles.primary} href={entryHref}>{compact ? entryLabel : entry === "ready" ? t("Ir para o lobby do evento") : t("Confirmar minha participação")}<ArrowRight size={16} /></Link>;

  return <div className={styles.portal}><HomeHeader /><main className={styles.main}>
    <div className={styles.context}><div><small>{t("PÁGINA DO EVENTO")}</small><strong>{event.name}</strong></div><Link className={styles.back} href="/"><ArrowLeft size={15} /> {t("Página inicial")}</Link></div>
    <nav className={styles.navigation} aria-label={t("Conteúdo do evento")}><div className={styles.tabs} role="tablist">{(Object.keys(tabNames) as Tab[]).map((item) => <button key={item} type="button" role="tab" aria-selected={tab === item} aria-controls="event-content" className={tab === item ? styles.active : ""} onClick={() => { setTab(item); setPage(0); }}>{tabNames[item]}</button>)}</div>{entryButton(true)}</nav>
    <div className={styles.body} id="event-content" role="tabpanel" aria-label={tabNames[tab]}>
      {tab === "overview" ? <div className={styles.overview}>
        <section className={styles.hero}>{cover && <div className={styles.cover} style={{ backgroundImage: `url(${JSON.stringify(cover)})` }} />}<div><span className={styles.kicker}><Radio size={16} /> {preview ? t("Prévia do evento") : t("Encontro online · BR Events")}</span><h1>{subtitle}</h1><p>{event.description || t("Uma oportunidade para acompanhar ideias, conversar com especialistas e criar conexões.")}</p></div>
          <div className={styles.metadata}><div><CalendarDays size={21} /><span><small>{t("Quando acontece")}</small>{date(locale, event.starts_at, event.timezone)}<small>{t("Até {date}", { date: date(locale, event.ends_at, event.timezone) })}</small></span></div><div><MapPin size={21} /><span><small>{t("Onde participar")}</small>{String(event.public_config.location ?? t("Online, no BR Events"))}<small>{t("Horários em {timezone}", { timezone: event.timezone })}</small></span></div></div>
        </section>
        <aside className={styles.side}><section className={styles.card}><span className={`${styles.badge} ${entry === "ready" ? styles.open : ""}`}><ShieldCheck size={13} />{preview ? t("Acesso do organizador") : entry === "ready" ? t("Seu acesso está liberado") : t("Participe do evento")}</span><h2>{entry === "ready" ? t("Sua próxima parada é o lobby.") : t("Reserve seu lugar.")}</h2><p>{entry === "ready" ? t("Escolha entre acompanhar o auditório principal ou conversar em uma rodada de negócios, quando liberada pelo organizador.") : t("Após confirmar sua inscrição, você entra no lobby e escolhe como participar deste encontro.")}</p>{entryButton()}</section>
          <section className={styles.card}><h2>{t("O que você encontra aqui")}</h2><div className={styles.feature}><Radio size={20} /><div><strong>{t("Auditório principal")}</strong><small>{t("Palestras, apresentações e interações com o público.")}</small></div></div><div className={styles.feature}><CalendarDays size={20} /><div><strong>{sessions.length ? t("{count} momentos na programação", { count: sessions.length }) : t("Programação em preparação")}</strong><small>{t("Confira horários e temas na aba Programação.")}</small></div></div><div className={styles.feature}><Handshake size={20} /><div><strong>{t("Rodadas de negócios 1:1")}</strong><small>{t("O organizador define quando o espaço de networking fica aberto.")}</small></div></div></section>
        </aside>
      </div> : <section className={styles.card}><div className={styles.heading}><div><h1>{tab === "program" ? t("Programação do evento") : t("Conheça quem vai apresentar")}</h1><p>{tab === "program" ? t("Horários em {timezone} · {count} atividades", { timezone: event.timezone, count: sessions.length }) : t("{count} palestrantes neste encontro", { count: speakers.length })}</p></div>{pageCount > 1 && <div className={styles.pagination}><button type="button" aria-label={t("Página anterior")} disabled={safePage === 0} onClick={() => setPage(safePage - 1)}><ChevronLeft size={16} /></button><span>{safePage + 1} / {pageCount}</span><button type="button" aria-label={t("Próxima página")} disabled={safePage >= pageCount - 1} onClick={() => setPage(safePage + 1)}><ChevronRight size={16} /></button></div>}</div>
        {tab === "program" ? sessions.length ? <div className={styles.agenda}>{sessions.slice(safePage * pageSize, safePage * pageSize + pageSize).map((item) => <article key={item.id} className={styles.talk}><time dateTime={item.starts_at}>{formatDateValue(locale, item.starts_at, { timeZone: event.timezone, hour: "2-digit", minute: "2-digit" })}<small>{formatDateValue(locale, item.starts_at, { timeZone: event.timezone, day: "2-digit", month: "2-digit" })}</small></time><div><h3>{item.title}</h3><p>{item.speakers_detail?.map((speaker) => speaker.name).join(" · ") || t("Apresentadores a confirmar")}</p>{item.description && <p>{item.description}</p>}{item.track && <span className={styles.badge}>{item.track}</span>}</div></article>)}</div> : <div className={styles.empty}><CalendarDays size={32} /><h2>{t("A programação será divulgada em breve.")}</h2><p>{t("Seu acesso ao evento não depende de uma agenda publicada. Depois de se inscrever, você pode entrar no lobby.")}</p></div>
          : speakers.length ? <div className={styles.speakers}>{speakers.slice(safePage * pageSize, safePage * pageSize + pageSize).map((speaker) => <article key={speaker.id} className={styles.speaker}><div className={styles.portrait}>{speaker.avatar_url ? <Image src={speaker.avatar_url} alt={speaker.name} width={62} height={62} unoptimized /> : initials(speaker.name)}</div><h3>{speaker.name}</h3><p>{speaker.bio || t("Participante da programação deste evento.")}</p></article>)}</div> : <div className={styles.empty}><UsersRound size={32} /><h2>{t("Palestrantes em preparação.")}</h2><p>{t("Os nomes e as apresentações aparecerão aqui assim que forem cadastrados pelo organizador.")}</p></div>}
      </section>}
    </div>
    <footer className={styles.footer}><span>{t("BR Events · Eventos que aproximam pessoas")}</span><span>{t("Auditório, programação e conexões em um só lugar.")}</span></footer>
  </main></div>;
}
