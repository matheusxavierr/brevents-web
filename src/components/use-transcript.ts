"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, apiClient } from "@/lib/api-client";
import type { LiveCaption } from "@/lib/api-types";
import { mergeTranscriptHistory } from "@/lib/zoom-captions";
import { downloadTranscript, loadCompleteTranscript, type TranscriptCursor } from "@/lib/transcript-export";

type Props = { sessionId?: number; eventId: string; guest?: boolean; enabled: boolean; refreshKey?: boolean; title: string; roomName: string; timeZone: string };

export function useTranscript({ sessionId, eventId, guest = false, enabled, refreshKey, title, roomName, timeZone }: Props) {
  const key = `${eventId}:${sessionId ?? "none"}:${guest}`;
  const [data, setData] = useState<{ key: string; captions: LiveCaption[] }>({ key, captions: [] });
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const downloadBusy = useRef(false);
  const captions = data.key === key ? data.captions : [];

  const fetchPage = useCallback(async (cursor?: TranscriptCursor) => {
    if (!sessionId) return [];
    const query = new URLSearchParams(cursor);
    if (!guest) return apiClient<LiveCaption[]>(`zoom-sessions/${sessionId}/captions/?${query}`);
    query.set("eventId", eventId);
    const response = await fetch(`/api/guest/zoom/${sessionId}/captions?${query}`, { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new ApiError(response.status, payload);
    return payload as LiveCaption[];
  }, [eventId, guest, sessionId]);

  useEffect(() => {
    if (!enabled || !sessionId) return;
    let active = true;
    void (async () => {
      setLoading(true);
      try {
        const history = await fetchPage();
        if (active) {
          setData((current) => ({ key, captions: mergeTranscriptHistory(history, current.key === key ? current.captions : []) }));
          setError("");
        }
      } catch (reason) {
        console.error("Não foi possível carregar a transcrição da sala.", reason);
        if (active) setError("Não foi possível carregar o histórico. As novas falas continuam aparecendo ao vivo.");
      } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [enabled, fetchPage, key, refreshKey, sessionId]);

  const addCaption = useCallback((caption: LiveCaption) => {
    if (caption.zoom_session !== sessionId) return;
    setData((current) => ({ key, captions: mergeTranscriptHistory(current.key === key ? current.captions : [], [caption]) }));
  }, [key, sessionId]);

  async function download() {
    if (!sessionId || downloadBusy.current) return;
    downloadBusy.current = true;
    setDownloading(true);
    try {
      const history = await loadCompleteTranscript(fetchPage);
      const complete = mergeTranscriptHistory(history, captions);
      if (!complete.length) { setError("Ainda não há falas registradas para baixar."); return; }
      downloadTranscript(complete, title, roomName, timeZone);
      setError("");
    } catch (reason) {
      console.error("Não foi possível baixar a transcrição completa.", reason);
      setError("Não foi possível baixar a transcrição completa. Tente novamente.");
    } finally { downloadBusy.current = false; setDownloading(false); }
  }

  return { captions, loading, downloading, error, addCaption, download };
}
