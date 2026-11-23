"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, CalendarX2, Home } from "lucide-react";
import { Brand } from "./brand";
import { LanguageSwitcher } from "./language-switcher";
import { useI18n } from "./i18n-provider";

type EventUnavailableProps = {
  ended?: boolean;
  actions?: ReactNode;
};

export function EventUnavailable({ ended = false, actions }: EventUnavailableProps) {
  const { t } = useI18n();
  return (
    <main className="event-unavailable">
      <section className="event-unavailable-stage" aria-hidden="true">
        <Brand />
        <div className="event-unavailable-signal">
          <span className="event-unavailable-code">OFF</span>
          <div>
            <span className="live-pill"><span className="live-dot" /> {t("Fora do ar")}</span>
            <strong>{t("O palco está fechado.")}</strong>
          </div>
        </div>
        <small>{t("BR EVENTS · EVENTOS COM PRESENÇA")}</small>
      </section>

      <section className="event-unavailable-content" aria-labelledby="event-unavailable-title">
        <LanguageSwitcher className="event-unavailable-language" />
        <div className="event-unavailable-icon"><CalendarX2 size={28} aria-hidden="true" /></div>
        <p className="eyebrow">{ended ? t("Evento encerrado") : t("Evento indisponível")}</p>
        <h1 id="event-unavailable-title">
          {ended ? t("Este evento chegou ao fim.") : t("Este evento não está disponível.")}
        </h1>
        <p>
          {ended
            ? t("A transmissão e os acessos públicos foram encerrados pelo organizador.")
            : t("O link pode estar incorreto, o evento pode ter terminado ou o acesso pode ter sido desativado pelo organizador.")}
        </p>
        <div className="event-unavailable-actions">
          {actions}
          <Link className="button button-primary" href="/"><Home size={17} /> {t("Voltar ao início")}</Link>
          <Link className="button button-secondary" href="/entrar">{t("Entrar na minha conta")} <ArrowRight size={17} /></Link>
        </div>
        <span className="event-unavailable-help">{t("Se você recebeu este link por convite, confirme o endereço com o organizador.")}</span>
      </section>
    </main>
  );
}
