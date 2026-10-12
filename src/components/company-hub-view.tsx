import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Building2, CalendarDays, ExternalLink, Globe2, Mail, Package, Phone } from "lucide-react";
import type { Organization } from "@/lib/api-types";
import { getCompanyHubTheme } from "@/lib/company-hub-theme";
import { formatShowcasePrice, MAX_SHOWCASE_ITEMS, SHOWCASE_TYPE_LABELS } from "@/lib/company-showcase";
import styles from "./company-hub-view.module.css";

const SOCIAL_LABELS: Record<string, string> = { instagram: "Instagram", linkedin: "LinkedIn", youtube: "YouTube" };

export function CompanyHubView({ organization, preview = false }: { organization: Organization; preview?: boolean }) {
  const events = organization.events ?? [];
  const showcase = (organization.showcase_items ?? []).slice(0, MAX_SHOWCASE_ITEMS);
  const links = Object.entries(organization.social_links ?? {}).filter(([, url]) => Boolean(url));
  const sectionId = (section: string) => `${preview ? "preview-" : ""}${section}`;
  const theme = {
    ...getCompanyHubTheme(organization.branding),
    "--hub-cover": organization.cover_image_url ? `url(${JSON.stringify(organization.cover_image_url)})` : "none",
  } as CSSProperties;
  const hasContact = organization.website_url || organization.contact_email || organization.contact_phone || links.length > 0;

  return (
    <div className={`${styles.hub} ${preview ? styles.preview : ""}`} style={theme}>
      <div className={styles.content}>
        <section className={styles.hero} aria-label={`Apresentação de ${organization.name}`}>
          <div className={styles.heroContent}>
            <div className={styles.identity}>
              <div className={styles.logo}>
                {organization.logo_url ? <Image src={organization.logo_url} alt={`Logo de ${organization.name}`} width={88} height={88} unoptimized /> : <Building2 size={34} aria-hidden="true" />}
              </div>
              <div><span className={styles.kicker}>A empresa</span><strong>{organization.name || "Nome da empresa"}</strong></div>
            </div>
            {preview ? <h2 className={styles.headline}>{organization.headline || organization.name || "Sua empresa em destaque."}</h2> : <h1 className={styles.headline}>{organization.headline || organization.name}</h1>}
            <p className={styles.heroDescription}>Conheça nossa empresa, acompanhe nossos eventos e conecte-se com a gente.</p>
            <div className={styles.heroActions}>
              <a className={styles.accentButton} href={`#${sectionId("contato")}`}>Fale com a empresa <ArrowRight size={17} aria-hidden="true" /></a>
              <a className={styles.outlineButton} href={`#${sectionId("sobre")}`}>Conheça nossa história</a>
            </div>
          </div>
          <span className={styles.platformBadge}>Uma conexão pelo BR Events</span>
        </section>

        <nav className={styles.sectionNav} aria-label={preview ? "Seções da prévia" : "Seções da empresa"}>
          <a href={`#${sectionId("sobre")}`}>Sobre a empresa</a>
          {showcase.length > 0 && <a href={`#${sectionId("mostruario")}`}>O que oferecemos</a>}
          <a href={`#${sectionId("eventos")}`}>Eventos <span>{events.length}</span></a>
          <a href={`#${sectionId("contato")}`}>Contato e redes</a>
        </nav>

        <section className={styles.about} id={sectionId("sobre")}>
          <div className={styles.sectionHeading}><span className={styles.kicker}>Nossa história</span><h2>{organization.name || "Nome da empresa"}</h2></div>
          <div className={styles.aboutCopy}><p>{organization.description || "Conheça a empresa e acompanhe seus próximos eventos no BR Events."}</p>{organization.website_url && <a className={styles.textLink} href={organization.website_url} target="_blank" rel="noreferrer">Explore nosso site <ExternalLink size={16} aria-hidden="true" /></a>}</div>
        </section>

        {showcase.length > 0 && <section className={styles.showcase} id={sectionId("mostruario")} aria-label="Mostruário da empresa">
          <div className={styles.sectionHeading}><span className={styles.kicker}>Produtos, serviços e soluções</span><h2>O que oferecemos</h2><p>Conheça algumas das maneiras como podemos ajudar você.</p></div>
          <div className={styles.showcaseGrid}>{showcase.map((item, index) => <article className={styles.showcaseCard} key={index}>
            <div className={styles.showcaseImage}>{item.image_url ? <Image src={item.image_url} alt={item.name || "Imagem do item"} width={640} height={480} unoptimized /> : <Package size={38} aria-hidden="true" />}</div>
            <div className={styles.showcaseBody}><span className={styles.itemType}>{SHOWCASE_TYPE_LABELS[item.item_type]}</span><h3>{item.name || "Nome do item"}</h3>{item.description && <p>{item.description}</p>}{formatShowcasePrice(item.price) !== null && <strong className={styles.showcasePrice}>{formatShowcasePrice(item.price)}</strong>}<a className={styles.textLink} href={`#${sectionId("contato")}`} aria-label={`Saber mais sobre ${item.name || "este item"}`}>Saiba mais <ArrowRight size={17} aria-hidden="true" /></a></div>
          </article>)}</div>
        </section>}

        <section className={styles.events} id={sectionId("eventos")}>
          <div className={styles.eventsHeading}><div className={styles.sectionHeading}><span className={styles.kicker}>Encontros e conexões</span><h2>Nosso próximo encontro</h2></div><span className={styles.count}>{events.length} {events.length === 1 ? "evento" : "eventos"}</span></div>
          {events.length > 0 ? <div className={styles.eventGrid}>{events.map((event) => {
            const date = new Date(event.starts_at);
            return <article className={styles.eventCard} key={event.id}>
              <div className={styles.eventDate}><CalendarDays size={19} aria-hidden="true" /><span>{Number.isNaN(date.getTime()) ? "Data a confirmar" : date.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" })}</span></div>
              <h3>{event.name}</h3><p>{event.description}</p>
              <Link className={styles.textLink} href={`/eventos/${event.slug}`}>Conhecer evento <ArrowRight size={17} aria-hidden="true" /></Link>
            </article>;
          })}</div> : <div className={styles.empty}><CalendarDays size={28} aria-hidden="true" /><div><h3>Novos encontros vêm por aí.</h3><p>Acompanhe este espaço para descobrir os próximos eventos da empresa.</p></div></div>}
        </section>

        <section className={styles.contact} id={sectionId("contato")}>
          <div className={styles.sectionHeading}><span className={styles.kicker}>Vamos nos conectar</span><h2>Uma boa conversa pode ser o começo.</h2><p>Conheça nossos canais e encontre a melhor forma de falar com a gente.</p></div>
          <div className={styles.contactLinks}>
            {organization.contact_email && <a href={`mailto:${organization.contact_email}`}><Mail size={20} aria-hidden="true" /><span><small>E-mail</small>{organization.contact_email}</span><ArrowRight size={16} aria-hidden="true" /></a>}
            {organization.contact_phone && <a href={`tel:${organization.contact_phone}`}><Phone size={20} aria-hidden="true" /><span><small>Telefone</small>{organization.contact_phone}</span><ArrowRight size={16} aria-hidden="true" /></a>}
            {organization.website_url && <a href={organization.website_url} target="_blank" rel="noreferrer"><Globe2 size={20} aria-hidden="true" /><span><small>Na web</small>Visite nosso site</span><ExternalLink size={16} aria-hidden="true" /></a>}
            {links.length > 0 && <div className={styles.socialLinks}>{links.map(([network, url]) => <a href={url} target="_blank" rel="noreferrer" key={network}>{SOCIAL_LABELS[network] || network}<ExternalLink size={14} aria-hidden="true" /></a>)}</div>}
            {!hasContact && <p className={styles.contactEmpty}>Os canais de contato serão divulgados em breve. Enquanto isso, acompanhe os eventos da empresa por aqui.</p>}
          </div>
        </section>
        <footer className={styles.footer}><span>{organization.name || "Sua empresa"}</span><span>Conectada ao <Link href="/">BR Events</Link></span></footer>
      </div>
    </div>
  );
}
