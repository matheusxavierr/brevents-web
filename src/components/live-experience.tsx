"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Fullscreen, Heart, Send, Settings, ThumbsUp, Volume2 } from "lucide-react";
import { Brand } from "./brand";
import { LanguageSwitcher } from "./language-switcher";
import { useI18n } from "./i18n-provider";

type Tab = "chat" | "questions" | "poll";

const initialMessages = [
  { initials: "AR", name: "Ana Ribeiro", time: "09:03", text: "Bom dia! Muito feliz de estar aqui com vocês." },
  { initials: "JP", name: "João Pedro", time: "09:04", text: "A qualidade da transmissão está ótima por aqui 👏" },
  { initials: "BC", name: "Beatriz Campos", time: "09:06", text: "Esse ponto sobre comunidade faz muito sentido." },
];

export function LiveExperience() {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("chat");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState(initialMessages);
  const [liked, setLiked] = useState(false);

  function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = message.trim();
    if (!text) return;
    setMessages((current) => [...current, { initials: "VC", name: "Você", time: "agora", text }]);
    setMessage("");
  }

  return (
    <main className="live-page">
      <header className="live-header">
        <div className="container live-header-inner">
          <Brand />
          <span className="live-header-title">Future Summit 2026 · {t("Auditório principal")}</span>
          <LanguageSwitcher className="live-language" />
          <Link className="button live-exit" href="/agenda">
            <ChevronLeft size={16} aria-hidden="true" /> {t("Sair da sala")}
          </Link>
        </div>
      </header>

      <div className="live-layout">
        <section className="video-column" aria-label={t("Transmissão ao vivo")}>
          <div className="video-player">
            <div className="video-center">
              <span className="live-pill"><span className="live-dot" /> {t("Ao vivo · 1.284 assistindo")}</span>
              <h1>{t("O futuro dos eventos híbridos")}</h1>
              <p>{t("com Marina Costa e Lucas Almeida")}</p>
            </div>
            <div className="player-controls">
              <div className="player-controls-group">
                <button className="control-button" type="button" aria-label={t("Ajustar volume")}><Volume2 size={18} /></button>
                <button
                  className={`control-button${liked ? " active" : ""}`}
                  type="button"
                  aria-label={liked ? t("Remover reação") : t("Enviar reação")}
                  aria-pressed={liked}
                  onClick={() => setLiked((value) => !value)}
                >
                  <Heart size={18} fill={liked ? "currentColor" : "none"} />
                </button>
              </div>
              <div className="player-controls-group">
                <button className="control-button" type="button" aria-label={t("Configurações")}><Settings size={18} /></button>
                <button className="control-button" type="button" aria-label={t("Tela cheia")}><Fullscreen size={18} /></button>
              </div>
            </div>
          </div>
          <div className="session-bar">
            <div><h2>{t("O futuro dos eventos híbridos")}</h2><p>{t("09:00–10:00 · Produto e inovação")}</p></div>
            <div className="speaker-stack" aria-label={t("Palestrantes")}><span className="avatar">MC</span><span className="avatar">LA</span></div>
          </div>
        </section>

        <aside className="interaction-panel" aria-label={t("Interações da sessão")}>
          <div className="interaction-tabs" role="tablist" aria-label={t("Interações")}>
            {(["chat", "questions", "poll"] as Tab[]).map((item) => (
              <button
                key={item}
                id={`tab-${item}`}
                className={`interaction-tab${tab === item ? " active" : ""}`}
                type="button"
                role="tab"
                aria-selected={tab === item}
                aria-controls={`panel-${item}`}
                onClick={() => setTab(item)}
              >
                {item === "chat" ? t("Chat") : item === "questions" ? t("Perguntas") : t("Enquete")}
              </button>
            ))}
          </div>

          <div className="interaction-content" id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`}>
            {tab === "chat" && messages.map((item, index) => (
              <article className="message" key={`${item.name}-${index}`}>
                <span className="avatar">{item.initials}</span>
                <div><strong>{item.name === "Você" ? t("Você") : item.name}</strong><time>{item.time === "agora" ? t("agora") : item.time}</time><p>{t(item.text)}</p></div>
              </article>
            ))}

            {tab === "questions" && (
              <>
                <article className="question-card">
                  <p>{t("As gravações e os materiais serão disponibilizados depois?")}</p>
                  <button className="vote-button" type="button"><ThumbsUp size={14} /> {t("{count} votos", { count: 24 })}</button>
                </article>
                <article className="question-card">
                  <p>{t("Como medir o impacto da comunidade depois do evento?")}</p>
                  <button className="vote-button" type="button"><ThumbsUp size={14} /> {t("{count} votos", { count: 17 })}</button>
                </article>
              </>
            )}

            {tab === "poll" && (
              <article className="poll-card">
                <p><strong>{t("Como você está participando hoje?")}</strong></p>
                <button className="poll-option" type="button"><span>{t("De casa")}</span><span>62%</span></button>
                <button className="poll-option" type="button"><span>{t("Do escritório")}</span><span>28%</span></button>
                <button className="poll-option" type="button"><span>{t("Em grupo")}</span><span>10%</span></button>
              </article>
            )}
          </div>

          {tab === "chat" && (
            <form className="composer" onSubmit={sendMessage}>
              <label className="sr-only" htmlFor="chat-message">{t("Mensagem")}</label>
              <input
                id="chat-message"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder={t("Escreva uma mensagem")}
                autoComplete="off"
              />
              <button className="icon-button" type="submit" aria-label={t("Enviar mensagem")}><Send size={17} /></button>
            </form>
          )}
        </aside>
      </div>
    </main>
  );
}
