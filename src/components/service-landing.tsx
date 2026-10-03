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
import { useEffect, useState } from "react";

import type { User } from "@/lib/api-types";
import { HomeHeader } from "./home-header";

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
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/auth/me", { signal: controller.signal })
      .then(async (response) => {
        if (response.ok) setUser(await response.json());
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.error("Não foi possível carregar a conta na página do serviço.", error);
      });

    return () => controller.abort();
  }, []);

  const isEvent = kind === "event";
  const features = isEvent ? eventFeatures : meetingFeatures;
  const canCreate = user?.account_type === "organizer" || user?.is_superuser;
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
            ) : (
              <>
                <Link className="button button-primary service-primary-action" href={`/criar-conta?tipo=organizer&next=${encodeURIComponent(createPath)}`}>
                  Criar conta para começar <ArrowRight size={17} />
                </Link>
                <Link className="button button-secondary" href={`/entrar?next=${encodeURIComponent(createPath)}`}>Já tenho conta</Link>
              </>
            )}
          </div>
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
