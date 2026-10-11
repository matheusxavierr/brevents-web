"use client";

import { useEffect, useRef, useState } from "react";
import type { CaptionLanguage, LiveCaption } from "@/lib/api-types";
import { assertCaptionSuccess, captionError, captionLanguages, captionTimestamp, defaultSpokenLanguage, isCaptionLanguage, type ZoomCaptionMessage } from "@/lib/zoom-captions";

type ZoomClient = ReturnType<typeof import("@zoom/videosdk")["default"]["createClient"]>;
type SpeakingLanguage = Parameters<ReturnType<ZoomClient["getLiveTranscriptionClient"]>["setSpeakingLanguage"]>[0];
type Props = {
  client: ZoomClient | null;
  sessionId: number;
  onCaption?: (caption: LiveCaption) => void;
  saveTranscript: (text: string, language: CaptionLanguage, messageId: string) => Promise<void>;
};

export function useZoomCaptions({ client, sessionId, onCaption, saveTranscript }: Props) {
  const [spokenLanguage, setSpokenLanguage] = useState<CaptionLanguage>(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("brevents-spoken-language") : null;
    return isCaptionLanguage(saved) ? saved : defaultSpokenLanguage();
  });
  const [captionLanguage, setCaptionLanguage] = useState<CaptionLanguage | null>(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("brevents-caption-language") : null;
    return isCaptionLanguage(saved) ? saved : null;
  });
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [retry, setRetry] = useState(0);
  const [availableLanguages, setAvailableLanguages] = useState<CaptionLanguage[]>([]);
  const [translationLanguages, setTranslationLanguages] = useState<CaptionLanguage[]>([]);
  const [overlay, setOverlay] = useState<{ speaker: string; text: string } | null>(null);
  const [notice, setNotice] = useState(false);
  const callbacks = useRef({ onCaption, saveTranscript });
  const languages = useRef({ spokenLanguage, captionLanguage });
  const finalized = useRef(new Set<string>());
  const saveQueue = useRef(Promise.resolve());
  const configurationQueue = useRef(Promise.resolve());

  useEffect(() => { callbacks.current = { onCaption, saveTranscript }; }, [onCaption, saveTranscript]);
  useEffect(() => { languages.current = { spokenLanguage, captionLanguage }; }, [spokenLanguage, captionLanguage]);

  useEffect(() => {
    if (!client) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let noticeTimer: ReturnType<typeof setTimeout> | undefined;
    const ltt = client.getLiveTranscriptionClient();
    const handleMessage = (message: ZoomCaptionMessage) => {
      if (!active || typeof message.msgId !== "string" || typeof message.text !== "string" || !message.text.trim() || !Number.isFinite(message.timestamp)) return;
      const original = message.language === 400;
      const selected = languages.current.captionLanguage;
      if (selected && message.language === captionLanguages[selected].code) {
        setOverlay({ speaker: message.displayName, text: message.text });
        clearTimeout(timer);
        timer = setTimeout(() => { if (active) setOverlay(null); }, 8_000);
      }
      const key = `${sessionId}:${message.msgId}`;
      if (!original || message.done !== true || finalized.current.has(key)) return;
      finalized.current.add(key);
      const own = message.userId === client.getCurrentUserInfo().userId;
      const language = languages.current.spokenLanguage;
      callbacks.current.onCaption?.({
        id: `zoom:${sessionId}:${message.msgId}`,
        message_id: message.msgId,
        zoom_session: sessionId,
        speaker_identity: String(message.userId),
        speaker_name: message.displayName,
        source_language: own ? language : null,
        original_text: message.text,
        translations: {},
        created_at: captionTimestamp(message.timestamp),
      });
      // Each speaker persists only their own original text; viewers never submit captions.
      const saveTranscript = callbacks.current.saveTranscript;
      if (own) saveQueue.current = saveQueue.current
        .then(() => saveTranscript(message.text, language, message.msgId))
        .catch((reason: unknown) => {
          console.error("Não foi possível salvar a transcrição do Zoom.", reason);
          if (active) setError("A legenda está funcionando, mas não foi possível salvar uma fala no histórico.");
        });
    };
    const handleStatus = () => {
      const status = ltt.getLiveTranscriptionStatus();
      const keys = Object.keys(captionLanguages) as CaptionLanguage[];
      setAvailableLanguages(keys.filter((key) => status.transcriptionLanguage.split(";").includes(captionLanguages[key].zoom)));
      const targets = new Set(status.translationLanguage.flatMap((pair) => pair.translatedToLanguage.split(";")));
      setTranslationLanguages(status.isLiveTranslationEnabled ? keys.filter((key) => targets.has(captionLanguages[key].zoom)) : []);
      if (status.isHostDisableCaptions) { setReady(false); setError("As legendas foram desativadas pelo organizador."); }
    };
    const handleEnabled = (enabled: boolean) => {
      if (!active) return;
      handleStatus();
      setReady(enabled);
    };
    const handleHostDisabled = (disabled: boolean) => {
      if (!active) return;
      if (disabled) {
        setReady(false);
        setOverlay(null);
        setError("As legendas foram desativadas pelo organizador.");
      } else setRetry((value) => value + 1);
    };
    client.on("caption-message", handleMessage);
    client.on("caption-status", handleStatus);
    client.on("caption-enable", handleEnabled);
    client.on("caption-host-disable", handleHostDisabled);
    configurationQueue.current = configurationQueue.current.then(async () => {
      if (!active) return;
      setOverlay(null);
      try {
        assertCaptionSuccess(await ltt.startLiveTranscription());
        if (!active) return;
        handleStatus();
        const hostDisabled = ltt.getLiveTranscriptionStatus().isHostDisableCaptions;
        setReady(!hostDisabled);
        if (!hostDisabled) {
          setError("");
          setNotice(true);
          noticeTimer = setTimeout(() => { if (active) setNotice(false); }, 4_000);
        }
      } catch (reason) {
        console.error("Não foi possível iniciar a transcrição nativa do Zoom.", reason);
        if (active) { setReady(false); setError(captionError(reason)); }
      }
    });
    return () => {
      active = false;
      clearTimeout(timer);
      clearTimeout(noticeTimer);
      client.off("caption-message", handleMessage);
      client.off("caption-status", handleStatus);
      client.off("caption-enable", handleEnabled);
      client.off("caption-host-disable", handleHostDisabled);
      // Never call disableCaptions here: it disables the whole session, not just this viewer.
    };
  }, [client, sessionId, retry]);

  useEffect(() => {
    if (!client || !ready) return;
    let active = true;
    const ltt = client.getLiveTranscriptionClient();
    configurationQueue.current = configurationQueue.current.then(async () => {
      if (!active) return;
      try {
        assertCaptionSuccess(await ltt.setSpeakingLanguage(captionLanguages[spokenLanguage].zoom as SpeakingLanguage));
        if (!active) return;
        assertCaptionSuccess(await ltt.setTranslationLanguage(captionLanguage ? captionLanguages[captionLanguage].zoom as SpeakingLanguage : undefined));
        if (active) setError("");
      } catch (reason) {
        console.error("Não foi possível selecionar o idioma das legendas do Zoom.", reason);
        if (active) setError(captionError(reason));
      }
    });
    return () => { active = false; };
  }, [client, ready, spokenLanguage, captionLanguage]);

  function selectSpokenLanguage(language: CaptionLanguage) {
    localStorage.setItem("brevents-spoken-language", language);
    setSpokenLanguage(language);
  }
  function selectCaptionLanguage(language: CaptionLanguage | null) {
    if (language) localStorage.setItem("brevents-caption-language", language);
    else localStorage.removeItem("brevents-caption-language");
    setCaptionLanguage(language);
    setOverlay(null);
  }
  return { spokenLanguage, captionLanguage, selectSpokenLanguage, selectCaptionLanguage, error, ready, availableLanguages, translationLanguages, overlay, notice, retry: () => setRetry((value) => value + 1) };
}
