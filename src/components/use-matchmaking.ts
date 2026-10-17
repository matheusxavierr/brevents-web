"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, apiClient } from "@/lib/api-client";
import type { MatchmakingState } from "@/lib/api-types";

export function useMatchmaking(eventId: string, presence = false) {
  const [data, setData] = useState<MatchmakingState | null>(null);
  const [error, setError] = useState("");
  const [now, setNow] = useState(0);
  const offset = useRef(0);
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const version = ++generation.current;
    try {
      const next = await apiClient<MatchmakingState>(`matchmaking/state/?event=${eventId}`);
      if (version !== generation.current) return;
      offset.current = Date.parse(next.server_time) - Date.now();
      setNow(Date.now() + offset.current);
      setData((previous) => previous && JSON.stringify({ ...previous, server_time: "" }) === JSON.stringify({ ...next, server_time: "" }) ? previous : next);
      setError("");
    } catch (reason) {
      if (version === generation.current) {
        if (reason instanceof ApiError && (reason.status === 401 || reason.status === 403)) setData(null);
        setError(reason instanceof Error ? reason.message : "Não foi possível atualizar as rodadas.");
      }
    }
  }, [eventId]);
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => { await refresh(); if (active) timer = setTimeout(() => void poll(), 4000); };
    void poll();
    const clock = setInterval(() => setNow(Date.now() + offset.current), 1000);
    return () => { active = false; generation.current += 1; clearTimeout(timer); clearInterval(clock); };
  }, [refresh]);
  useEffect(() => {
    if (!presence) return;
    const heartbeat = () => apiClient("networking-presences/heartbeat/", { method: "POST", body: { event: eventId } })
      .catch((reason) => { console.warn("Não foi possível atualizar a presença no matchmaking.", reason); });
    void heartbeat();
    const timer = setInterval(() => void heartbeat(), 15000);
    return () => clearInterval(timer);
  }, [eventId, presence]);
  return { data, error, now, refresh };
}

export function roundClock(expiresAt: string, now: number) {
  const seconds = Math.max(0, Math.ceil((Date.parse(expiresAt) - now) / 1000));
  return `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}
