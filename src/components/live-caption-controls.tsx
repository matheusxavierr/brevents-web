"use client";

import { useEffect, useRef, useState } from "react";
import { Captions, Languages, X } from "lucide-react";
import type { CaptionLanguage } from "@/lib/api-types";

type SpeechResult = { isFinal: boolean; 0: { transcript: string } };
type SpeechRecognitionEvent = Event & { resultIndex: number; results: ArrayLike<SpeechResult> };
type SpeechRecognitionErrorEvent = Event & { error: string };
type SpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
};
type SpeechRecognitionConstructor = new () => SpeechRecognition;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

const languageLabels: Record<CaptionLanguage, string> = {
  "pt-BR": "Português",
  "en-US": "English",
};

type Props = {
  canSpeak: boolean;
  microphoneOn: boolean;
  captionLanguage: CaptionLanguage | null;
  onCaptionLanguageChange: (language: CaptionLanguage | null) => void;
  onTranscript: (text: string, sourceLanguage: CaptionLanguage) => Promise<void>;
};

export function LiveCaptionControls({
  canSpeak,
  microphoneOn,
  captionLanguage,
  onCaptionLanguageChange,
  onTranscript,
}: Props) {
  const menu = useRef<HTMLDivElement>(null);
  const restartTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const translationQueue = useRef(Promise.resolve());
  const [menuOpen, setMenuOpen] = useState(false);
  const [spokenLanguage, setSpokenLanguage] = useState<CaptionLanguage>("pt-BR");
  const [recognitionSupported, setRecognitionSupported] = useState(true);
  const [recognitionError, setRecognitionError] = useState("");

  useEffect(() => {
    const savedCaptionLanguage = window.localStorage.getItem("brevents-caption-language");
    if (savedCaptionLanguage === "pt-BR" || savedCaptionLanguage === "en-US") {
      onCaptionLanguageChange(savedCaptionLanguage);
    }
    const savedSpokenLanguage = window.localStorage.getItem("brevents-spoken-language");
    if (savedSpokenLanguage === "pt-BR" || savedSpokenLanguage === "en-US") {
      setSpokenLanguage(savedSpokenLanguage);
    } else if (navigator.language.toLowerCase().startsWith("en")) {
      setSpokenLanguage("en-US");
    }
  }, [onCaptionLanguageChange]);

  useEffect(() => {
    if (!menuOpen) return;
    const closeMenu = (event: MouseEvent) => {
      if (!menu.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("mousedown", closeMenu);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("mousedown", closeMenu);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!canSpeak || !microphoneOn) return;
    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) {
      setRecognitionSupported(false);
      return;
    }
    setRecognitionSupported(true);
    setRecognitionError("");
    const recognition = new Recognition();
    let active = true;
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = spokenLanguage;
    recognition.onresult = (event) => {
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const text = result[0]?.transcript.trim();
        if (!result.isFinal || !text) continue;
        translationQueue.current = translationQueue.current
          .then(() => onTranscript(text, spokenLanguage))
          .then(() => setRecognitionError(""))
          .catch((translationError: unknown) => {
            console.error("Não foi possível traduzir a legenda ao vivo.", translationError);
            setRecognitionError(translationError instanceof Error ? translationError.message : "Falha ao traduzir a fala.");
          });
      }
    };
    recognition.onerror = (event) => {
      if (event.error !== "no-speech" && event.error !== "aborted") {
        setRecognitionError("O navegador não conseguiu transcrever o microfone.");
      }
    };
    recognition.onend = () => {
      if (!active) return;
      restartTimer.current = setTimeout(() => {
        try {
          recognition.start();
        } catch (startError) {
          console.warn("A transcrição ainda estava reiniciando.", startError);
        }
      }, 250);
    };
    try {
      recognition.start();
    } catch (startError) {
      console.error("Não foi possível iniciar a transcrição no navegador.", startError);
      setRecognitionError("Não foi possível iniciar a transcrição.");
    }
    return () => {
      active = false;
      if (restartTimer.current) clearTimeout(restartTimer.current);
      recognition.onend = null;
      recognition.stop();
    };
  }, [canSpeak, microphoneOn, onTranscript, spokenLanguage]);

  function selectCaptionLanguage(language: CaptionLanguage | null) {
    onCaptionLanguageChange(language);
    if (language) window.localStorage.setItem("brevents-caption-language", language);
    else window.localStorage.removeItem("brevents-caption-language");
    setMenuOpen(false);
  }

  function selectSpokenLanguage(language: CaptionLanguage) {
    setSpokenLanguage(language);
    window.localStorage.setItem("brevents-spoken-language", language);
  }

  return <div className="live-caption-control" ref={menu}>
    <button type="button" className={captionLanguage ? "active" : "muted"} onClick={() => setMenuOpen((open) => !open)} aria-expanded={menuOpen} aria-controls="live-caption-menu">
      <Captions size={19} /><span>{captionLanguage ? `CC: ${captionLanguage === "pt-BR" ? "PT" : "EN"}` : "Legendas"}</span>
    </button>
    {menuOpen && <div className="live-caption-menu" id="live-caption-menu" role="dialog" aria-label="Configurar legendas">
      <header><span><Captions size={18} /><strong>Legendas</strong></span><button type="button" onClick={() => setMenuOpen(false)} aria-label="Fechar"><X size={16} /></button></header>
      <p>Em qual idioma você quer ler?</p>
      <div className="live-caption-options">
        <button type="button" className={!captionLanguage ? "selected" : ""} onClick={() => selectCaptionLanguage(null)}>Desligadas</button>
        {(Object.keys(languageLabels) as CaptionLanguage[]).map((language) => <button type="button" className={captionLanguage === language ? "selected" : ""} onClick={() => selectCaptionLanguage(language)} key={language}>{languageLabels[language]}</button>)}
      </div>
      {canSpeak && <div className="live-caption-speaker-setting">
        <span><Languages size={16} /><span><strong>Idioma da minha fala</strong><small>Defina uma vez para melhorar a transcrição.</small></span></span>
        <select value={spokenLanguage} onChange={(event) => selectSpokenLanguage(event.target.value as CaptionLanguage)} aria-label="Idioma da minha fala">
          {(Object.keys(languageLabels) as CaptionLanguage[]).map((language) => <option value={language} key={language}>{languageLabels[language]}</option>)}
        </select>
      </div>}
      {canSpeak && microphoneOn && recognitionSupported && <small className="live-caption-listening"><span /> Transcrevendo seu microfone</small>}
      {canSpeak && !recognitionSupported && <p className="live-caption-warning">A transcrição requer Chrome ou Edge neste primeiro teste.</p>}
      {recognitionError && <p className="live-caption-warning" role="alert">{recognitionError}</p>}
    </div>}
  </div>;
}
