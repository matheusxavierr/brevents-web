import Link from "next/link";
import { ArrowRight, CalendarX2, Home } from "lucide-react";
import { Brand } from "./brand";

type EventUnavailableProps = {
  ended?: boolean;
};

export function EventUnavailable({ ended = false }: EventUnavailableProps) {
  return (
    <main className="event-unavailable">
      <section className="event-unavailable-stage" aria-hidden="true">
        <Brand />
        <div className="event-unavailable-signal">
          <span className="event-unavailable-code">OFF</span>
          <div>
            <span className="live-pill"><span className="live-dot" /> Fora do ar</span>
            <strong>O palco está fechado.</strong>
          </div>
        </div>
        <small>BR EVENTS · EVENTOS COM PRESENÇA</small>
      </section>

      <section className="event-unavailable-content" aria-labelledby="event-unavailable-title">
        <div className="event-unavailable-icon"><CalendarX2 size={28} aria-hidden="true" /></div>
        <p className="eyebrow">{ended ? "Evento encerrado" : "Evento indisponível"}</p>
        <h1 id="event-unavailable-title">
          {ended ? "Este evento chegou ao fim." : "Este evento não está disponível."}
        </h1>
        <p>
          {ended
            ? "A transmissão e os acessos públicos foram encerrados pelo organizador."
            : "O link pode estar incorreto, o evento pode ter terminado ou o acesso pode ter sido desativado pelo organizador."}
        </p>
        <div className="event-unavailable-actions">
          <Link className="button button-primary" href="/"><Home size={17} /> Voltar ao início</Link>
          <Link className="button button-secondary" href="/entrar">Entrar na minha conta <ArrowRight size={17} /></Link>
        </div>
        <span className="event-unavailable-help">Se você recebeu este link por convite, confirme o endereço com o organizador.</span>
      </section>
    </main>
  );
}
