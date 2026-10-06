import Link from "next/link";
import { ArrowRight, Radio, UsersRound } from "lucide-react";
import type { EventData } from "@/lib/api-types";
import { HomeHeader } from "./home-header";

export function EventLobby({ event }: { event: EventData }) {
  return <><HomeHeader /><main className="event-lobby-page">
    <div className="event-lobby-header"><div><span>{event.name}</span><strong>Lobby do evento</strong></div><Link className="button button-secondary" href={`/eventos/${event.slug}`}>Voltar ao evento</Link></div>
    <section className="event-lobby-hero"><p className="eyebrow">Você está no evento</p><h1>Para onde você quer ir?</h1><p>Acompanhe o palco principal ou encontre alguém disponível para uma conversa privada de negócios.</p></section>
    <section className="event-lobby-options">
      <Link className="lobby-option lobby-option-stage" href={`/eventos/${event.slug}/ao-vivo`}><span><Radio size={25} /></span><small>Programação oficial</small><h2>Palco principal</h2><p>Entre na transmissão, acompanhe as sessões e participe das interações do evento.</p><strong>Entrar no palco <ArrowRight size={17} /></strong></Link>
      <Link className="lobby-option lobby-option-networking" href={`/eventos/${event.slug}/networking`}><span><UsersRound size={25} /></span><small>Conexões 1:1</small><h2>Rodada de negócios</h2><p>Veja quem está disponível no lobby e envie um convite para conversar em uma sala privada.</p><strong>Encontrar pessoas <ArrowRight size={17} /></strong></Link>
    </section>
  </main></>;
}
