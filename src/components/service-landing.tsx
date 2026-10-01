"use client";

import Link from "next/link";
import { ArrowRight, Check, Radio, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { HomeHeader } from "./home-header";
import type { User } from "@/lib/api-types";

export function ServiceLanding({ kind }: { kind: "event" | "meeting" }) {
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => { fetch("/api/auth/me").then(async (response) => response.ok && setUser(await response.json())).catch(() => undefined); }, []);
  const isEvent = kind === "event";
  const features = isEvent
    ? ["Inscrição pública sem conta", "Palco moderado e convidados", "Agenda, chat, Q&A e enquetes", "Gravação, analytics e white-label"]
    : ["Áudio e vídeo colaborativos", "Compartilhamento de tela", "Salas rápidas para equipes e clientes", "Controles de host com tecnologia Zoom"];
  const canCreate = user?.account_type === "organizer" || user?.is_superuser;
  return <><HomeHeader /><main className="service-page"><section className="container service-hero"><span className="service-icon">{isEvent ? <Radio size={26} /> : <Users size={26} />}</span><p className="eyebrow">{isEvent ? "BR Events · Web Events" : "BR Events · Meetings"}</p><h1>{isEvent ? "Seu evento ao vivo, do convite ao on-demand." : "Reuniões com a sua marca e sem sair da plataforma."}</h1><p>{isEvent ? "Crie experiências de transmissão com audiência, programação, interação e palco sob controle da organização." : "Abra salas colaborativas para equipes, clientes, rodadas de negócio e encontros em tempo real."}</p><div className="hero-actions">{canCreate ? <Link className="button button-primary" href="/painel">Criar agora <ArrowRight size={17} /></Link> : <><Link className="button button-primary" href="/criar-conta?tipo=organizer&next=/painel">Criar conta para começar</Link><Link className="button button-secondary" href="/entrar?next=/painel">Já tenho conta</Link></>}</div></section><section className="container service-features">{features.map((feature) => <article key={feature}><Check size={19} /><strong>{feature}</strong></article>)}</section><section className="container service-explainer"><div><p className="eyebrow">Como funciona</p><h2>{isEvent ? "Audiência assiste. O organizador dirige." : "Todo mundo participa da conversa."}</h2></div><p>{isEvent ? "O público entra por inscrição, inclusive sem conta. Microfone, câmera e tela ficam com a organização, que pode convidar pessoas ao palco mediante aceite." : "Participantes autenticados entram com controles colaborativos de áudio, vídeo e tela. O host continua podendo moderar a sala."}</p></section></main></>;
}
