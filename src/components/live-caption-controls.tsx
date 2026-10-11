"use client";
import { useEffect, useRef, useState } from "react";
import { Captions, Languages, X } from "lucide-react";
import type { CaptionLanguage } from "@/lib/api-types";
import { captionLanguages } from "@/lib/zoom-captions";

type Props = {
  canSpeak: boolean;
  microphoneOn: boolean;
  captionLanguage: CaptionLanguage | null;
  spokenLanguage: CaptionLanguage;
  onCaptionLanguageChange: (language: CaptionLanguage | null) => void;
  onSpokenLanguageChange: (language: CaptionLanguage) => void;
  availableLanguages: CaptionLanguage[];
  translationLanguages: CaptionLanguage[];
  ready: boolean;
  error: string;
  onRetry: () => void;
};
export function LiveCaptionControls(props: Props) {
  const menu = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: MouseEvent) => {
      if (!menu.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setMenuOpen(false); };
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", escape);
    };
  }, [menuOpen]);
  return <div className="live-caption-control" ref={menu}>
    <button type="button" className={props.captionLanguage ? "active" : "muted"} onClick={() => setMenuOpen((open) => !open)} aria-expanded={menuOpen} aria-controls="live-caption-menu">
      <Captions size={19} /><span>{props.captionLanguage ? `CC: ${captionLanguages[props.captionLanguage].short}` : "Legendas"}</span>
    </button>
    {menuOpen && <div className="live-caption-menu" id="live-caption-menu" role="dialog" aria-label="Configurar legendas">
      <header><span><Captions size={18} /><strong>Legendas do Zoom</strong></span><button type="button" onClick={() => setMenuOpen(false)} aria-label="Fechar"><X size={16} /></button></header>
      <p>Em qual idioma você quer ler?</p>
      {!props.ready && !props.error && <p role="status">Conectando às legendas do Zoom…</p>}
      <div className="live-caption-options">
        <button type="button" className={!props.captionLanguage ? "selected" : ""} onClick={() => props.onCaptionLanguageChange(null)}>Ocultar legendas</button>
        {props.translationLanguages.map((language) => <button type="button" className={props.captionLanguage === language ? "selected" : ""} onClick={() => props.onCaptionLanguageChange(language)} key={language}>{captionLanguages[language].label}</button>)}
      </div>
      {props.canSpeak && <div className="live-caption-speaker-setting">
        <span><Languages size={16} /><span><strong>Idioma da minha fala</strong><small>Informe o idioma usado no seu microfone.</small></span></span>
        <select value={props.spokenLanguage} onChange={(event) => props.onSpokenLanguageChange(event.target.value as CaptionLanguage)} aria-label="Idioma da minha fala" disabled={!props.ready}>
          {props.availableLanguages.map((language) => <option value={language} key={language}>{captionLanguages[language].label}</option>)}
        </select>
      </div>}
      {props.ready && <small className="live-caption-listening"><span /> {props.canSpeak && props.microphoneOn ? "Zoom transcrevendo seu microfone" : "Transcrição do Zoom ativa"}</small>}
      <p><small>Ocultar legendas não interrompe a transcrição da sala.</small></p>
      {props.error && <div className="live-caption-warning" role="alert"><p>{props.error}</p><button type="button" onClick={props.onRetry}>Tentar novamente</button></div>}
    </div>}
  </div>;
}
