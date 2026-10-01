import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getPublicEvent } from "@/lib/api-server";

export default async function EventAgendaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await getPublicEvent(slug);
  if (!event) notFound();
  return <><SiteHeader current="agenda" eventSlug={slug} /><main><section className="page-hero"><div className="container page-hero-copy"><div><p className="eyebrow">{event.name}</p><h1 className="section-title">Programação completa</h1><p className="muted">Sessões, horários, trilhas e palestrantes em um só lugar.</p></div><Link className="button button-primary" href={`/eventos/${slug}/inscricao`}>Inscreva-se <ArrowRight size={16} /></Link></div></section><section className="section"><div className="container"><div className="schedule-list">{(event.sessions ?? []).map((session) => <article className="schedule-item" key={session.id}><time className="schedule-time">{new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: event.timezone }).format(new Date(session.starts_at))}</time><div><h2 className="schedule-title">{session.title}</h2><p>{session.speakers_detail.map((speaker) => speaker.name).join(" · ") || "Palestrante a confirmar"}</p></div><span className="track-label"><span className="track-color" />{session.track || "Geral"}</span><span className="status-pill status-soon">{session.status === "published" ? "Confirmada" : "Rascunho"}</span></article>)}</div></div></section></main><SiteFooter /></>;
}
