"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Fullscreen, Heart, Send, Settings, ThumbsUp, Volume2 } from "lucide-react";
import { Brand } from "./brand";

type Tab = "chat" | "questions" | "poll";

const initialMessages = [
  { initials: "AR", name: "Ana Ribeiro", time: "09:03", text: "Bom dia! Muito feliz de estar aqui com vocês." },
  { initials: "JP", name: "João Pedro", time: "09:04", text: "A qualidade da transmissão está ótima por aqui 👏" },
  { initials: "BC", name: "Beatriz Campos", time: "09:06", text: "Esse ponto sobre comunidade faz muito sentido." },
];

export function LiveExperience() {
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
          <span className="live-header-title">Future Summit 2026 · Auditório principal</span>
          <Link className="button live-exit" href="/agenda">
            <ChevronLeft size={16} aria-hidden="true" /> Sair da sala
          </Link>
        </div>
      </header>

      <div className="live-layout">
        <section className="video-column" aria-label="Transmissão ao vivo">
          <div className="video-player">
            <div className="video-center">
              <span className="live-pill"><span className="live-dot" /> Ao vivo · 1.284 assistindo</span>
              <h1>O futuro dos eventos híbridos</h1>
              <p>com Marina Costa e Lucas Almeida</p>
            </div>
            <div className="player-controls">
              <div className="player-controls-group">
                <button className="control-button" type="button" aria-label="Ajustar volume"><Volume2 size={18} /></button>
                <button
                  className={`control-button${liked ? " active" : ""}`}
                  type="button"
                  aria-label={liked ? "Remover reação" : "Enviar reação"}
                  aria-pressed={liked}
                  onClick={() => setLiked((value) => !value)}
                >
                  <Heart size={18} fill={liked ? "currentColor" : "none"} />
                </button>
              </div>
              <div className="player-controls-group">
                <button className="control-button" type="button" aria-label="Configurações"><Settings size={18} /></button>
                <button className="control-button" type="button" aria-label="Tela cheia"><Fullscreen size={18} /></button>
              </div>
            </div>
          </div>
          <div className="session-bar">
            <div><h2>O futuro dos eventos híbridos</h2><p>09:00–10:00 · Produto e inovação</p></div>
            <div className="speaker-stack" aria-label="Palestrantes"><span className="avatar">MC</span><span className="avatar">LA</span></div>
          </div>
        </section>

        <aside className="interaction-panel" aria-label="Interações da sessão">
          <div className="interaction-tabs" role="tablist" aria-label="Interações">
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
                {item === "chat" ? "Chat" : item === "questions" ? "Perguntas" : "Enquete"}
              </button>
            ))}
          </div>

          <div className="interaction-content" id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`}>
            {tab === "chat" && messages.map((item, index) => (
              <article className="message" key={`${item.name}-${index}`}>
                <span className="avatar">{item.initials}</span>
                <div><strong>{item.name}</strong><time>{item.time}</time><p>{item.text}</p></div>
              </article>
            ))}

            {tab === "questions" && (
              <>
                <article className="question-card">
                  <p>As gravações e os materiais serão disponibilizados depois?</p>
                  <button className="vote-button" type="button"><ThumbsUp size={14} /> 24 votos</button>
                </article>
                <article className="question-card">
                  <p>Como medir o impacto da comunidade depois do evento?</p>
                  <button className="vote-button" type="button"><ThumbsUp size={14} /> 17 votos</button>
                </article>
              </>
            )}

            {tab === "poll" && (
              <article className="poll-card">
                <p><strong>Como você está participando hoje?</strong></p>
                <button className="poll-option" type="button"><span>De casa</span><span>62%</span></button>
                <button className="poll-option" type="button"><span>Do escritório</span><span>28%</span></button>
                <button className="poll-option" type="button"><span>Em grupo</span><span>10%</span></button>
              </article>
            )}
          </div>

          {tab === "chat" && (
            <form className="composer" onSubmit={sendMessage}>
              <label className="sr-only" htmlFor="chat-message">Mensagem</label>
              <input
                id="chat-message"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Escreva uma mensagem"
                autoComplete="off"
              />
              <button className="icon-button" type="submit" aria-label="Enviar mensagem"><Send size={17} /></button>
            </form>
          )}
        </aside>
      </div>
    </main>
  );
}
