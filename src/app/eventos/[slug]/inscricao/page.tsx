import { notFound } from "next/navigation";
import { RegistrationForm } from "@/components/registration-form";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getPublicEvent } from "@/lib/api-server";

export default async function RegistrationPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; const event = await getPublicEvent(slug); if (!event) notFound();
  return <><SiteHeader eventSlug={slug} /><main><section className="page-hero"><div className="container narrow"><p className="eyebrow">{event.name}</p><h1 className="section-title">Garanta sua participação</h1><p className="muted">{event.access_mode === "public" ? "Informe somente seu nome e e-mail para assistir. Uma conta só será necessária para interagir." : "Entre ou crie uma conta para concluir sua inscrição."}</p></div></section><section className="section"><div className="container narrow"><RegistrationForm eventId={event.id} eventSlug={slug} accessMode={event.access_mode} /></div></section></main><SiteFooter /></>;
}
