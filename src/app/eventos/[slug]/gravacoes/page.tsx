import { notFound } from "next/navigation";
import { Clock3, Play } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getPublicEvent } from "@/lib/api-server";

export default async function RecordingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await getPublicEvent(slug);
  if (!event) notFound();
  return <><SiteHeader eventSlug={slug} /><main><section className="page-hero"><div className="container"><p className="eyebrow">{event.name}</p><h1 className="section-title">Assista quando quiser</h1><p className="muted">Conteúdo on-demand disponibilizado pela organização.</p></div></section><section className="section"><div className="container recording-grid">{(event.recordings ?? []).map((recording) => <article className="recording-card" key={recording.id}><div className="recording-cover"><Play size={30} fill="currentColor" /></div><div className="recording-content"><span className="status-pill status-recorded">Gravado</span><h2>{recording.title}</h2><p><Clock3 size={15} /> {recording.duration_seconds ? `${Math.round(recording.duration_seconds / 60)} min` : "Duração não informada"}</p><a className="button button-secondary" href={recording.playback_url} target="_blank" rel="noreferrer">Assistir gravação</a></div></article>)}{event.recordings?.length === 0 && <p className="muted">Nenhuma gravação publicada até o momento.</p>}</div></section></main><SiteFooter /></>;
}
