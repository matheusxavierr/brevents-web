"use client";

import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Building2, CalendarDays, ExternalLink, Globe2, Mail, Package, Phone } from "lucide-react";
import type { Organization } from "@/lib/api-types";
import { getCompanyHubTheme } from "@/lib/company-hub-theme";
import { formatShowcasePrice, MAX_SHOWCASE_ITEMS, SHOWCASE_TYPE_LABELS } from "@/lib/company-showcase";
import { formatDateValue } from "@/lib/i18n";
import { useI18n } from "./i18n-provider";
import styles from "./company-hub-view.module.css";

const SOCIAL_LABELS: Record<string, string> = { instagram: "Instagram", linkedin: "LinkedIn", youtube: "YouTube" };

export function CompanyHubView({ organization, preview = false }: { organization: Organization; preview?: boolean }) {
  const { t, locale } = useI18n();
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
        <section className={styles.hero} aria-label={t("Apresentação de {name}", { name: organization.name })}>
          <div className={styles.heroContent}>
            <div className={styles.identity}>
              <div className={styles.logo}>
                {organization.logo_url ? <Image src={organization.logo_url} alt={t("Logo de {name}", { name: organization.name })} width={88} height={88} unoptimized /> : <Building2 size={34} aria-hidden="true" />}
              </div>
              <div><span className={styles.kicker}>{t("A empresa")}</span><strong>{organization.name || t("Nome da empresa")}</strong></div>
            </div>
            {preview ? <h2 className={styles.headline}>{organization.headline || organization.name || t("Sua empresa em destaque.")}</h2> : <h1 className={styles.headline}>{organization.headline || organization.name}</h1>}
            <p className={styles.heroDescription}>{t("Conheça nossa empresa, acompanhe nossos eventos e conecte-se com a gente.")}</p>
            <div className={styles.heroActions}>
              <a className={styles.accentButton} href={`#${sectionId("contato")}`}>{t("Fale com a empresa")} <ArrowRight size={17} aria-hidden="true" /></a>
              <a className={styles.outlineButton} href={`#${sectionId("sobre")}`}>{t("Conheça nossa história")}</a>
            </div>
          </div>
          <span className={styles.platformBadge}>{t("Uma conexão pelo BR Events")}</span>
        </section>

        <nav className={styles.sectionNav} aria-label={preview ? t("Seções da prévia") : t("Seções da empresa")}>
          <a href={`#${sectionId("sobre")}`}>{t("Sobre a empresa")}</a>
          {showcase.length > 0 && <a href={`#${sectionId("mostruario")}`}>{t("O que oferecemos")}</a>}
          <a href={`#${sectionId("eventos")}`}>{t("Eventos")} <span>{events.length}</span></a>
          <a href={`#${sectionId("contato")}`}>{t("Contato e redes")}</a>
        </nav>

        <section className={styles.about} id={sectionId("sobre")}>
          <div className={styles.sectionHeading}><span className={styles.kicker}>{t("Nossa história")}</span><h2>{organization.name || t("Nome da empresa")}</h2></div>
          <div className={styles.aboutCopy}><p>{organization.description || t("Conheça a empresa e acompanhe seus próximos eventos no BR Events.")}</p>{organization.website_url && <a className={styles.textLink} href={organization.website_url} target="_blank" rel="noreferrer">{t("Explore nosso site")} <ExternalLink size={16} aria-hidden="true" /></a>}</div>
        </section>

        {showcase.length > 0 && <section className={styles.showcase} id={sectionId("mostruario")} aria-label={t("Mostruário da empresa")}>
          <div className={styles.sectionHeading}><span className={styles.kicker}>{t("Produtos, serviços e soluções")}</span><h2>{t("O que oferecemos")}</h2><p>{t("Conheça algumas das maneiras como podemos ajudar você.")}</p></div>
          <div className={styles.showcaseGrid}>{showcase.map((item, index) => <article className={styles.showcaseCard} key={index}>
            <div className={styles.showcaseImage}>{item.image_url ? <Image src={item.image_url} alt={item.name || t("Imagem do item")} width={640} height={480} unoptimized /> : <Package size={38} aria-hidden="true" />}</div>
            <div className={styles.showcaseBody}><span className={styles.itemType}>{t(SHOWCASE_TYPE_LABELS[item.item_type])}</span><h3>{item.name || t("Nome do item")}</h3>{item.description && <p>{item.description}</p>}{formatShowcasePrice(item.price, locale) !== null && <strong className={styles.showcasePrice}>{formatShowcasePrice(item.price, locale)}</strong>}<a className={styles.textLink} href={`#${sectionId("contato")}`} aria-label={t("Saber mais sobre {name}", { name: item.name || t("este item") })}>{t("Saiba mais")} <ArrowRight size={17} aria-hidden="true" /></a></div>
          </article>)}</div>
        </section>}

        <section className={styles.events} id={sectionId("eventos")}>
          <div className={styles.eventsHeading}><div className={styles.sectionHeading}><span className={styles.kicker}>{t("Encontros e conexões")}</span><h2>{t("Nosso próximo encontro")}</h2></div><span className={styles.count}>{events.length === 1 ? t("{count} evento", { count: events.length }) : t("{count} eventos", { count: events.length })}</span></div>
          {events.length > 0 ? <div className={styles.eventGrid}>{events.map((event) => {
            const date = new Date(event.starts_at);
            return <article className={styles.eventCard} key={event.id}>
              <div className={styles.eventDate}><CalendarDays size={19} aria-hidden="true" /><span>{Number.isNaN(date.getTime()) ? t("Data a confirmar") : formatDateValue(locale, date, { day: "2-digit", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" })}</span></div>
              <h3>{event.name}</h3><p>{event.description}</p>
              <Link className={styles.textLink} href={`/eventos/${event.slug}`}>{t("Conhecer evento")} <ArrowRight size={17} aria-hidden="true" /></Link>
            </article>;
          })}</div> : <div className={styles.empty}><CalendarDays size={28} aria-hidden="true" /><div><h3>{t("Novos encontros vêm por aí.")}</h3><p>{t("Acompanhe este espaço para descobrir os próximos eventos da empresa.")}</p></div></div>}
        </section>

        <section className={styles.contact} id={sectionId("contato")}>
          <div className={styles.sectionHeading}><span className={styles.kicker}>{t("Vamos nos conectar")}</span><h2>{t("Uma boa conversa pode ser o começo.")}</h2><p>{t("Conheça nossos canais e encontre a melhor forma de falar com a gente.")}</p></div>
          <div className={styles.contactLinks}>
            {organization.contact_email && <a href={`mailto:${organization.contact_email}`}><Mail size={20} aria-hidden="true" /><span><small>{t("E-mail")}</small>{organization.contact_email}</span><ArrowRight size={16} aria-hidden="true" /></a>}
            {organization.contact_phone && <a href={`tel:${organization.contact_phone}`}><Phone size={20} aria-hidden="true" /><span><small>{t("Telefone")}</small>{organization.contact_phone}</span><ArrowRight size={16} aria-hidden="true" /></a>}
            {organization.website_url && <a href={organization.website_url} target="_blank" rel="noreferrer"><Globe2 size={20} aria-hidden="true" /><span><small>{t("Na web")}</small>{t("Visite nosso site")}</span><ExternalLink size={16} aria-hidden="true" /></a>}
            {links.length > 0 && <div className={styles.socialLinks}>{links.map(([network, url]) => <a href={url} target="_blank" rel="noreferrer" key={network}>{SOCIAL_LABELS[network] || network}<ExternalLink size={14} aria-hidden="true" /></a>)}</div>}
            {!hasContact && <p className={styles.contactEmpty}>{t("Os canais de contato serão divulgados em breve. Enquanto isso, acompanhe os eventos da empresa por aqui.")}</p>}
          </div>
        </section>
        <footer className={styles.footer}><span>{organization.name || t("Sua empresa")}</span><span>{t("Conectada ao")} <Link href="/">BR Events</Link></span></footer>
      </div>
    </div>
  );
}
