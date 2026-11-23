"use client";

import Link from "next/link";
import { ArrowRight, Building2, CalendarDays, Check, Globe2, Package, Palette, Share2 } from "lucide-react";
import { HomeHeader } from "./home-header";
import { useI18n } from "./i18n-provider";
import styles from "./company-hub-introduction.module.css";

export function CompanyHubIntroduction() {
  const { t } = useI18n();

  return <>
    <HomeHeader />
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className="eyebrow"><Building2 size={16} aria-hidden="true" /> {t("Hub da empresa")}</p>
          <h1>{t("Sua empresa merece um lugar para se apresentar.")}</h1>
          <p>{t("O hub é a página da sua empresa dentro do BR Events. Um espaço permanente para contar sua história, mostrar o que você oferece e criar novas conexões.")}</p>
          <Link className="button button-primary" href="/hub/configurar">{t("Criar ou editar meu hub")} <ArrowRight size={18} aria-hidden="true" /></Link>
          <span className={styles.accessNote}><Check size={16} aria-hidden="true" /> {t("Disponível para todos os usuários com uma conta.")}</span>
        </div>
        <div className={styles.demo} aria-label={t("Exemplo de uma página de empresa")}>
          <div className={styles.demoTop}><span><Globe2 size={14} aria-hidden="true" /> {t("Sua página no BR Events")}</span><i /><i /><i /></div>
          <div className={styles.demoCover}><span className={styles.demoLogo}><Building2 size={30} aria-hidden="true" /></span><small>{t("SUA EMPRESA")}</small><h2>{t("Sua marca.")}<br />{t("Suas conexões.")}</h2><span className={styles.demoContact}>{t("Vamos conversar")} <ArrowRight size={14} aria-hidden="true" /></span></div>
          <div className={styles.demoOffers}><strong>{t("O que oferecemos")}</strong><div><span><Package size={22} aria-hidden="true" /> {t("Produto")}</span><span><Palette size={22} aria-hidden="true" /> {t("Serviço")}</span><span><Building2 size={22} aria-hidden="true" /> {t("Solução")}</span></div></div>
          <div className={styles.demoFooter}><CalendarDays size={17} aria-hidden="true" /> {t("Eventos e oportunidades para se conectar")}</div>
        </div>
      </section>

      <section className={styles.features} aria-label={t("O que você pode colocar no hub")}>
        <article><Palette size={26} aria-hidden="true" /><h2>{t("Uma página com a sua identidade")}</h2><p>{t("Personalize logo, capa, cores e textos. A estrutura já vem pronta para apresentar sua empresa com clareza.")}</p></article>
        <article><Package size={26} aria-hidden="true" /><h2>{t("Um mostruário do que você faz")}</h2><p>{t("Destaque até 3 produtos, serviços ou soluções, com imagens e descrições. Um espaço de apresentação, sem checkout ou pagamento.")}</p></article>
        <article><Share2 size={26} aria-hidden="true" /><h2>{t("Novas portas para conversar")}</h2><p>{t("Reúna contatos, site, redes sociais e eventos vinculados à empresa. Compartilhe o link com quem quiser conhecer sua marca.")}</p></article>
      </section>

      <section className={styles.steps}>
        <div><p className="eyebrow">{t("Simples de começar")}</p><h2>{t("Do cadastro à sua vitrine em três passos.")}</h2></div>
        <ol><li><span>01</span><div><h3>{t("Apresente sua empresa")}</h3><p>{t("Cadastre o nome e escolha o endereço da sua página.")}</p></div></li><li><span>02</span><div><h3>{t("Deixe com a sua cara")}</h3><p>{t("Adicione imagens, textos, cores, contatos e até 3 itens ao mostruário.")}</p></div></li><li><span>03</span><div><h3>{t("Salve e compartilhe")}</h3><p>{t("Sua página fica disponível para visitantes pelo link do hub.")}</p></div></li></ol>
      </section>
      <section className={styles.cta}><div><h2>{t("Vamos dar visibilidade à sua empresa?")}</h2><p>{t("Você cuida do conteúdo. O BR Events já tem o espaço pronto.")}</p></div><Link className="button button-primary" href="/hub/configurar">{t("Configurar meu hub")} <ArrowRight size={18} aria-hidden="true" /></Link></section>
    </main>
  </>;
}
