"use client";

import {
  ArrowRight,
  Asterisk,
  CircleDot,
  Grid3X3,
  Hexagon,
  Radio,
  Sparkles,
  Square,
  Users,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useState } from "react";

import { apiClient } from "@/lib/api-client";
import { HomeHeader } from "./home-header";
import { useI18n } from "./i18n-provider";
import { useSession } from "./session-provider";
import { ProductPreviewGallery } from "./product-preview-gallery";

export function ServiceLanding({ kind }: { kind: "event" | "meeting" }) {
  const { user } = useSession();
  const { t } = useI18n();

  const isEvent = kind === "event";
  const features = isEvent ? [
    { icon: CircleDot, title: t("Inscrição pública sem conta"), description: t("Qualquer pessoa entra com link, sem criar login.") },
    { icon: Asterisk, title: t("Palcos e convidados"), description: t("Conduza a transmissão e convide participantes ao palco.") },
    { icon: Users, title: t("Lobby e rodadas de negócios"), description: t("Encontros 1:1 entre participantes do seu evento.") },
    { icon: Grid3X3, title: t("Organização em um só painel"), description: t("Programação, palestrantes, inscrições e interações sob controle.") },
  ] : [
    { icon: CircleDot, title: t("Áudio e vídeo colaborativos"), description: t("Todos entram com câmera e microfone liberados.") },
    { icon: Square, title: t("Compartilhamento de tela"), description: t("Qualquer participante pode apresentar na hora.") },
    { icon: Sparkles, title: t("Salas rápidas para equipes e clientes"), description: t("Crie uma sala em segundos, sem agendamento.") },
    { icon: Hexagon, title: t("Controles de host com tecnologia Zoom"), description: t("Moderação completa, powered by Zoom.") },
  ];
  const canCreateEvent = user?.account_type === "organizer" || user?.is_staff || user?.is_superuser;
  const canCreate = isEvent ? canCreateEvent : Boolean(user);
  const createPath = isEvent ? "/painel" : "/meetings/novo";

  return (
    <>
      <HomeHeader />
      <main className={`service-page service-page-${kind}`}>
        <section className="container service-hero">
          <div className="service-kicker">
            <span className="service-icon" aria-hidden="true">
              {isEvent ? <Radio size={18} /> : <Users size={18} />}
            </span>
            <p className="eyebrow">BR Events · {isEvent ? t("Web Events") : t("Meetings")}</p>
          </div>
          <h1>{isEvent ? t("Seu evento vai além do palco.") : t("Reuniões que aproximam pessoas e ideias.")}</h1>
          <p className="service-lead">
            {isEvent
              ? t("Palcos para compartilhar ideias, um lobby para criar conexões e rodadas de negócios para conversar de perto. Tudo coordenado pela organização.")
              : t("Câmera, microfone, tela compartilhada e uma conversa que continua no chat. Uma sala para equipes e clientes, dentro do BR Events.")}
          </p>
          <div className="hero-actions">
            {canCreate ? (
              <Link className="button button-primary service-primary-action" href={createPath}>
                {t("Criar agora")} <ArrowRight size={17} />
              </Link>
            ) : isEvent ? (
              <p className="service-access-note">{t("A criação e a operação de Web Events são realizadas pela equipe organizadora da BR Events.")}</p>
            ) : (
              <>
                <Link className="button button-primary service-primary-action" href={`/criar-conta?next=${encodeURIComponent(createPath)}`}>
                  {t("Criar conta para começar")} <ArrowRight size={17} />
                </Link>
                <Link className="button button-secondary" href={`/entrar?next=${encodeURIComponent(createPath)}`}>{t("Já tenho conta")}</Link>
              </>
            )}
          </div>
        </section>

        <ProductPreviewGallery key={kind} kind={kind} />

        <section className="container service-features" aria-label={t("Recursos do serviço")}>
          {features.map(({ icon: Icon, title, description }) => (
            <article key={title}>
              <span className="service-feature-icon" aria-hidden="true"><Icon size={17} /></span>
              <h2>{title}</h2>
              <p>{description}</p>
            </article>
          ))}
        </section>

        <section className="container service-explainer">
          <header>
            <p className="eyebrow">{t("Como funciona")}</p>
            <h2>{isEvent ? t("Audiência assiste. O organizador dirige.") : t("Todo mundo participa da conversa.")}</h2>
          </header>
          <div className="service-steps">
            <article>
              <span>01</span>
              <div>
                <h3>{isEvent ? t("Entrada do público") : t("Entrada autenticada")}</h3>
                <p>{isEvent ? t("Inscrição pública, inclusive sem conta.") : t("Participantes entram com controles colaborativos de áudio, vídeo e tela.")}</p>
              </div>
            </article>
            <article>
              <span>02</span>
              <div>
                <h3>{isEvent ? t("Controle do palco") : t("Moderação do host")}</h3>
                <p>{isEvent ? t("Microfone, câmera e tela ficam com a organização, que pode convidar pessoas ao palco mediante aceite.") : t("O host continua podendo moderar a sala a qualquer momento.")}</p>
              </div>
            </article>
          </div>
        </section>
        {isEvent && !canCreateEvent && <div className="container"><WebEventConsultation /></div>}
      </main>
    </>
  );
}

function WebEventConsultation() {
  const { t } = useI18n();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    const data = Object.fromEntries(new FormData(event.currentTarget));

    try {
      await apiClient("web-event-inquiries/", {
        method: "POST",
        body: {
          name: String(data.name),
          email: String(data.email),
          company: String(data.company || ""),
          phone: String(data.phone || ""),
          message: String(data.message || ""),
        },
      });
      setSubmitted(true);
      event.currentTarget.reset();
    } catch (reason) {
      console.error("Não foi possível enviar o interesse em Web Event.", reason);
      setError(t("Não foi possível enviar agora. Tente novamente em instantes."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="web-event-consultation" aria-labelledby="web-event-consultation-title">
      <div>
        <p className="eyebrow">{t("Organize com a BR Events")}</p>
        <h2 id="web-event-consultation-title">{t("Quer realizar um evento pela plataforma?")}</h2>
        <p>{t("A gente configura sua conta organizadora, prepara o ambiente e acompanha sua equipe até o evento estar no ar.")}</p>
        <ol>
          <li><span>01</span> {t("Você conta o que precisa.")}</li>
          <li><span>02</span> {t("Nossa equipe cria e configura sua conta.")}</li>
          <li><span>03</span> {t("Planejamos a transmissão junto com você.")}</li>
        </ol>
      </div>
      {submitted ? (
        <div className="web-event-consultation-success" role="status">
          <strong>{t("Recebemos seu interesse.")}</strong>
          <p>{t("Nossa equipe vai analisar as informações e seguir com você para estruturar o evento.")}</p>
        </div>
      ) : (
        <form onSubmit={submit} className="web-event-consultation-form">
          <label className="field"><span>{t("Nome")}</span><input name="name" autoComplete="name" required /></label>
          <label className="field"><span>{t("E-mail profissional")}</span><input name="email" type="email" autoComplete="email" required /></label>
          <label className="field"><span>{t("Empresa")}</span><input name="company" autoComplete="organization" /></label>
          <label className="field"><span>{t("Telefone")}</span><input name="phone" type="tel" autoComplete="tel" /></label>
          <label className="field field-wide"><span>{t("Como imagina seu evento?")}</span><textarea name="message" rows={3} maxLength={1200} placeholder={t("Ex.: evento para 500 pessoas, com inscrições e transmissão ao vivo.")} /></label>
          {error && <p className="form-error field-wide" role="alert">{error}</p>}
          <button className="button button-primary field-wide" type="submit" disabled={submitting}>{submitting ? t("Enviando…") : t("Quero falar com a equipe")} <ArrowRight size={17} /></button>
        </form>
      )}
    </section>
  );
}
