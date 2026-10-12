"use client";

import { useEffect, useRef, useState } from "react";
import type { CaptionLanguage, LiveCaption } from "@/lib/api-types";
import { assertCaptionSuccess, captionError, captionLanguages, captionTimestamp, configureCaptionLanguage, defaultSpokenLanguage, isCaptionLanguage, shouldDisplayCaption, type ZoomCaptionMessage } from "@/lib/zoom-captions";

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
  const [historyError, setHistoryError] = useState("");
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
  const speakerLanguages = useRef(new Map<number, CaptionLanguage>());
  const configurationTimedOut = useRef(false);

  useEffect(() => { callbacks.current = { onCaption, saveTranscript }; }, [onCaption, saveTranscript]);
  useEffect(() => { languages.current = { spokenLanguage, captionLanguage }; }, [spokenLanguage, captionLanguage]);

  useEffect(() => {
    if (!client) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let noticeTimer: ReturnType<typeof setTimeout> | undefined;
    const ltt = client.getLiveTranscriptionClient();
    const languageDirectory = speakerLanguages.current;
    const sendLanguage = async (receiverId?: number) => {
      const language = speakerLanguages.current.get(client.getCurrentUserInfo().userId);
      if (!language) return;
      try {
        const result = await client.getCommandClient().send(JSON.stringify({ type: "caption.language", language }), receiverId);
        if (result && typeof result === "object" && "type" in result) throw result;
      } catch (reason) {
        if (active) console.warn("Não foi possível sincronizar o idioma de fala das legendas.", reason);
      }
    };
    const handleLanguageMessage = (payload: { text: string; senderId: string }) => {
      if (!active) return;
      const senderId = Number(payload.senderId);
      if (!client.getAllUser().some((participant) => participant.userId === senderId)) return;
      let command: unknown;
      try { command = JSON.parse(payload.text); }
      catch (reason) { if (reason instanceof SyntaxError) return; throw reason; }
      if (!command || typeof command !== "object" || !("type" in command)) return;
      if (command.type === "caption.language" && "language" in command && typeof command.language === "string" && isCaptionLanguage(command.language)) {
        speakerLanguages.current.set(senderId, command.language);
      } else if (command.type === "caption.language.request") void sendLanguage(senderId);
    };
    const requestLanguages = () => {
      if (!active) return;
      void sendLanguage();
      void client.getCommandClient().send(JSON.stringify({ type: "caption.language.request" }))
        .catch((reason) => { if (active) console.warn("Não foi possível consultar os idiomas dos participantes.", reason); });
    };
    const handleChannelStatus = (status: string) => { if (status === "Connected") requestLanguages(); };
    const handleUsersAdded = (users: Array<{ userId: number }>) => {
      for (const user of users) void sendLanguage(user.userId);
    };
    const removeLanguages = () => {
      const users = new Set(client.getAllUser().map((user) => user.userId));
      for (const id of speakerLanguages.current.keys()) if (!users.has(id)) speakerLanguages.current.delete(id);
    };
    const handleMessage = (message: ZoomCaptionMessage) => {
      if (!active || typeof message.msgId !== "string" || typeof message.text !== "string" || !message.text.trim() || !Number.isFinite(message.timestamp)) return;
      const original = message.language === 400;
      const selected = languages.current.captionLanguage;
      if (shouldDisplayCaption(message, selected, speakerLanguages.current.get(message.userId))) {
        if (configurationTimedOut.current
          && ltt.getCurrentTranscriptionLanguage()?.code === captionLanguages[languages.current.spokenLanguage].zoom
          && ltt.getCurrentTranslationLanguage()?.code === (selected ? captionLanguages[selected].translation : undefined)) {
          configurationTimedOut.current = false;
          setError("");
        }
        setOverlay({ speaker: message.displayName, text: message.text });
        clearTimeout(timer);
        timer = setTimeout(() => { if (active) setOverlay(null); }, 8_000);
      }
      const key = `${sessionId}:${message.msgId}`;
      if (!original || message.done !== true || finalized.current.has(key)) return;
      finalized.current.add(key);
      const own = message.userId === client.getCurrentUserInfo().userId;
      const language = speakerLanguages.current.get(client.getCurrentUserInfo().userId) ?? languages.current.spokenLanguage;
      callbacks.current.onCaption?.({
        id: `zoom:${sessionId}:${message.msgId}`,
        message_id: message.msgId,
        zoom_session: sessionId,
        speaker_identity: String(message.userId),
        speaker_name: message.displayName,
        source_language: speakerLanguages.current.get(message.userId) ?? null,
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
          if (active) setHistoryError("A legenda está funcionando, mas não foi possível salvar uma fala no histórico.");
        });
    };
    const handleStatus = () => {
      const status = ltt.getLiveTranscriptionStatus();
      const keys = Object.keys(captionLanguages) as CaptionLanguage[];
      setAvailableLanguages(keys.filter((key) => status.transcriptionLanguage.split(";").includes(captionLanguages[key].zoom)));
      const targets = new Set(status.translationLanguage.flatMap((pair) => pair.translatedToLanguage.split(";")));
      setTranslationLanguages(status.isLiveTranslationEnabled ? keys.filter((key) => targets.has(captionLanguages[key].translation)) : []);
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
    client.on("command-channel-message", handleLanguageMessage);
    client.on("command-channel-status", handleChannelStatus);
    client.on("user-added", handleUsersAdded);
    client.on("user-removed", removeLanguages);
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
          requestLanguages();
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
      client.off("command-channel-message", handleLanguageMessage);
      client.off("command-channel-status", handleChannelStatus);
      client.off("user-added", handleUsersAdded);
      client.off("user-removed", removeLanguages);
      languageDirectory.clear();
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
        await configureCaptionLanguage(() => ltt.getCurrentTranscriptionLanguage(), () => ltt.setSpeakingLanguage(captionLanguages[spokenLanguage].zoom as SpeakingLanguage), captionLanguages[spokenLanguage].zoom);
        if (!active) return;
        speakerLanguages.current.set(client.getCurrentUserInfo().userId, spokenLanguage);
        // Only language metadata is shared; all transcript and translation text
        // still comes directly from Zoom's caption-message events.
        void client.getCommandClient().send(JSON.stringify({ type: "caption.language", language: spokenLanguage }))
          .catch((reason) => { if (active) console.warn("Não foi possível anunciar o idioma de fala.", reason); });
        const target = captionLanguage ? captionLanguages[captionLanguage].translation : undefined;
        await configureCaptionLanguage(() => ltt.getCurrentTranslationLanguage(), () => ltt.setTranslationLanguage(target as SpeakingLanguage | undefined), target);
        if (active) { configurationTimedOut.current = false; setError(""); }
      } catch (reason) {
        if (!active) return;
        const timedOut = !!reason && typeof reason === "object" && "type" in reason && reason.type === "OPERATION_TIMEOUT";
        configurationTimedOut.current = timedOut;
        if (timedOut) console.warn("O Zoom ainda não confirmou o idioma solicitado para as legendas.", reason);
        else console.error("Não foi possível selecionar o idioma das legendas do Zoom.", reason);
        setError(captionError(reason));
      }
    });
    return () => { active = false; };
  }, [client, ready, spokenLanguage, captionLanguage, retry]);

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
  return { spokenLanguage, captionLanguage, selectSpokenLanguage, selectCaptionLanguage, error: error || historyError, ready, availableLanguages, translationLanguages, overlay, notice, retry: () => setRetry((value) => value + 1) };
}
