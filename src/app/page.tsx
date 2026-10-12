import Link from "next/link";
import { ArrowRight, BarChart3, MessagesSquare, Radio, ShieldCheck, Users } from "lucide-react";
import { HomeHeader } from "@/components/home-header";
import { ProductPreviewImage } from "@/components/product-preview-image";
import styles from "@/components/home-showcase.module.css";

export default function Home() {
  return <>
    <HomeHeader />
    <main className="home-page">
      <section className={styles.hero}>
        <div className={`container ${styles.heroGrid}`}>
          <div className={styles.copy}>
            <p className="eyebrow">Eventos e reuniões em uma só plataforma</p>
            <h1>Ao vivo com direção.<br />Perto mesmo à distância.</h1>
            <p>Crie web events completos ou abra reuniões colaborativas com tecnologia Zoom, identidade própria e operação centralizada.</p>
            <div><Link className="button button-primary" href="/servicos/web-events">Conhecer Web Events <ArrowRight size={17} /></Link><Link className="button button-secondary" href="/servicos/meetings">Conhecer Meetings</Link></div>
          </div>
          <figure className={styles.heroVisual}>
            <div className={styles.mainPreview}><span><Radio size={15} aria-hidden="true" /> Web Events · O seu palco, ao vivo</span><ProductPreviewImage kind="event" sizes="(max-width: 800px) 100vw, 55vw" preload /></div>
            <div className={styles.miniPreview}><span><Users size={13} aria-hidden="true" /> Meetings · Todo mundo na conversa</span><ProductPreviewImage kind="meeting" sizes="(max-width: 800px) 65vw, 35vw" /></div>
            <figcaption>Prévia da plataforma com eventos e participantes fictícios.</figcaption>
          </figure>
        </div>
      </section>
      <section className={`container ${styles.products}`} aria-label="Soluções BR Events">
        <article className={styles.product}><div className={styles.productImage}><ProductPreviewImage kind="networking" sizes="(max-width: 800px) 100vw, 50vw" /></div><div className={styles.productCopy}><p className="eyebrow">Web Events</p><h2>Do palco à próxima conexão.</h2><p>Palcos para transmitir, um lobby com rodadas de negócios 1:1 e um painel para a organização conduzir cada etapa do evento.</p><Link href="/servicos/web-events">Conhecer Web Events <ArrowRight size={15} /></Link></div></article>
        <article className={styles.product}><div className={styles.productImage}><ProductPreviewImage kind="meeting" sizes="(max-width: 800px) 100vw, 50vw" /></div><div className={styles.productCopy}><p className="eyebrow">Meetings</p><h2>Encontre, converse e colabore.</h2><p>Câmera, microfone, compartilhamento de tela, chat e transcrição em uma sala organizada para equipes, clientes e boas conversas.</p><Link href="/servicos/meetings">Conhecer Meetings <ArrowRight size={15} /></Link></div></article>
      </section>
      <section className="container home-capabilities" aria-label="Recursos da plataforma"><div><span className="home-capability-icon"><ShieldCheck /></span><strong>Sua identidade</strong><span>Sua empresa e seus encontros dentro do BR Events.</span></div><div><span className="home-capability-icon"><MessagesSquare /></span><strong>Interação</strong><span>Chat, perguntas, enquetes e conversas 1:1.</span></div><div><span className="home-capability-icon"><BarChart3 /></span><strong>Organização</strong><span>Programação, inscrições e público em um só painel.</span></div></section>
    </main>
  </>;
}
