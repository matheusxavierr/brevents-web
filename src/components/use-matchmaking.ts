"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, apiClient } from "@/lib/api-client";
import type { MatchmakingState } from "@/lib/api-types";
import { websocketBaseUrl } from "@/lib/realtime";

export function useMatchmaking(eventId: string, presence = false, supportUpdates = false) {
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
    if (!supportUpdates || data?.role !== "coordinator") return;
    let stopped = false;
    let socket: WebSocket | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const reconnect = () => {
      if (!stopped) retry = setTimeout(() => void connect(), 4000);
    };
    async function connect() {
      try {
        const join = await apiClient<{ token: string }>(`events/${eventId}/join-token/`, { method: "POST" });
        if (stopped) return;
        const base = websocketBaseUrl(process.env.NEXT_PUBLIC_BREVENTS_WS_URL);
        socket = new WebSocket(`${base}/events/${eventId}/?token=${encodeURIComponent(join.token)}`);
        socket.onopen = () => void refresh();
        socket.onclose = reconnect;
        socket.onmessage = ({ data: message }) => {
          if (JSON.parse(message)[0] === "matchmaking.support") void refresh();
        };
      } catch {
        reconnect();
      }
    }
    void connect();
    return () => { stopped = true; clearTimeout(retry); socket?.close(); };
  }, [data?.role, eventId, refresh, supportUpdates]);
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
