"use client";

import {
  ArrowRight,
  Asterisk,
  CircleDot,
  Diamond,
  Grid3X3,
  Hexagon,
  Radio,
  Sparkles,
  Square,
  Users,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useState } from "react";

import { apiClient } from "@/lib/api-client";
import { HomeHeader } from "./home-header";
import { useSession } from "./session-provider";

const eventFeatures = [
  { icon: CircleDot, title: "Inscrição pública sem conta", description: "Qualquer pessoa entra com link, sem criar login." },
  { icon: Asterisk, title: "Palco moderado e convidados", description: "Controle quem sobe ao palco a qualquer momento." },
  { icon: Grid3X3, title: "Agenda, chat, Q&A e enquetes", description: "Interação em tempo real durante toda a sessão." },
  { icon: Diamond, title: "Gravação, analytics e white-label", description: "Conteúdo on-demand com sua marca em todo lugar." },
];

const meetingFeatures = [
  { icon: CircleDot, title: "Áudio e vídeo colaborativos", description: "Todos entram com câmera e microfone liberados." },
  { icon: Square, title: "Compartilhamento de tela", description: "Qualquer participante pode apresentar na hora." },
  { icon: Sparkles, title: "Salas rápidas para equipes e clientes", description: "Crie uma sala em segundos, sem agendamento." },
  { icon: Hexagon, title: "Controles de host com tecnologia Zoom", description: "Moderação completa, powered by Zoom." },
];

export function ServiceLanding({ kind }: { kind: "event" | "meeting" }) {
  const { user } = useSession();

  const isEvent = kind === "event";
  const features = isEvent ? eventFeatures : meetingFeatures;
  const canCreateEvent = user?.account_type === "organizer" || user?.is_staff || user?.is_superuser;
  const canCreate = isEvent ? canCreateEvent : Boolean(user);
  const createPath = isEvent ? "/painel" : "/meetings/novo";

  return (
    <>
      <HomeHeader />
      <main className={`service-page service-page-${kind}`}>
        <section className="container service-hero">
          <div className="service-kicker">
            <span className="service-icon" aria-hidden="true">
              {isEvent ? <Radio size={18} /> : <Users size={18} />}
            </span>
            <p className="eyebrow">BR Events · {isEvent ? "Web Events" : "Meetings"}</p>
          </div>
          <h1>{isEvent ? "Seu evento ao vivo, do convite ao on-demand." : "Reuniões com a sua marca e sem sair da plataforma."}</h1>
          <p className="service-lead">
            {isEvent
              ? "Crie experiências de transmissão com audiência, programação, interação e palco sob controle da organização."
              : "Abra salas colaborativas para equipes, clientes, rodadas de negócio e encontros em tempo real."}
          </p>
          <div className="hero-actions">
            {canCreate ? (
              <Link className="button button-primary service-primary-action" href={createPath}>
                Criar agora <ArrowRight size={17} />
              </Link>
            ) : isEvent ? (
              <p className="service-access-note">A criação e a operação de Web Events são realizadas pela equipe organizadora da BR Events.</p>
            ) : (
              <>
                <Link className="button button-primary service-primary-action" href={`/criar-conta?next=${encodeURIComponent(createPath)}`}>
                  Criar conta para começar <ArrowRight size={17} />
                </Link>
                <Link className="button button-secondary" href={`/entrar?next=${encodeURIComponent(createPath)}`}>Já tenho conta</Link>
              </>
            )}
          </div>
          {isEvent && !canCreateEvent && <WebEventConsultation />}
        </section>

        <section className="container service-features" aria-label="Recursos do serviço">
          {features.map(({ icon: Icon, title, description }) => (
            <article key={title}>
              <span className="service-feature-icon" aria-hidden="true"><Icon size={17} /></span>
              <h2>{title}</h2>
              <p>{description}</p>
            </article>
          ))}
        </section>

        <section className="container service-explainer">
          <header>
            <p className="eyebrow">Como funciona</p>
            <h2>{isEvent ? "Audiência assiste. O organizador dirige." : "Todo mundo participa da conversa."}</h2>
          </header>
          <div className="service-steps">
            <article>
              <span>01</span>
              <div>
                <h3>{isEvent ? "Entrada do público" : "Entrada autenticada"}</h3>
                <p>{isEvent ? "Inscrição pública, inclusive sem conta." : "Participantes entram com controles colaborativos de áudio, vídeo e tela."}</p>
              </div>
            </article>
            <article>
              <span>02</span>
              <div>
                <h3>{isEvent ? "Controle do palco" : "Moderação do host"}</h3>
                <p>{isEvent ? "Microfone, câmera e tela ficam com a organização, que pode convidar pessoas ao palco mediante aceite." : "O host continua podendo moderar a sala a qualquer momento."}</p>
              </div>
            </article>
          </div>
        </section>
      </main>
    </>
  );
}

function WebEventConsultation() {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    const data = Object.fromEntries(new FormData(event.currentTarget));

    try {
      await apiClient("web-event-inquiries/", {
        method: "POST",
        body: {
          name: String(data.name),
          email: String(data.email),
          company: String(data.company || ""),
          phone: String(data.phone || ""),
          message: String(data.message || ""),
        },
      });
      setSubmitted(true);
      event.currentTarget.reset();
    } catch (reason) {
      console.error("Não foi possível enviar o interesse em Web Event.", reason);
      setError("Não foi possível enviar agora. Tente novamente em instantes.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="web-event-consultation" aria-labelledby="web-event-consultation-title">
      <div>
        <p className="eyebrow">Organize com a BR Events</p>
        <h2 id="web-event-consultation-title">Quer realizar um evento pela plataforma?</h2>
        <p>A gente configura sua conta organizadora, prepara o ambiente e acompanha sua equipe até o evento estar no ar.</p>
        <ol>
          <li><span>01</span> Você conta o que precisa.</li>
          <li><span>02</span> Nossa equipe cria e configura sua conta.</li>
          <li><span>03</span> Planejamos a transmissão junto com você.</li>
        </ol>
      </div>
      {submitted ? (
        <div className="web-event-consultation-success" role="status">
          <strong>Recebemos seu interesse.</strong>
          <p>Nossa equipe vai analisar as informações e seguir com você para estruturar o evento.</p>
        </div>
      ) : (
        <form onSubmit={submit} className="web-event-consultation-form">
          <label className="field"><span>Nome</span><input name="name" autoComplete="name" required /></label>
          <label className="field"><span>E-mail profissional</span><input name="email" type="email" autoComplete="email" required /></label>
          <label className="field"><span>Empresa</span><input name="company" autoComplete="organization" /></label>
          <label className="field"><span>Telefone</span><input name="phone" type="tel" autoComplete="tel" /></label>
          <label className="field field-wide"><span>Como imagina seu evento?</span><textarea name="message" rows={3} maxLength={1200} placeholder="Ex.: evento para 500 pessoas, com inscrições e transmissão ao vivo." /></label>
          {error && <p className="form-error field-wide" role="alert">{error}</p>}
          <button className="button button-primary field-wide" type="submit" disabled={submitting}>{submitting ? "Enviando…" : "Quero falar com a equipe"} <ArrowRight size={17} /></button>
        </form>
      )}
    </section>
  );
}
