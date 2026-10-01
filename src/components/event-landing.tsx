import Link from "next/link";
import { ArrowRight, CalendarDays, MapPin, Play, Users } from "lucide-react";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";
import type { EventData } from "@/lib/api-types";

function eventDate(event: EventData) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit", timeZone: event.timezone }).format(new Date(event.starts_at));
}

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((part) => part[0]).join("");
}

export function EventLanding({ event }: { event: EventData }) {
  const sessions = event.sessions ?? [];
  const speakers = Array.from(new Map(sessions.flatMap((session) => session.speakers_detail ?? []).map((speaker) => [speaker.id, speaker])).values());
  const featured = sessions[0];
  const subtitle = typeof event.public_config.subtitle === "string" ? event.public_config.subtitle : "Ideias ao vivo. Conexões reais.";
  const isPreview = Boolean(event.status && event.status !== "published");
  return (
    <>
      <a className="skip-link" href="#conteudo">Pular para o conteúdo</a>
      <SiteHeader current="inicio" eventSlug={event.slug} />
      <main id="conteudo">
        {isPreview && <div className="preview-banner" role="status"><strong>Prévia privada</strong><span>Este evento ainda não foi publicado. Somente gestores autenticados conseguem visualizar esta página.</span></div>}
        <section className="hero">
          <div className="container hero-grid">
            <div className="hero-copy">
              <p className="eyebrow">{event.name}</p>
              <h1 className="display">{subtitle}</h1>
              <p>{event.description}</p>
              <div className="hero-actions">
                <Link className="button button-primary" href={`/eventos/${event.slug}/inscricao`}>Inscreva-se <ArrowRight size={17} /></Link>
                <Link className="button button-secondary" href={`/eventos/${event.slug}/agenda`}>Ver programação</Link>
              </div>
              <div className="event-meta" aria-label="Informações do evento">
                <span><CalendarDays size={16} /> {eventDate(event)}</span>
                <span><MapPin size={16} /> {String(event.public_config.location ?? "Online")} · {event.timezone}</span>
              </div>
            </div>
            <div className="stage-preview" aria-label="Sessão em destaque">
              <div className="stage-grid" /><div className="stage-orbit" />
              <div className="stage-content">
                <span className="live-pill"><span className="live-dot" /> {isPreview ? "Prévia do evento" : "Evento publicado"}</span>
                <div className="stage-title"><p>{event.rooms?.[0]?.name ?? "Palco principal"}</p><h2>{featured?.title ?? event.name}</h2></div>
                <div className="stage-footer">
                  <div className="speaker-stack" aria-label="Palestrantes">{(featured?.speakers_detail ?? []).slice(0, 3).map((speaker) => <span className="avatar" key={speaker.id}>{initials(speaker.name)}</span>)}</div>
                  <Link className="icon-button" href={`/eventos/${event.slug}/ao-vivo`} aria-label="Entrar na sala"><Play size={18} fill="currentColor" /></Link>
                </div>
              </div>
            </div>
          </div>
        </section>
        <section className="metrics-strip" aria-label="Números do evento"><div className="container metrics-grid">
          <div className="metric"><strong>{sessions.length}</strong><span>sessões publicadas</span></div>
          <div className="metric"><strong>{speakers.length}</strong><span>especialistas convidados</span></div>
          <div className="metric"><strong>{new Set(sessions.map((item) => item.track).filter(Boolean)).size}</strong><span>trilhas de conteúdo</span></div>
          <div className="metric"><strong>{event.rooms?.length ?? 0}</strong><span>salas disponíveis</span></div>
        </div></section>
        <section className="section"><div className="container">
          <div className="section-heading"><div><p className="eyebrow">Programação</p><h2 className="section-title">Próximas sessões</h2></div><Link className="button button-quiet" href={`/eventos/${event.slug}/agenda`}>Agenda completa <ArrowRight size={16} /></Link></div>
          <div className="schedule-list">{sessions.slice(0, 4).map((session) => <article className="schedule-item" key={session.id}><time className="schedule-time">{new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: event.timezone }).format(new Date(session.starts_at))}</time><div><h3 className="schedule-title">{session.title}</h3><p>{session.speakers_detail.map((speaker) => speaker.name).join(" · ") || "Palestrante a confirmar"}</p></div><span className="track-label"><span className="track-color" />{session.track || "Geral"}</span><span className="status-pill status-soon">Programada</span></article>)}</div>
        </div></section>
        <section className="section section-soft" id="palestrantes"><div className="container">
          <div className="section-heading"><div><p className="eyebrow">Quem está no palco</p><h2 className="section-title">Pessoas que movem ideias</h2></div><span className="muted"><Users size={17} /> {speakers.length} especialistas</span></div>
          <div className="speaker-grid">{speakers.map((speaker) => <article className="speaker-card" key={speaker.id}><div className="speaker-portrait">{initials(speaker.name)}</div><h3>{speaker.name}</h3><p>{speaker.bio}</p></article>)}</div>
        </div></section>
        {(event.recordings?.length ?? 0) > 0 && <section className="section section-dark"><div className="container cta-panel"><div><p className="eyebrow">On-demand</p><h2 className="section-title">Conteúdo para assistir no seu tempo.</h2><p>As gravações publicadas ficam disponíveis em um catálogo do evento.</p></div><Link className="button button-primary" href={`/eventos/${event.slug}/gravacoes`}>Ver gravações <ArrowRight size={17} /></Link></div></section>}
      </main>
      <SiteFooter />
    </>
  );
}
