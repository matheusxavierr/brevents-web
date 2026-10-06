import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CalendarDays, ExternalLink, Globe2, Mail, Phone } from "lucide-react";
import { HomeHeader } from "@/components/home-header";
import { getPublicOrganization } from "@/lib/api-server";

export default async function CompanyHubPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const organization = await getPublicOrganization(slug);
  if (!organization) notFound();
  const primary = organization.branding?.primary_color ?? "#A65C45";
  const accent = organization.branding?.accent_color ?? "#7A8C74";
  const events = organization.events ?? [];
  const links = Object.entries(organization.social_links ?? {}).filter((entry): entry is [string, string] => Boolean(entry[1]));

  return <><HomeHeader /><main className="company-public-hub" style={{ "--hub-primary": primary, "--hub-accent": accent } as React.CSSProperties}>
    <nav className="company-hub-section-nav" aria-label="Seções da empresa"><a href="#sobre">Sobre</a><a href="#eventos">Eventos</a><a href="#contato">Contato</a></nav>
    <section className="company-hub-hero" style={organization.cover_image_url ? { backgroundImage: `linear-gradient(90deg, rgba(21,22,24,.92), rgba(21,22,24,.55)), url(${organization.cover_image_url})` } : undefined}>
      <div className="company-hub-identity">{organization.logo_url ? <span className="company-hub-logo" style={{ backgroundImage: `url(${organization.logo_url})` }} /> : <span className="company-hub-logo fallback">{organization.name.slice(0, 2).toUpperCase()}</span>}<p className="eyebrow">Hub oficial no BR Events</p><h1>{organization.headline || organization.name}</h1><p>{organization.description}</p></div>
    </section>
    <section className="company-hub-about" id="sobre"><div><p className="eyebrow">A empresa</p><h2>{organization.name}</h2></div><p>{organization.description || "Conheça a empresa e acompanhe seus próximos eventos no BR Events."}</p></section>
    <section className="company-hub-events" id="eventos"><div className="tenant-section-title"><div><p className="eyebrow">Agenda</p><h2>Eventos da empresa</h2></div><span>{events.length} {events.length === 1 ? "evento" : "eventos"}</span></div>{events.length ? <div className="company-event-grid">{events.map((event) => <article key={event.id}><small><CalendarDays size={14} /> {new Date(event.starts_at).toLocaleDateString("pt-BR")}</small><h3>{event.name}</h3><p>{event.description}</p><Link href={`/eventos/${event.slug}`}>Conhecer evento <ArrowRight size={15} /></Link></article>)}</div> : <div className="company-hub-empty"><h3>Nenhum evento publicado por enquanto.</h3><p>Volte em breve para acompanhar a programação da empresa.</p></div>}</section>
    <footer className="company-hub-contact" id="contato"><div><p className="eyebrow">Contato</p><h2>Vamos conversar?</h2></div><div>{organization.website_url && <a href={organization.website_url} target="_blank" rel="noreferrer"><Globe2 size={16} /> Site <ExternalLink size={12} /></a>}{organization.contact_email && <a href={`mailto:${organization.contact_email}`}><Mail size={16} /> {organization.contact_email}</a>}{organization.contact_phone && <a href={`tel:${organization.contact_phone}`}><Phone size={16} /> {organization.contact_phone}</a>}{links.map(([network, url]) => <a href={url} target="_blank" rel="noreferrer" key={network}>{network}<ExternalLink size={12} /></a>)}</div></footer>
  </main></>;
}
