"use client";

import { CalendarDays, LoaderCircle, MapPin, Radio, UsersRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import type { EventData } from "@/lib/api-types";
import { loadRegisteredEvents } from "@/lib/registered-events";
import { HomeHeader } from "./home-header";
import { SiteFooter } from "./site-footer";
import { useSession } from "./session-provider";

function eventDate(event: EventData) {
  const formatter = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: event.timezone,
  });
  return formatter.format(new Date(event.starts_at));
}

export function MyEventsPage() {
  const router = useRouter();
  const { user } = useSession();
  const [events, setEvents] = useState<EventData[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) {
      router.replace(`/entrar?next=${encodeURIComponent("/meus-eventos")}`);
      return;
    }
    let active = true;
    loadRegisteredEvents()
      .then((items) => {
        if (active) setEvents(items);
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : "Não foi possível carregar seus eventos.");
      });
    return () => {
      active = false;
    };
  }, [router, user]);

  if (!user) {
    return (
      <main className="my-events-loading" aria-live="polite">
        <LoaderCircle className="spin" size={24} />
        <span>Carregando seus eventos…</span>
      </main>
    );
  }

  return (
    <>
      <HomeHeader />
      <main className="my-events-page">
        <section className="my-events-hero container">
          <p className="eyebrow"><CalendarDays size={14} /> Sua agenda</p>
          <h1>Eventos que você está inscrito.</h1>
          <p>Abra o lobby do evento, acompanhe o palco ao vivo ou vá direto para a rodada de negócios.</p>
        </section>
        <section className="container my-events-content">
          {error && <p className="form-error" role="alert">{error}</p>}
          {!events && !error && <div className="my-events-spinner"><LoaderCircle className="spin" /> <span>Buscando inscrições…</span></div>}
          {events && events.length === 0 && (
            <div className="my-events-empty">
              <CalendarDays size={30} />
              <h2>Você ainda não está inscrito em nenhum evento.</h2>
              <p>Quando fizer uma inscrição, ela aparece aqui com os atalhos do lobby e do matchmaking.</p>
              <Link className="button button-primary" href="/">Voltar para o início</Link>
            </div>
          )}
          {events && events.length > 0 && (
            <div className="my-events-grid">
              {events.map((event) => (
                <article className="my-event-card" key={event.id}>
                  <div className="my-event-card-head">
                    <span className={`status-pill status-${event.status ?? "published"}`}>
                      {event.status === "ended" ? "Encerrado" : "Inscrição confirmada"}
                    </span>
                  </div>
                  <h2>{event.name}</h2>
                  <p className="my-event-meta">
                    <span><CalendarDays size={15} /> {eventDate(event)}</span>
                    <span><MapPin size={15} /> {String(event.public_config.location ?? "Online")} · {event.timezone}</span>
                  </p>
                  <p className="my-event-description">{event.description}</p>
                  <div className="my-event-actions">
                    <Link className="button button-primary" href={`/eventos/${event.slug}/lobby`}>
                      <Radio size={16} /> Entrar no lobby
                    </Link>
                    <Link className="button button-secondary" href={`/eventos/${event.slug}/networking`}>
                      <UsersRound size={16} /> Rodada de negócios
                    </Link>
                    <Link className="my-event-link" href={`/eventos/${event.slug}`}>Página do evento</Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
