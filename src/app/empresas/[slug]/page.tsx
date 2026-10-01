import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CalendarDays, Radio, Sparkles } from "lucide-react";
import { Brand } from "@/components/brand";
import { getPublicOrganization } from "@/lib/api-server";

export default async function OrganizationHubPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const organization = await getPublicOrganization(slug);
  if (!organization) notFound();
  const primary = organization.branding.primary_color ?? "#A65C45";
  const accent = organization.branding.accent_color ?? "#7A8C74";

  return (
    <main className="tenant-hub" style={{ "--tenant-primary": primary, "--tenant-accent": accent } as React.CSSProperties}>
      <header className="tenant-header"><Brand /><span>Powered by BR Events</span></header>
      <section className="tenant-hero">
        <p className="eyebrow"><Sparkles size={13} /> Hub oficial</p>
        <h1>{organization.name}</h1>
        <p>{organization.description}</p>
      </section>
      <section className="tenant-events" aria-labelledby="tenant-events-title">
        <div className="tenant-section-title"><div><p className="eyebrow">Programação</p><h2 id="tenant-events-title">Próximos eventos</h2></div><span>{organization.events.length} publicados</span></div>
        <div className="tenant-event-grid">
          {organization.events.map((event) => (
            <article className="tenant-event-card" key={event.id}>
              <div className="tenant-event-visual"><Radio size={24} /><span>AO VIVO · WHITE LABEL</span></div>
              <div className="tenant-event-content">
                <p><CalendarDays size={15} /> {new Date(event.starts_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}</p>
                <h3>{event.name}</h3>
                <span>{event.description}</span>
                <Link className="button button-primary" href={`/eventos/${event.slug}`}>Ver evento <ArrowRight size={16} /></Link>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
