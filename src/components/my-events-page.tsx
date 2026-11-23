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
import { useI18n } from "./i18n-provider";

function eventDate(event: EventData, intlLocale: string) {
  const formatter = new Intl.DateTimeFormat(intlLocale, {
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
  const { t, intlLocale } = useI18n();
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
        if (active) setError(reason instanceof Error ? reason.message : t("Não foi possível carregar seus eventos."));
      });
    return () => {
      active = false;
    };
  }, [router, t, user]);

  if (!user) {
    return (
      <main className="my-events-loading" aria-live="polite">
        <LoaderCircle className="spin" size={24} />
        <span>{t("Carregando seus eventos…")}</span>
      </main>
    );
  }

  return (
    <>
      <HomeHeader />
      <main className="my-events-page">
        <section className="my-events-hero container">
          <p className="eyebrow"><CalendarDays size={14} /> {t("Sua agenda")}</p>
          <h1>{t("Eventos que você está inscrito.")}</h1>
          <p>{t("Abra o lobby do evento, acompanhe o palco ao vivo ou vá direto para a rodada de negócios.")}</p>
        </section>
        <section className="container my-events-content">
          {error && <p className="form-error" role="alert">{error}</p>}
          {!events && !error && <div className="my-events-spinner"><LoaderCircle className="spin" /> <span>{t("Buscando inscrições…")}</span></div>}
          {events && events.length === 0 && (
            <div className="my-events-empty">
              <CalendarDays size={30} />
              <h2>{t("Você ainda não está inscrito em nenhum evento.")}</h2>
              <p>{t("Quando fizer uma inscrição, ela aparece aqui com os atalhos do lobby e do matchmaking.")}</p>
              <Link className="button button-primary" href="/">{t("Voltar para o início")}</Link>
            </div>
          )}
          {events && events.length > 0 && (
            <div className="my-events-grid">
              {events.map((event) => (
                <article className="my-event-card" key={event.id}>
                  <div className="my-event-card-head">
                    <span className={`status-pill status-${event.status ?? "published"}`}>
                      {event.status === "ended" ? t("Encerrado") : t("Inscrição confirmada")}
                    </span>
                  </div>
                  <h2>{event.name}</h2>
                  <p className="my-event-meta">
                    <span><CalendarDays size={15} /> {eventDate(event, intlLocale)}</span>
                    <span><MapPin size={15} /> {String(event.public_config.location ?? t("Online"))} · {event.timezone}</span>
                  </p>
                  <p className="my-event-description">{event.description}</p>
                  <div className="my-event-actions">
                    <Link className="button button-primary" href={`/eventos/${event.slug}/lobby`}>
                      <Radio size={16} /> {t("Entrar no lobby")}
                    </Link>
                    <Link className="button button-secondary" href={`/eventos/${event.slug}/networking`}>
                      <UsersRound size={16} /> {t("Rodada de negócios")}
                    </Link>
                    <Link className="my-event-link" href={`/eventos/${event.slug}`}>{t("Página do evento")}</Link>
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
