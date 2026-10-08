"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronUp, Copy, Maximize2, Mic, MicOff, Minimize2, MonitorUp, MonitorX, PhoneOff, Search, Settings, UserMinus, UserPlus, UserX, Users, Video, VideoOff, X } from "lucide-react";
import Link from "next/link";
import { ApiError, apiClient } from "@/lib/api-client";
import type { CaptionLanguage, LiveCaption, ParticipantDirectoryEntry, StageInvitation, ZoomJoinResponse, ZoomSession } from "@/lib/api-types";
import { LiveCaptionControls } from "./live-caption-controls";
import { defaultMediaPreferences, MediaDeviceSetup, type MediaPreferences, type VirtualBackgroundMode } from "./media-device-setup";

type ZoomModule = typeof import("@zoom/videosdk");
type ZoomClient = ReturnType<ZoomModule["default"]["createClient"]>;
type ZoomStream = ReturnType<ZoomClient["getMediaStream"]>;
type ZoomParticipant = ReturnType<ZoomClient["getAllUser"]>[number];
type StageInvite = { senderId: number; audio: boolean; video: boolean; screen_share: boolean };
type StageMember = Pick<StageInvitation, "status" | "allow_audio" | "allow_video" | "allow_screen_share">;
type MediaControl = "audio" | "video" | "share";
type MediaRequest = { senderId: number; control: MediaControl };
type ZoomPresenceResponse = { token: string; expires_in: number };

const PARTICIPANTS_PER_PAGE = 9;

function participantIdentity(participant: ZoomParticipant) {
  return String(participant.userKey ?? participant.userIdentity ?? "");
}

function invitationIdentity(invitation: StageInvitation) {
  if (invitation.user) return `u:${invitation.user}`;
  if (invitation.registration) return `g:${invitation.registration.replaceAll("-", "")}`;
  return "";
}

function normalizeSearch(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function zoomFailureReason(result: unknown) {
  if (!result || typeof result !== "object" || !("type" in result)) return "retorno inválido do Zoom SDK";
  const failure = result as { type: string; reason?: string; errorCode?: number };
  return `${failure.type}${failure.errorCode ? ` (${failure.errorCode})` : ""}: ${failure.reason ?? "sem detalhes"}`;
}

function ensureZoomSuccess(result: unknown) {
  if (result instanceof Error) throw result;
  if (result && typeof result === "object" && "type" in result) {
    const failure = result as { errorCode?: number };
    const error = new Error(zoomFailureReason(result)) as Error & { errorCode?: number };
    error.errorCode = failure.errorCode;
    throw error;
  }
}

function selectedVirtualBackground(preferences: MediaPreferences) {
  if (preferences.virtualBackgroundMode === "blur") return "blur" as const;
  return undefined;
}

export function ZoomVideoRoom({ session, eventId, guest = false, roomMode = "event", onCaption, onJoinedChange }: { session: ZoomSession; eventId: string; guest?: boolean; roomMode?: "event" | "meeting"; onCaption?: (caption: LiveCaption) => void; onJoinedChange?: (joined: boolean) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const shareContainer = useRef<HTMLDivElement>(null);
  const sharePreviewVideo = useRef<HTMLVideoElement>(null);
  const sharePreviewCanvas = useRef<HTMLCanvasElement>(null);
  const remoteShareCanvas = useRef<HTMLCanvasElement>(null);
  const clientRef = useRef<ZoomClient | null>(null);
  const streamRef = useRef<ZoomStream | null>(null);
  const zoomRef = useRef<ZoomModule | null>(null);
  const videoPlayers = useRef(new Map<number, HTMLElement>());
  const videoPlaceholders = useRef(new Map<number, HTMLElement>());
  const videoAttachVersions = useRef(new Map<number, number>());
  const forcedVideoOff = useRef(new Set<number>());
  const remoteSharePlayer = useRef<HTMLElement | null>(null);
  const remoteShareUsesCanvas = useRef(false);
  const activeShareUserIdRef = useRef<number | null>(null);
  const mediaStateRef = useRef({ audioOn: false, videoOn: false, sharing: false });
  const heartbeatTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const presenceHeartbeatTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const presenceToken = useRef("");
  const participantDirectoryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const participantSyncTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const moderationFeedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const feedbackId = useRef(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const participantTrigger = useRef<HTMLButtonElement>(null);
  const participantSearchInput = useRef<HTMLInputElement>(null);
  const selfIdentity = useRef("");
  const captionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopPreviewRef = useRef<(() => Promise<void>) | null>(null);
  const isHost = useRef(false);
  const [state, setState] = useState<"ready" | "joining" | "joined" | "left" | "removed" | "ended" | "duplicate">("ready");
  const [error, setError] = useState("");
  const [audioOn, setAudioOn] = useState(false);
  const [videoOn, setVideoOn] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [sharePreviewKind, setSharePreviewKind] = useState<"video" | "canvas" | null>(null);
  const [activeShareUserId, setActiveShareUserId] = useState<number | null>(null);
  const [shareMaximized, setShareMaximized] = useState(false);
  const [participantPage, setParticipantPage] = useState(0);
  const [focus, setFocus] = useState<"grid" | "share" | `video:${number}`>("grid");
  const [participants, setParticipants] = useState<ZoomParticipant[]>([]);
  const [permissions, setPermissions] = useState({ audio: false, video: false, screen_share: false });
  const [role, setRole] = useState<ZoomJoinResponse["role"]>("viewer");
  const [stageInvite, setStageInvite] = useState<StageInvite | null>(null);
  const [onStage, setOnStage] = useState(false);
  const [stageMembers, setStageMembers] = useState<Record<string, StageMember>>({});
  const [remoteShareFallback, setRemoteShareFallback] = useState(false);
  const [mediaFeedback, setMediaFeedback] = useState<{ id: number; message: string } | null>(null);
  const [participantPanelOpen, setParticipantPanelOpen] = useState(false);
  const [participantSearch, setParticipantSearch] = useState("");
  const [participantView, setParticipantView] = useState<"all" | "stage">("all");
  const [participantDirectory, setParticipantDirectory] = useState<Record<string, ParticipantDirectoryEntry>>({});
  const [mediaRequest, setMediaRequest] = useState<MediaRequest | null>(null);
  const [moderationFeedback, setModerationFeedback] = useState<{ userId: number; control: MediaControl; message: string; failed: boolean } | null>(null);
  const [captionLanguage, setCaptionLanguage] = useState<CaptionLanguage | null>(null);
  const [liveCaption, setLiveCaption] = useState<LiveCaption | null>(null);
  const [activeRoomMode, setActiveRoomMode] = useState<"event" | "meeting">(roomMode);
  const [mediaPreferences, setMediaPreferences] = useState<MediaPreferences>(defaultMediaPreferences);
  const [deviceMenu, setDeviceMenu] = useState<"audio" | "video" | null>(null);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [linkCopied, setLinkCopied] = useState(false);
  const [virtualBackgroundSupported, setVirtualBackgroundSupported] = useState(false);
  const [noiseSuppressionSupported, setNoiseSuppressionSupported] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void import("@zoom/videosdk")
      .then((zoom) => {
        if (!cancelled) zoom.default.preloadDependentAssets();
      })
      .catch((reason) => console.warn("Não foi possível pré-carregar os recursos do Zoom.", reason));
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const stored = window.sessionStorage.getItem("brevents:media-preferences");
    if (!stored) return;
    window.sessionStorage.removeItem("brevents:media-preferences");
    try {
      const parsed = JSON.parse(stored) as Partial<MediaPreferences>;
      const timer = window.setTimeout(() => setMediaPreferences({ ...defaultMediaPreferences, ...parsed }), 0);
      return () => window.clearTimeout(timer);
    } catch (reason) {
      console.warn("Não foi possível restaurar as preferências de mídia.", reason);
    }
  }, []);

  useEffect(() => {
    if (!deviceMenu || !navigator.mediaDevices?.enumerateDevices) return;
    navigator.mediaDevices.enumerateDevices().then((devices) => {
      setAudioDevices(devices.filter((device) => device.kind === "audioinput"));
      setVideoDevices(devices.filter((device) => device.kind === "videoinput"));
    }).catch((reason) => {
      console.error("Não foi possível listar os dispositivos da sala.", reason);
    });
  }, [deviceMenu]);

  useEffect(() => {
    const pageCount = Math.max(1, Math.ceil(participants.length / PARTICIPANTS_PER_PAGE));
    const safePage = Math.min(participantPage, pageCount - 1);
    const visibleIds = new Set(participants.slice(safePage * PARTICIPANTS_PER_PAGE, (safePage + 1) * PARTICIPANTS_PER_PAGE).map((participant) => String(participant.userId)));
    container.current?.querySelectorAll<HTMLElement>("[data-zoom-user-id]").forEach((tile) => {
      tile.classList.toggle("zoom-card-hidden", !visibleIds.has(tile.dataset.zoomUserId ?? ""));
    });
  }, [participantPage, participants]);

  useEffect(() => {
    if (!deviceMenu) return;
    const closeMenu = (event: KeyboardEvent | PointerEvent) => {
      if (event instanceof KeyboardEvent && event.key !== "Escape") return;
      if (event instanceof PointerEvent && event.target instanceof Element && event.target.closest(".zoom-control-combo")) return;
      setDeviceMenu(null);
    };
    window.addEventListener("keydown", closeMenu);
    window.addEventListener("pointerdown", closeMenu);
    return () => {
      window.removeEventListener("keydown", closeMenu);
      window.removeEventListener("pointerdown", closeMenu);
    };
  }, [deviceMenu]);

  const publishTranscript = useCallback(async (text: string, sourceLanguage: CaptionLanguage) => {
    const caption = guest
      ? await fetch(`/api/guest/zoom/${session.id}/captions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventId, source_language: sourceLanguage, text }),
        }).then(async (response) => {
          const data = await response.json();
          if (!response.ok) throw new Error(typeof data.detail === "string" ? data.detail : "Não foi possível traduzir a fala.");
          return data as LiveCaption;
        })
      : await apiClient<LiveCaption>(`zoom-sessions/${session.id}/captions/`, {
          method: "POST",
          body: { source_language: sourceLanguage, text },
        });
    const client = clientRef.current;
    if (!client) return;
    const result = await client.getCommandClient().send(JSON.stringify({ type: "caption.final", caption }));
    ensureZoomSuccess(result);
    onCaption?.(caption);
  }, [eventId, guest, onCaption, session.id]);

  useEffect(() => {
    let thumbnailIndex = 0;
    videoPlayers.current.forEach((player, userId) => {
      player.dataset.focused = String(focus === `video:${userId}`);
      player.style.setProperty("--thumbnail-offset", `${thumbnailIndex * 150}px`);
      thumbnailIndex += 1;
    });
  }, [focus, participants]);

  useEffect(() => {
    mediaStateRef.current = { audioOn, videoOn, sharing };
  }, [audioOn, videoOn, sharing]);

  useEffect(() => {
    if (!participantPanelOpen) return;
    participantSearchInput.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setParticipantPanelOpen(false);
      participantTrigger.current?.focus();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [participantPanelOpen]);

  function playMediaCue(enabled: boolean) {
    const AudioContextClass = window.AudioContext;
    const context = audioContextRef.current ?? new AudioContextClass();
    audioContextRef.current = context;
    void context.resume().then(() => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const now = context.currentTime;
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(enabled ? 520 : 390, now);
      oscillator.frequency.exponentialRampToValueAtTime(enabled ? 720 : 260, now + 0.11);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.055, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(now);
      oscillator.stop(now + 0.15);
    }).catch((soundError) => console.warn("Não foi possível reproduzir o feedback de mídia.", soundError));
  }

  function showMediaFeedback(message: string, enabled: boolean) {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackId.current += 1;
    setMediaFeedback({ id: feedbackId.current, message });
    feedbackTimer.current = setTimeout(() => setMediaFeedback(null), 1_600);
    playMediaCue(enabled);
  }

  function showModerationFeedback(userId: number, control: MediaControl, message: string, failed = false) {
    if (moderationFeedbackTimer.current) clearTimeout(moderationFeedbackTimer.current);
    setModerationFeedback({ userId, control, message, failed });
    moderationFeedbackTimer.current = setTimeout(() => setModerationFeedback(null), 1_800);
  }

  async function animateVideoExit(userId: number) {
    const player = videoPlayers.current.get(userId);
    if (!player || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    try {
      await player.animate(
        [
          { opacity: 1, transform: "scale(1)" },
          { opacity: 0, transform: "scale(.94)" },
        ],
        { duration: 170, easing: "ease-in", fill: "forwards" },
      ).finished;
    } catch (animationError) {
      console.warn("A animação de saída do vídeo foi interrompida.", animationError);
    }
  }

  async function refreshParticipantDirectory() {
    const entries = await apiClient<ParticipantDirectoryEntry[]>(`zoom-sessions/${session.id}/participant-directory/`);
    setParticipantDirectory(Object.fromEntries(entries.map((entry) => [entry.identity, entry])));
  }

  function syncParticipantTiles(nextParticipants: ZoomParticipant[]) {
    if (!container.current) return;
    const sdkContainer = ensureSdkContainer(container.current, "zoom-video-sdk-container");
    const currentIds = new Set(nextParticipants.map((participant) => participant.userId));
    forcedVideoOff.current.forEach((userId) => {
      if (!currentIds.has(userId)) forcedVideoOff.current.delete(userId);
    });
    videoPlayers.current.forEach((player, userId) => {
      const participant = nextParticipants.find((item) => item.userId === userId);
      if (!currentIds.has(userId) || !participant?.bVideoOn) {
        player.remove();
        videoPlayers.current.delete(userId);
      }
    });
    videoPlaceholders.current.forEach((placeholder, userId) => {
      const participant = nextParticipants.find((item) => item.userId === userId);
      if (!currentIds.has(userId) || participant?.bVideoOn) {
        placeholder.remove();
        videoPlaceholders.current.delete(userId);
      }
    });
    nextParticipants.forEach((participant) => {
      if (participant.bVideoOn) return;
      let placeholder = videoPlaceholders.current.get(participant.userId);
      if (!placeholder) {
        placeholder = document.createElement("article");
        placeholder.className = "zoom-participant-placeholder";
        placeholder.dataset.zoomUserId = String(participant.userId);
        const avatar = document.createElement("span");
        avatar.className = "zoom-participant-avatar";
        const name = document.createElement("strong");
        const status = document.createElement("small");
        placeholder.append(avatar, name, status);
        videoPlaceholders.current.set(participant.userId, placeholder);
        sdkContainer.appendChild(placeholder);
      }
      const [avatar, name, status] = Array.from(placeholder.children) as HTMLElement[];
      avatar.textContent = participant.displayName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "?";
      name.textContent = participant.displayName;
      status.textContent = participant.muted ? "Microfone desligado" : "Microfone ligado";
    });
    nextParticipants.forEach((participant) => {
      const tile = videoPlayers.current.get(participant.userId) ?? videoPlaceholders.current.get(participant.userId);
      if (tile) sdkContainer.appendChild(tile);
    });
  }

  async function refreshParticipants() {
    if (clientRef.current) {
      const nextParticipants = clientRef.current.getAllUser().map((participant) => forcedVideoOff.current.has(participant.userId) ? { ...participant, bVideoOn: false } : participant);
      setParticipants(nextParticipants);
      syncParticipantTiles(nextParticipants);
      await Promise.all(nextParticipants.filter((participant) => participant.bVideoOn && !videoPlayers.current.has(participant.userId)).map((participant) => attachVideo(participant.userId)));
    }
    if (!isHost.current) return;
    if (participantDirectoryTimer.current) clearTimeout(participantDirectoryTimer.current);
    participantDirectoryTimer.current = setTimeout(() => {
      refreshParticipantDirectory().catch((directoryError) => {
        console.error("Não foi possível atualizar o diretório de participantes.", directoryError);
      });
    }, 350);
  }

  function scheduleParticipantRefresh() {
    participantSyncTimers.current.forEach((timer) => clearTimeout(timer));
    participantSyncTimers.current = [];
    void refreshParticipants().catch((refreshError) => {
      console.error("Não foi possível atualizar os participantes da reunião.", refreshError);
    });
    for (const delay of [120, 420]) {
      participantSyncTimers.current.push(setTimeout(() => {
        void refreshParticipants().catch((refreshError) => {
          console.error("Não foi possível sincronizar os participantes da reunião.", refreshError);
        });
      }, delay));
    }
  }

  function ensureSdkContainer(mount: HTMLElement, className: string) {
    const existing = mount.querySelector<HTMLElement>(`video-player-container.${className}`);
    if (existing) return existing;
    const sdkContainer = document.createElement("video-player-container");
    sdkContainer.className = className;
    mount.appendChild(sdkContainer);
    return sdkContainer;
  }

  function makeVideoFocusable(player: HTMLElement, userId: number) {
    const toggleFocus = () => setFocus((current) => current === `video:${userId}` ? "grid" : `video:${userId}`);
    player.tabIndex = 0;
    player.setAttribute("role", "button");
    player.setAttribute("aria-label", "Colocar este vídeo em destaque");
    player.setAttribute("aria-label", "Alternar destaque deste vídeo");
    player.addEventListener("click", toggleFocus);
    player.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggleFocus();
      }
    });
  }

  async function attachVideo(userId: number) {
    const stream = streamRef.current;
    const zoom = zoomRef.current;
    if (!stream || !zoom || !container.current) return;
    forcedVideoOff.current.delete(userId);
    const version = (videoAttachVersions.current.get(userId) ?? 0) + 1;
    videoAttachVersions.current.set(userId, version);
    const player = await stream.attachVideo(userId, zoom.VideoQuality.Video_360P);
    if (player instanceof HTMLElement) {
      if (videoAttachVersions.current.get(userId) !== version || !container.current) {
        player.remove();
        return;
      }
      videoPlayers.current.get(userId)?.remove();
      videoPlaceholders.current.get(userId)?.remove();
      videoPlaceholders.current.delete(userId);
      player.dataset.zoomUserId = String(userId);
      videoPlayers.current.set(userId, player);
      makeVideoFocusable(player, userId);
      ensureSdkContainer(container.current, "zoom-video-sdk-container").appendChild(player);
      if (clientRef.current) {
        const nextParticipants = clientRef.current.getAllUser().map((participant) => participant.userId === userId ? { ...participant, bVideoOn: true } : participant);
        setParticipants(nextParticipants);
        syncParticipantTiles(nextParticipants);
      }
    }
  }

  async function detachVideo(userId: number) {
    forcedVideoOff.current.add(userId);
    videoAttachVersions.current.set(userId, (videoAttachVersions.current.get(userId) ?? 0) + 1);
    await streamRef.current?.detachVideo(userId);
    videoPlayers.current.get(userId)?.remove();
    videoPlayers.current.delete(userId);
    if (clientRef.current) {
      const nextParticipants = clientRef.current.getAllUser().map((participant) => participant.userId === userId ? { ...participant, bVideoOn: false } : participant);
      setParticipants(nextParticipants);
      syncParticipantTiles(nextParticipants);
    }
    setFocus((current) => current === `video:${userId}` ? activeShareUserIdRef.current ? "share" : "grid" : current);
  }

  async function attachShare(userId: number) {
    const stream = streamRef.current;
    const mount = shareContainer.current;
    if (!stream || !mount) return;
    const currentUserId = clientRef.current?.getCurrentUserInfo().userId;
    activeShareUserIdRef.current = userId;
    setActiveShareUserId(userId);
    setFocus("share");
    if (userId === currentUserId) return;

    if (remoteSharePlayer.current) remoteSharePlayer.current.remove();
    remoteShareUsesCanvas.current = false;
    setRemoteShareFallback(false);
    const sdkContainer = ensureSdkContainer(mount, "zoom-share-sdk-container");
    sdkContainer.replaceChildren();

    let lastFailure = "";
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const player = await stream.attachShareView(userId);
      if (player instanceof HTMLElement) {
        player.setAttribute("aria-label", "Tela compartilhada");
        remoteSharePlayer.current = player;
        sdkContainer.appendChild(player);
        return;
      }
      lastFailure = zoomFailureReason(player);
      await new Promise((resolve) => setTimeout(resolve, 180 * (attempt + 1)));
    }

    const fallbackCanvas = remoteShareCanvas.current;
    if (!fallbackCanvas) throw new Error(`Falha ao exibir compartilhamento: ${lastFailure}`);
    const fallbackResult = await stream.startShareView(fallbackCanvas, userId);
    if (fallbackResult && typeof fallbackResult === "object") {
      throw new Error(`Falha ao exibir compartilhamento: ${zoomFailureReason(fallbackResult)}`);
    }
    remoteShareUsesCanvas.current = true;
    setRemoteShareFallback(true);
  }

  async function detachShare(userId: number) {
    const currentUserId = clientRef.current?.getCurrentUserInfo().userId;
    if (userId !== currentUserId) {
      if (remoteShareUsesCanvas.current) {
        await streamRef.current?.stopShareView();
      } else {
        const detached = await streamRef.current?.detachShareView(userId);
        if (Array.isArray(detached)) detached.forEach((element) => element.remove());
        else if (detached instanceof HTMLElement) detached.remove();
      }
    } else {
      setSharing(false);
      setSharePreviewKind(null);
    }
    remoteSharePlayer.current?.remove();
    remoteSharePlayer.current = null;
    remoteShareUsesCanvas.current = false;
    activeShareUserIdRef.current = null;
    setActiveShareUserId(null);
    setShareMaximized(false);
    setRemoteShareFallback(false);
    setFocus((current) => current === "share" ? "grid" : current);
  }

  async function releasePresence(keepalive = false) {
    if (presenceHeartbeatTimer.current) clearInterval(presenceHeartbeatTimer.current);
    presenceHeartbeatTimer.current = null;
    const token = presenceToken.current;
    presenceToken.current = "";
    if (!token || guest) return;
    try {
      await apiClient(`zoom-sessions/${session.id}/presence/leave/`, {
        method: "POST",
        body: { token },
        keepalive,
      });
    } catch (presenceError) {
      console.warn("Não foi possível liberar a presença da reunião.", presenceError);
    }
  }

  async function join() {
    setState("joining");
    setError("");
    try {
      await stopPreviewRef.current?.();
      const credentialsPromise = guest
        ? fetch(`/api/guest/zoom/${session.id}/join`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ eventId }),
          }).then(async (response) => {
            const data = await response.json();
            if (!response.ok) throw new Error(typeof data.detail === "string" ? data.detail : "Não foi possível validar seu ingresso.");
            return data as ZoomJoinResponse;
          })
        : apiClient<ZoomJoinResponse>(`zoom-sessions/${session.id}/join/`, { method: "POST" });
      const [credentials, zoom] = await Promise.all([credentialsPromise, import("@zoom/videosdk")]);
      const client = zoom.default.createClient();
      zoomRef.current = zoom;
      clientRef.current = client;
      const initialization = client.init("en-US", "Global", {
        patchJsMedia: true,
        leaveOnPageUnload: true,
        enforceVirtualBackground: true,
      }).then(ensureZoomSuccess);
      let presence: ZoomPresenceResponse | null = null;
      if (!guest) {
        try {
          [presence] = await Promise.all([
            apiClient<ZoomPresenceResponse>(`zoom-sessions/${session.id}/presence/claim/`, { method: "POST" }),
            initialization,
          ]);
          presenceToken.current = presence.token;
        } catch (presenceError) {
          if (presenceError instanceof ApiError && presenceError.status === 409) {
            clientRef.current = null;
            setState("duplicate");
            onJoinedChange?.(false);
            return;
          }
          throw presenceError;
        }
      } else {
        await initialization;
      }
      await client.join(
        credentials.session_name,
        credentials.token,
        credentials.user_name,
        credentials.session_passcode,
      );
      if (presence) {
        presenceHeartbeatTimer.current = setInterval(() => {
          apiClient(`zoom-sessions/${session.id}/presence/heartbeat/`, {
            method: "POST",
            body: { token: presence.token },
          }).catch(async (presenceError) => {
            console.error("A presença desta conexão expirou.", presenceError);
            if (!(presenceError instanceof ApiError) || presenceError.status !== 409) return;
            if (presenceHeartbeatTimer.current) clearInterval(presenceHeartbeatTimer.current);
            presenceHeartbeatTimer.current = null;
            presenceToken.current = "";
            try { await client.leave(); } catch { /* A conexão já pode estar fechada. */ }
            setState("duplicate");
            onJoinedChange?.(false);
          });
        }, Math.max(10_000, (presence.expires_in - 20) * 1_000));
      }
      const stream = client.getMediaStream();
      streamRef.current = stream;
      const supportsNoiseSuppression = stream.isSupportBackgroundNoiseSuppression();
      const supportsVirtualBackground = stream.isSupportVirtualBackground();
      setNoiseSuppressionSupported(supportsNoiseSuppression);
      setVirtualBackgroundSupported(supportsVirtualBackground);
      selfIdentity.current = participantIdentity(client.getCurrentUserInfo());
      setPermissions(credentials.media_permissions);
      setActiveRoomMode(credentials.room_mode);
      setRole(credentials.role);
      setOnStage(
        credentials.role === "host"
        || credentials.room_mode === "meeting"
        || credentials.stage_invitation?.status === "accepted",
      );
      setStageMembers(Object.fromEntries(
        (credentials.stage_invitations ?? [])
          .map((invitation) => [invitationIdentity(invitation), {
            status: invitation.status,
            allow_audio: invitation.allow_audio,
            allow_video: invitation.allow_video,
            allow_screen_share: invitation.allow_screen_share,
          }] as const)
          .filter(([identity]) => identity),
      ));
      setParticipantDirectory(Object.fromEntries(
        (credentials.participant_directory ?? []).map((entry) => [entry.identity, entry]),
      ));
      isHost.current = credentials.role === "host";
      if (isHost.current) {
        void refreshParticipantDirectory().catch((reason) => {
          console.warn("Não foi possível carregar o diretório de participantes.", reason);
        });
      }
      const initialParticipants = client.getAllUser();
      setParticipants(initialParticipants);
      setState("joined");
      onJoinedChange?.(true);
      window.requestAnimationFrame(() => syncParticipantTiles(client.getAllUser()));

      client.on("connection-change", ({ state: connectionState, reason }) => {
        if (connectionState !== "Closed") return;
        if (reason === "kicked by host" || reason === "expeled by host") {
          void releasePresence(true);
          setState("removed");
          setError("");
          onJoinedChange?.(false);
          return;
        }
        if (reason === "ended by host") {
          void releasePresence(true);
          setState("ended");
          setError("");
          onJoinedChange?.(false);
        }
      });

      if (isHost.current) {
        heartbeatTimer.current = setInterval(() => {
          apiClient(`zoom-sessions/${session.id}/heartbeat/`, { method: "POST" }).catch((heartbeatError) => {
            console.error("Não foi possível atualizar o status da transmissão.", heartbeatError);
          });
        }, 20_000);
      }

      if (credentials.role === "host" && credentials.room_mode === "event") {
        await stream.muteAudioUponStartAudio(true);
        await stream.allowAudioUnmutedBySelf(true);
        const hasActiveStageSharer = (credentials.stage_invitations ?? []).some(
          (invitation) => invitation.status === "accepted" && invitation.allow_screen_share,
        );
        await stream.lockShare(!hasActiveStageSharer);
      }

      client.on("user-added", scheduleParticipantRefresh);
      client.on("user-removed", scheduleParticipantRefresh);
      client.on("user-updated", scheduleParticipantRefresh);
      client.on("command-channel-message", async (payload) => {
        try {
          const command = JSON.parse(payload.text) as {
            type?: string;
            permissions?: ZoomJoinResponse["media_permissions"];
            caption?: LiveCaption;
            control?: MediaControl;
          };
          const senderId = Number(payload.senderId);
          if (
            command.type === "meeting.removed"
            && client.getAllUser().some((participant) => participant.userId === senderId && (participant.isHost || participant.isManager))
          ) {
            setState("removed");
            setError("");
            onJoinedChange?.(false);
            return;
          }
          if (command.type === "stage.invite" && command.permissions) {
            setStageInvite({ senderId, ...command.permissions });
          }
          if (command.type === "stage.accepted" && credentials.role === "host") {
            const participant = client.getAllUser().find((item) => item.userId === senderId);
            const identity = participant ? participantIdentity(participant) : "";
            if (identity) {
              setStageMembers((current) => ({
                ...current,
                [identity]: { ...(current[identity] ?? { allow_audio: true, allow_video: true, allow_screen_share: true }), status: "accepted" },
              }));
            }
          }
          if (command.type === "stage.stop-video") {
            await stream.stopVideo();
            mediaStateRef.current.videoOn = false;
            setVideoOn(false);
            await detachVideo(client.getCurrentUserInfo().userId);
            showMediaFeedback("O organizador desligou sua câmera", false);
          }
          if (command.type === "stage.muted" && command.control === "audio") {
            if (!stream.isAudioMuted()) await stream.muteAudio();
            mediaStateRef.current.audioOn = false;
            setAudioOn(false);
            showMediaFeedback("O organizador desligou seu microfone", false);
          }
          if (command.type === "stage.stop-share") {
            await stream.stopShareScreen();
            mediaStateRef.current.sharing = false;
            setSharing(false);
            setSharePreviewKind(null);
            setShareMaximized(false);
            showMediaFeedback("O organizador interrompeu seu compartilhamento", false);
          }
          if (command.type === "stage.request-audio") setMediaRequest({ senderId, control: "audio" });
          if (command.type === "stage.request-video") setMediaRequest({ senderId, control: "video" });
          if (command.type === "stage.request-share") setMediaRequest({ senderId, control: "share" });
          if (command.type === "stage.revoke") {
            if (mediaStateRef.current.sharing) await stream.stopShareScreen();
            if (mediaStateRef.current.videoOn) await stream.stopVideo();
            if (!stream.isAudioMuted()) await stream.muteAudio();
            setAudioOn(false);
            setVideoOn(false);
            setSharing(false);
            setSharePreviewKind(null);
            setPermissions({ audio: false, video: false, screen_share: false });
            setOnStage(false);
            showMediaFeedback("Você saiu do palco", false);
          }
          if (
            command.type === "caption.final"
            && command.caption
            && command.caption.speaker_identity !== selfIdentity.current
          ) {
            if (captionTimer.current) clearTimeout(captionTimer.current);
            setLiveCaption(command.caption);
            onCaption?.(command.caption);
            captionTimer.current = setTimeout(() => setLiveCaption(null), 8_000);
          }
        } catch (commandError) {
          console.error("Não foi possível processar o comando de palco.", commandError);
        }
      });
      client.on("peer-video-state-change", async ({ action, userId }) => {
        if (action === "Start") await attachVideo(userId);
        else await detachVideo(userId);
        scheduleParticipantRefresh();
      });
      client.on("active-share-change", async ({ state: shareState, userId }) => {
        try {
          if (shareState === "Active") await attachShare(userId);
          else await detachShare(activeShareUserIdRef.current ?? userId);
        } catch (shareError) {
          console.error("Não foi possível atualizar a tela compartilhada.", shareError);
          setError("A tela foi compartilhada, mas não pôde ser exibida. Tente entrar novamente na sala.");
        }
      });
      client.on("passively-stop-share", () => {
        const wasSharing = mediaStateRef.current.sharing;
        mediaStateRef.current.sharing = false;
        setSharing(false);
        setSharePreviewKind(null);
        activeShareUserIdRef.current = null;
        setActiveShareUserId(null);
        setShareMaximized(false);
        setFocus("grid");
        if (wasSharing) showMediaFeedback("Compartilhamento encerrado", false);
      });
      client.on("share-content-dimension-change", ({ type, width, height }) => {
        if (!width || !height) return;
        const target = type === "received"
          ? remoteShareUsesCanvas.current ? remoteShareCanvas.current : remoteSharePlayer.current
          : stream.isStartShareScreenWithVideoElement() ? sharePreviewVideo.current : sharePreviewCanvas.current;
        target?.style.setProperty("--share-aspect-ratio", `${width} / ${height}`);
        if (type === "received" && remoteShareUsesCanvas.current) {
          void stream.updateSharingCanvasDimension(width, height);
        }
      });

      for (const user of client.getAllUser()) {
        if (user.bVideoOn) await attachVideo(user.userId);
      }
      const existingShareUserId = stream.getActiveShareUserId();
      if (existingShareUserId) await attachShare(existingShareUserId);

      try {
        ensureZoomSuccess(await stream.startAudio({
          microphoneId: mediaPreferences.audioDeviceId || undefined,
          backgroundNoiseSuppression: supportsNoiseSuppression && mediaPreferences.noiseSuppression,
        }));
        const shouldEnableAudio = credentials.media_permissions.audio && mediaPreferences.audioEnabled;
        if (shouldEnableAudio) await stream.unmuteAudio();
        else if (!stream.isAudioMuted()) await stream.muteAudio();
        mediaStateRef.current.audioOn = shouldEnableAudio;
        setAudioOn(shouldEnableAudio);
      } catch (audioStartError) {
        console.error("Não foi possível conectar ao áudio da sala.", audioStartError);
        mediaStateRef.current.audioOn = false;
        setAudioOn(false);
      }
      const shouldEnableVideo = credentials.media_permissions.video && mediaPreferences.videoEnabled;
      let videoStarted = false;
      if (shouldEnableVideo) {
        try {
          const virtualBackground = selectedVirtualBackground(mediaPreferences);
          ensureZoomSuccess(await stream.startVideo({
            cameraId: mediaPreferences.videoDeviceId || undefined,
            ...(supportsVirtualBackground && virtualBackground ? { virtualBackground: { imageUrl: virtualBackground, cropped: true } } : {}),
          }));
          await attachVideo(client.getCurrentUserInfo().userId);
          videoStarted = true;
        } catch (videoStartError) {
          console.error("Não foi possível iniciar a câmera da sala.", videoStartError);
          setError("Você entrou na reunião, mas a câmera não pôde ser iniciada. Tente ligá-la novamente.");
        }
      }
      mediaStateRef.current.videoOn = videoStarted;
      setVideoOn(videoStarted);
    } catch (reason) {
      if (heartbeatTimer.current) clearInterval(heartbeatTimer.current);
      heartbeatTimer.current = null;
      await releasePresence();
      try { await clientRef.current?.leave(); } catch { /* A conexão já pode estar fechada. */ }
      clientRef.current = null;
      streamRef.current = null;
      isHost.current = false;
      setState("ready");
      onJoinedChange?.(false);
      setError(reason instanceof Error ? reason.message : reason && typeof reason === "object" ? zoomFailureReason(reason) : "Não foi possível entrar na sala Zoom.");
    }
  }

  async function toggleAudio() {
    const stream = streamRef.current;
    if (!stream) return;
    if (audioOn) await stream.muteAudio();
    else await stream.unmuteAudio();
    mediaStateRef.current.audioOn = !audioOn;
    setAudioOn(!audioOn);
    showMediaFeedback(audioOn ? "Microfone desligado" : "Microfone ligado", !audioOn);
  }

  async function toggleVideo() {
    const stream = streamRef.current;
    const client = clientRef.current;
    if (!stream || !client) return;
    const userId = client.getCurrentUserInfo().userId;
    if (videoOn) {
      await animateVideoExit(userId);
      await stream.stopVideo();
      await detachVideo(userId);
    } else {
      const virtualBackground = selectedVirtualBackground(mediaPreferences);
      ensureZoomSuccess(await stream.startVideo({
        cameraId: mediaPreferences.videoDeviceId || undefined,
        ...(virtualBackgroundSupported && virtualBackground ? { virtualBackground: { imageUrl: virtualBackground, cropped: true } } : {}),
      }));
      await attachVideo(userId);
    }
    mediaStateRef.current.videoOn = !videoOn;
    setVideoOn(!videoOn);
    showMediaFeedback(videoOn ? "Câmera desligada" : "Câmera ligada", !videoOn);
  }

  async function toggleShare() {
    const stream = streamRef.current;
    const client = clientRef.current;
    if (!stream || !client) return;
    if (sharing) {
      await stream.stopShareScreen();
      mediaStateRef.current.sharing = false;
      setSharing(false);
      setSharePreviewKind(null);
      activeShareUserIdRef.current = null;
      setActiveShareUserId(null);
      setShareMaximized(false);
      setFocus("grid");
      showMediaFeedback("Compartilhamento encerrado", false);
      return;
    }
    const previewKind = stream.isStartShareScreenWithVideoElement() ? "video" : "canvas";
    const preview = previewKind === "video" ? sharePreviewVideo.current : sharePreviewCanvas.current;
    if (!preview) return;
    await stream.startShareScreen(preview);
    const userId = client.getCurrentUserInfo().userId;
    activeShareUserIdRef.current = userId;
    setActiveShareUserId(userId);
    mediaStateRef.current.sharing = true;
    setSharing(true);
    setSharePreviewKind(previewKind);
    setFocus("share");
    showMediaFeedback("Tela compartilhada", true);
  }

  async function changeAudioDevice(deviceId: string) {
    setMediaPreferences((current) => ({ ...current, audioDeviceId: deviceId }));
    if (streamRef.current && deviceId) await streamRef.current.switchMicrophone(deviceId);
    showMediaFeedback("Microfone alterado", true);
  }

  async function changeVideoDevice(deviceId: string) {
    setMediaPreferences((current) => ({ ...current, videoDeviceId: deviceId }));
    if (streamRef.current && videoOn && deviceId) await streamRef.current.switchCamera(deviceId);
    showMediaFeedback("Câmera alterada", true);
  }

  async function toggleNoiseSuppression() {
    const stream = streamRef.current;
    if (!stream || !noiseSuppressionSupported) {
      showMediaFeedback("Redução de ruído indisponível neste navegador", false);
      return;
    }
    const enabled = !mediaPreferences.noiseSuppression;
    ensureZoomSuccess(await stream.enableBackgroundNoiseSuppression(enabled));
    setMediaPreferences((current) => ({ ...current, noiseSuppression: enabled }));
    showMediaFeedback(enabled ? "Redução de ruído ativada" : "Redução de ruído desativada", enabled);
  }

  async function changeVirtualBackground(mode: VirtualBackgroundMode) {
    const stream = streamRef.current;
    if (!stream || !virtualBackgroundSupported) {
      showMediaFeedback("Fundo virtual indisponível neste navegador", false);
      return;
    }
    const nextPreferences = { ...mediaPreferences, virtualBackgroundMode: mode };
    if (videoOn) ensureZoomSuccess(await stream.updateVirtualBackgroundImage(selectedVirtualBackground(nextPreferences), true));
    setMediaPreferences(nextPreferences);
    showMediaFeedback(mode === "blur" ? "Fundo desfocado" : "Efeito de fundo removido", mode !== "none");
  }

  async function copyRoomLink() {
    await navigator.clipboard.writeText(window.location.href);
    setLinkCopied(true);
    window.setTimeout(() => setLinkCopied(false), 1_800);
  }

  async function leave() {
    const client = clientRef.current;
    if (heartbeatTimer.current) clearInterval(heartbeatTimer.current);
    heartbeatTimer.current = null;
    if (participantDirectoryTimer.current) clearTimeout(participantDirectoryTimer.current);
    participantDirectoryTimer.current = null;
    participantSyncTimers.current.forEach((timer) => clearTimeout(timer));
    participantSyncTimers.current = [];
    if (moderationFeedbackTimer.current) clearTimeout(moderationFeedbackTimer.current);
    moderationFeedbackTimer.current = null;
    if (captionTimer.current) clearTimeout(captionTimer.current);
    captionTimer.current = null;
    await releasePresence();
    if (isHost.current) {
      try { await apiClient(`zoom-sessions/${session.id}/end-live/`, { method: "POST" }); }
      catch (endLiveError) { console.error("Não foi possível encerrar o status da transmissão.", endLiveError); }
    }
    isHost.current = false;
    if (client) await client.leave();
    container.current?.replaceChildren();
    shareContainer.current?.querySelector("video-player-container")?.remove();
    videoPlayers.current.clear();
    videoPlaceholders.current.clear();
    videoAttachVersions.current.clear();
    forcedVideoOff.current.clear();
    remoteSharePlayer.current = null;
    remoteShareUsesCanvas.current = false;
    activeShareUserIdRef.current = null;
    streamRef.current = null;
    selfIdentity.current = "";
    clientRef.current = null;
    setAudioOn(false);
    setVideoOn(false);
    setSharing(false);
    setSharePreviewKind(null);
    setActiveShareUserId(null);
    setRemoteShareFallback(false);
    setOnStage(false);
    setStageMembers({});
    setParticipantDirectory({});
    setParticipantPanelOpen(false);
    setParticipantSearch("");
    setParticipantView("all");
    setMediaRequest(null);
    setModerationFeedback(null);
    setFocus("grid");
    setParticipants([]);
    setLiveCaption(null);
    setState("left");
    onJoinedChange?.(false);
  }

  async function inviteToStage(participant: ZoomParticipant) {
    const identity = participantIdentity(participant);
    const client = clientRef.current;
    if (!client || (!identity.startsWith("u:") && !identity.startsWith("g:"))) return;
    const mediaPermissions = { audio: true, video: true, screen_share: true };
    const target = identity.startsWith("u:") ? { user: Number(identity.slice(2)) } : { registration: identity.slice(2) };
    await apiClient(`zoom-sessions/${session.id}/invite-to-stage/`, { method: "POST", body: { ...target, allow_audio: true, allow_video: true, allow_screen_share: true } });
    await streamRef.current?.allowAudioUnmutedBySelf(true);
    await streamRef.current?.lockShare(false);
    setStageMembers((current) => ({
      ...current,
      [identity]: { status: "pending", allow_audio: true, allow_video: true, allow_screen_share: true },
    }));
    await client.getCommandClient().send(JSON.stringify({ type: "stage.invite", permissions: mediaPermissions }), participant.userId);
  }

  async function removeFromStage(participant: ZoomParticipant) {
    const identity = participantIdentity(participant);
    const client = clientRef.current;
    const stream = streamRef.current;
    if (!client || !stream || (!identity.startsWith("u:") && !identity.startsWith("g:"))) return;
    const target = identity.startsWith("u:") ? { user: Number(identity.slice(2)) } : { registration: identity.slice(2) };
    await apiClient(`zoom-sessions/${session.id}/revoke-stage/`, { method: "POST", body: target });
    await client.getCommandClient().send(JSON.stringify({ type: "stage.revoke" }), participant.userId);
    const remainingStageMembers = Object.entries(stageMembers).filter(([key, member]) => key !== identity && member.status === "accepted");
    setStageMembers((current) => {
      const next = { ...current };
      delete next[identity];
      return next;
    });
    if (remainingStageMembers.length === 0) {
      await stream.lockShare(true);
    }
  }

  async function acceptStageInvite() {
    const client = clientRef.current;
    const stream = streamRef.current;
    if (!client || !stream || !stageInvite) return;
    if (guest) {
      const response = await fetch(`/api/guest/zoom/${session.id}/accept-stage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId }),
      });
      if (!response.ok) throw new Error("Não foi possível aceitar o convite para o palco.");
    } else {
      await apiClient(`zoom-sessions/${session.id}/accept-stage/`, { method: "POST" });
    }
    const nextPermissions = { audio: stageInvite.audio, video: stageInvite.video, screen_share: stageInvite.screen_share };
    setPermissions(nextPermissions);
    setOnStage(true);
    if (!stream.isAudioMuted()) await stream.muteAudio();
    mediaStateRef.current.audioOn = false;
    mediaStateRef.current.videoOn = false;
    setAudioOn(false);
    setVideoOn(false);
    await client.getCommandClient().send(JSON.stringify({ type: "stage.accepted" }), stageInvite.senderId);
    setStageInvite(null);
    showMediaFeedback("Você entrou no palco", true);
  }

  async function controlParticipantAudio(participant: ZoomParticipant) {
    const client = clientRef.current;
    const stream = streamRef.current;
    if (!client || !stream) return;
    try {
      if (participant.muted) {
        ensureZoomSuccess(await client.getCommandClient().send(JSON.stringify({ type: "stage.request-audio" }), participant.userId));
        showModerationFeedback(participant.userId, "audio", `Pedido de microfone enviado para ${participant.displayName}.`);
      } else {
        ensureZoomSuccess(await stream.muteAudio(participant.userId));
        ensureZoomSuccess(await client.getCommandClient().send(JSON.stringify({ type: "stage.muted", control: "audio" }), participant.userId));
        setParticipants((current) => current.map((item) => item.userId === participant.userId ? { ...item, muted: true } : item));
        showModerationFeedback(participant.userId, "audio", `Microfone de ${participant.displayName} desligado.`);
      }
    } catch (controlError) {
      console.error("Não foi possível controlar o microfone do participante.", controlError);
      showModerationFeedback(participant.userId, "audio", "Falha ao controlar o microfone.", true);
    }
  }

  async function controlParticipantVideo(participant: ZoomParticipant) {
    const client = clientRef.current;
    if (!client) return;
    try {
      const result = await client.getCommandClient().send(
        JSON.stringify({ type: participant.bVideoOn ? "stage.stop-video" : "stage.request-video" }),
        participant.userId,
      );
      ensureZoomSuccess(result);
      if (participant.bVideoOn) await detachVideo(participant.userId);
      showModerationFeedback(
        participant.userId,
        "video",
        participant.bVideoOn ? `Câmera de ${participant.displayName} desligada.` : `Pedido de câmera enviado para ${participant.displayName}.`,
      );
    } catch (controlError) {
      console.error("Não foi possível controlar a câmera do participante.", controlError);
      showModerationFeedback(participant.userId, "video", "Falha ao controlar a câmera.", true);
    }
  }

  async function controlParticipantShare(participant: ZoomParticipant) {
    const client = clientRef.current;
    if (!client) return;
    try {
      const result = await client.getCommandClient().send(
        JSON.stringify({ type: participant.sharerOn ? "stage.stop-share" : "stage.request-share" }),
        participant.userId,
      );
      ensureZoomSuccess(result);
      showModerationFeedback(
        participant.userId,
        "share",
        participant.sharerOn ? `Compartilhamento de ${participant.displayName} encerrado.` : `Pedido de compartilhamento enviado para ${participant.displayName}.`,
      );
    } catch (controlError) {
      console.error("Não foi possível controlar o compartilhamento do participante.", controlError);
      showModerationFeedback(participant.userId, "share", "Falha ao controlar o compartilhamento.", true);
    }
  }

  async function removeParticipant(participant: ZoomParticipant) {
    const client = clientRef.current;
    if (!client || !window.confirm(`Remover ${participant.displayName} da reunião?`)) return;
    try {
      ensureZoomSuccess(await client.getCommandClient().send(JSON.stringify({ type: "meeting.removed" }), participant.userId));
      ensureZoomSuccess(await client.removeUser(participant.userId));
      showModerationFeedback(participant.userId, "audio", `${participant.displayName} foi removido da reunião.`);
    } catch (controlError) {
      console.error("Não foi possível remover o participante.", controlError);
      showModerationFeedback(participant.userId, "audio", "Falha ao remover o participante.", true);
    }
  }

  async function acceptMediaRequest() {
    const client = clientRef.current;
    if (!client || !mediaRequest) return;
    if (mediaRequest.control === "audio" && !mediaStateRef.current.audioOn) await toggleAudio();
    if (mediaRequest.control === "video" && !mediaStateRef.current.videoOn) await toggleVideo();
    if (mediaRequest.control === "share" && !mediaStateRef.current.sharing) await toggleShare();
    await client.getCommandClient().send(JSON.stringify({ type: "stage.media-accepted", control: mediaRequest.control }), mediaRequest.senderId);
    setMediaRequest(null);
  }

  useEffect(() => {
    return () => {
      if (heartbeatTimer.current) clearInterval(heartbeatTimer.current);
      if (participantDirectoryTimer.current) clearTimeout(participantDirectoryTimer.current);
      if (moderationFeedbackTimer.current) clearTimeout(moderationFeedbackTimer.current);
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
      if (captionTimer.current) clearTimeout(captionTimer.current);
      if (presenceHeartbeatTimer.current) clearInterval(presenceHeartbeatTimer.current);
      void audioContextRef.current?.close();
      if (isHost.current) {
        void fetch(`/api/backend/zoom-sessions/${session.id}/end-live/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
          keepalive: true,
        });
      }
      const activePresenceToken = presenceToken.current;
      presenceToken.current = "";
      if (activePresenceToken && !guest) {
        void fetch(`/api/backend/zoom-sessions/${session.id}/presence/leave/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: activePresenceToken }),
          keepalive: true,
        });
      }
      clientRef.current?.leave().catch(() => undefined);
    };
  }, [guest, session.id]);

  if (state === "removed" || state === "ended" || state === "duplicate") {
    return (
      <div className="zoom-prejoin zoom-session-closed" role="status" aria-live="assertive">
        <span className="live-pill"><span className="live-dot" /> {state === "duplicate" ? "Acesso já utilizado" : "Reunião encerrada"}</span>
        <UserX size={42} aria-hidden="true" />
        <h1>{state === "removed" ? "Você foi removido da reunião" : state === "duplicate" ? "Esta conta já está na reunião" : "A reunião foi encerrada"}</h1>
        <p>{state === "removed" ? "O anfitrião encerrou sua participação nesta sala." : state === "duplicate" ? "Feche a outra guia ou saia da reunião no outro dispositivo antes de tentar novamente." : "O anfitrião encerrou esta reunião para todos os participantes."}</p>
        <Link className="button button-primary" href="/">Voltar ao início</Link>
      </div>
    );
  }

  if (state !== "joined") {
    return (
      <div className="zoom-prejoin">
        <span className="live-pill"><span className="live-dot" /> Sala interativa</span>
        <h1>{state === "left" ? "Você saiu da sala" : activeRoomMode === "meeting" ? "Tudo pronto para a reunião?" : "Entre no palco ao vivo"}</h1>
        <p>Escolha sua câmera e seu microfone. Você poderá trocar os dispositivos durante a chamada.</p>
        <MediaDeviceSetup value={mediaPreferences} onChange={setMediaPreferences} active={state !== "joining"} stopPreviewRef={stopPreviewRef} />
        <div className="zoom-capabilities" aria-label="Recursos da sala">
          <span><Video size={15} /> Live Meeting</span>
        </div>
        <button className="button button-primary" onClick={join} disabled={state === "joining"}>
          {state === "joining" ? "Conectando…" : state === "left" ? "Entrar novamente" : activeRoomMode === "meeting" ? "Entrar na reunião" : "Entrar na sala"}
        </button>
        {!session.configured && <p className="zoom-setup-note">Aguardando as credenciais do Zoom Video SDK no servidor.</p>}
        {error && <p className="live-error" role="alert">{error}</p>}
      </div>
    );
  }

  const hasActiveShare = sharing || activeShareUserId !== null;
  const focusClass = focus === "share" ? "share-focused" : focus.startsWith("video:") ? "video-focused" : "grid-focused";
  const participantPageCount = Math.max(1, Math.ceil(participants.length / PARTICIPANTS_PER_PAGE));
  const safeParticipantPage = Math.min(participantPage, participantPageCount - 1);
  const audienceParticipants = participants.filter((participant) => !participant.isHost && !participant.isManager);
  const onStageParticipantCount = audienceParticipants.filter((participant) => stageMembers[participantIdentity(participant)]?.status === "accepted").length;
  const normalizedParticipantSearch = normalizeSearch(participantSearch);
  const visibleParticipants = audienceParticipants.filter((participant) => {
    const identity = participantIdentity(participant);
    const directoryEntry = participantDirectory[identity];
    const matchesView = participantView === "all" || stageMembers[identity]?.status === "accepted";
    if (!matchesView) return false;
    if (!normalizedParticipantSearch) return true;
    return normalizeSearch(`${participant.displayName} ${directoryEntry?.name ?? ""} ${directoryEntry?.email ?? ""}`).includes(normalizedParticipantSearch);
  });

  return (
    <div className="zoom-meeting-shell">
      {hasActiveShare && <button type="button" className="zoom-share-maximize" aria-label={shareMaximized ? "Restaurar compartilhamento" : "Maximizar compartilhamento"} onClick={() => setShareMaximized((current) => !current)}>{shareMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}</button>}
      <div className="zoom-meeting-status">
        <span className="live-dot" /> AO VIVO · {role === "host" ? "ORGANIZADOR" : onStage ? "NO PALCO" : role === "viewer" ? "ESPECTADOR" : "PLATEIA"}
        {role === "host"
          ? <div className="zoom-meeting-actions">{activeRoomMode === "meeting" ? <button type="button" className="zoom-event-settings" onClick={copyRoomLink}>{linkCopied ? <Check size={14} /> : <Copy size={14} />} {linkCopied ? "Link copiado" : "Compartilhar sala"}</button> : <a className="zoom-event-settings" href={`/painel?event=${encodeURIComponent(eventId)}&tab=settings`} target="_blank" rel="noopener noreferrer"><Settings size={14} /> Configurar evento</a>}<button ref={participantTrigger} type="button" className="zoom-participant-trigger" aria-expanded={participantPanelOpen} aria-controls="zoom-participant-directory" onClick={() => setParticipantPanelOpen((current) => !current)}><Users size={14} /> Participantes <strong>{audienceParticipants.length}</strong></button></div>
          : activeRoomMode === "meeting" ? <div className="zoom-meeting-actions"><button type="button" className="zoom-event-settings" onClick={copyRoomLink}>{linkCopied ? <Check size={14} /> : <Copy size={14} />} {linkCopied ? "Link copiado" : "Compartilhar"}</button><span><Users size={14} /> {participants.length}</span></div> : <span><Users size={14} /> {participants.length}</span>}
      </div>
      {participantPageCount > 1 && !shareMaximized && <nav className="zoom-pagination" aria-label="PÃ¡ginas de participantes">
        <button type="button" aria-label="Participantes anteriores" disabled={safeParticipantPage === 0} onClick={() => setParticipantPage((current) => Math.max(0, current - 1))}><ChevronLeft size={16} /></button>
        <span>PÃ¡gina {safeParticipantPage + 1} de {participantPageCount}</span>
        <button type="button" aria-label="PrÃ³ximos participantes" disabled={safeParticipantPage >= participantPageCount - 1} onClick={() => setParticipantPage((current) => Math.min(participantPageCount - 1, current + 1))}><ChevronLeft size={16} /></button>
      </nav>}
      <div className={`zoom-media-stage ${hasActiveShare ? "has-share" : "no-share"} ${focusClass}${shareMaximized ? " share-maximized" : ""}`}>
        <div className="zoom-video-grid" ref={container} aria-label="Participantes com vídeo" />
        <div className="zoom-share-surface" role="button" tabIndex={hasActiveShare ? 0 : -1} aria-hidden={!hasActiveShare} aria-label="Colocar compartilhamento de tela em destaque" onClick={() => setFocus("share")} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setFocus("share"); }}>
          <div className="zoom-remote-share" ref={shareContainer} />
          <canvas className={remoteShareFallback ? "zoom-remote-share-canvas active" : "zoom-remote-share-canvas"} ref={remoteShareCanvas} aria-label="Tela compartilhada" />
          <video className={sharing && sharePreviewKind === "video" ? "zoom-local-share active" : "zoom-local-share"} ref={sharePreviewVideo} muted playsInline aria-label="Prévia da sua tela compartilhada" />
          <canvas className={sharing && sharePreviewKind === "canvas" ? "zoom-local-share active" : "zoom-local-share"} ref={sharePreviewCanvas} aria-label="Prévia da sua tela compartilhada" />
          <span className="zoom-media-label"><MonitorUp size={14} /> {sharing ? "Você está compartilhando" : "Tela compartilhada"}</span>
        </div>
      </div>
      {stageInvite && <div className="stage-invite" role="dialog" aria-label="Convite para o palco"><strong>O organizador convidou você para o palco.</strong><span>Você decide se quer liberar microfone e câmera.</span><div><button type="button" className="button button-primary" onClick={acceptStageInvite}>Aceitar convite</button><button type="button" className="button button-secondary" onClick={() => setStageInvite(null)}>Agora não</button></div></div>}
      {mediaRequest && <div className="stage-invite" role="dialog" aria-label="Solicitação do organizador"><strong>Solicitação do organizador</strong><span>{mediaRequest.control === "audio" ? "Ligar seu microfone?" : mediaRequest.control === "video" ? "Ligar sua câmera?" : "Compartilhar sua tela?"}</span><div><button type="button" className="button button-primary" onClick={acceptMediaRequest}>Aceitar</button><button type="button" className="button button-secondary" onClick={() => setMediaRequest(null)}>Agora não</button></div></div>}
      {captionLanguage && liveCaption?.translations[captionLanguage] && <div className="live-caption-overlay" aria-live="polite" aria-atomic="true">
        <strong>{liveCaption.speaker_name}</strong>
        <span dir="auto">{liveCaption.translations[captionLanguage]}</span>
      </div>}
      {role === "host" && participantPanelOpen && <aside id="zoom-participant-directory" className="zoom-participant-panel" role="dialog" aria-modal="false" aria-label="Gerenciar participantes">
        <header>
          <div><strong>Participantes</strong><small>{audienceParticipants.length} conectados agora</small></div>
          <button type="button" className="zoom-panel-close" aria-label="Fechar participantes" onClick={() => { setParticipantPanelOpen(false); participantTrigger.current?.focus(); }}><X size={17} /></button>
        </header>
        <label className="zoom-participant-search">
          <Search size={16} aria-hidden="true" />
          <input ref={participantSearchInput} type="search" value={participantSearch} onChange={(event) => setParticipantSearch(event.target.value)} placeholder="Buscar por nome ou e-mail" aria-label="Buscar participante por nome ou e-mail" />
        </label>
        <div className="zoom-participant-filters" aria-label="Filtrar participantes">
          <button type="button" className={participantView === "all" ? "active" : ""} onClick={() => setParticipantView("all")}>Todos <span>{audienceParticipants.length}</span></button>
          {activeRoomMode === "event" && <button type="button" className={participantView === "stage" ? "active" : ""} onClick={() => setParticipantView("stage")}>No palco <span>{onStageParticipantCount}</span></button>}
        </div>
        {moderationFeedback && <div className={`zoom-moderation-feedback${moderationFeedback.failed ? " failed" : ""}`} role="status" aria-live="polite">{moderationFeedback.message}</div>}
        <div className="zoom-participant-list">
          {visibleParticipants.map((participant) => {
            const identity = participantIdentity(participant);
            const identityLabel = identity.startsWith("g:") ? "Visitante" : identity.startsWith("u:") ? "Conta" : "Externo";
            const directoryEntry = participantDirectory[identity];
            const stageMember = stageMembers[identity];
            const statusLabel = activeRoomMode === "meeting" ? "Participante" : stageMember?.status === "accepted" ? "No palco" : stageMember?.status === "pending" ? "Convite enviado" : identityLabel;
            const canModerateMedia = activeRoomMode === "meeting" || stageMember?.status === "accepted";
            return <div className={`zoom-participant-row${stageMember?.status === "accepted" ? " on-stage" : ""}`} key={participant.userId}>
              <span><strong>{participant.displayName}</strong><small title={directoryEntry?.email}>{directoryEntry?.email || statusLabel}</small>{directoryEntry?.email && <em>{statusLabel}</em>}</span>
              <div>
                {activeRoomMode === "event" && (stageMember?.status === "accepted"
                  ? <button type="button" className="remove-stage" onClick={() => removeFromStage(participant)} aria-label={`Tirar ${participant.displayName} do palco`} title="Tirar do palco"><UserMinus size={15} /></button>
                  : <button type="button" onClick={() => inviteToStage(participant)} disabled={stageMember?.status === "pending" || (!identity.startsWith("u:") && !identity.startsWith("g:"))} aria-label={`Convidar ${participant.displayName} ao palco`} title={stageMember?.status === "pending" ? "Convite enviado" : "Convidar ao palco"}><UserPlus size={15} /></button>)}
                <button type="button" className={moderationFeedback?.userId === participant.userId && moderationFeedback.control === "audio" ? moderationFeedback.failed ? "control-failed" : "control-confirmed" : ""} onClick={() => controlParticipantAudio(participant)} disabled={!canModerateMedia} aria-label={participant.muted ? `Solicitar microfone de ${participant.displayName}` : `Mutar ${participant.displayName}`} title={participant.muted ? "Pedir para ligar microfone" : "Mutar participante"}>{participant.muted ? <Mic size={15} /> : <MicOff size={15} />}</button>
                <button type="button" className={moderationFeedback?.userId === participant.userId && moderationFeedback.control === "video" ? moderationFeedback.failed ? "control-failed" : "control-confirmed" : ""} onClick={() => controlParticipantVideo(participant)} disabled={!canModerateMedia} aria-label={participant.bVideoOn ? `Desligar câmera de ${participant.displayName}` : `Solicitar câmera de ${participant.displayName}`} title={participant.bVideoOn ? "Desligar câmera" : "Pedir para ligar câmera"}>{participant.bVideoOn ? <VideoOff size={15} /> : <Video size={15} />}</button>
                <button type="button" className={moderationFeedback?.userId === participant.userId && moderationFeedback.control === "share" ? moderationFeedback.failed ? "control-failed" : "control-confirmed" : ""} onClick={() => controlParticipantShare(participant)} disabled={!canModerateMedia} aria-label={participant.sharerOn ? `Interromper compartilhamento de ${participant.displayName}` : `Solicitar compartilhamento de ${participant.displayName}`} title={participant.sharerOn ? "Interromper compartilhamento" : "Pedir compartilhamento de tela"}>{participant.sharerOn ? <MonitorX size={15} /> : <MonitorUp size={15} />}</button>
                {activeRoomMode === "meeting" && <button type="button" className="remove-participant" onClick={() => removeParticipant(participant)} aria-label={`Remover ${participant.displayName} da reunião`} title="Remover participante"><UserX size={15} /></button>}
              </div>
            </div>;
          })}
          {visibleParticipants.length === 0 && <div className="zoom-participant-empty"><Search size={20} /><strong>Ninguém encontrado</strong><span>Tente outro nome ou e-mail.</span></div>}
        </div>
      </aside>}
      {mediaFeedback && <div className="zoom-media-feedback" key={mediaFeedback.id} role="status" aria-live="polite">{mediaFeedback.message}</div>}
      <div className="zoom-controls" aria-label="Controles da reunião">
        {permissions.audio && <div className="zoom-control-combo">
          <button type="button" onClick={toggleAudio} className={`zoom-control-main ${audioOn ? "active" : "muted"}`} aria-label={audioOn ? "Desativar microfone" : "Ativar microfone"}>{audioOn ? <Mic size={19} /> : <MicOff size={19} />}<span>{audioOn ? "Microfone" : "Sem áudio"}</span></button>
          <button type="button" className={`zoom-control-arrow ${audioOn ? "active" : "muted"}`} aria-label="Opções do microfone" aria-expanded={deviceMenu === "audio"} onClick={() => setDeviceMenu((current) => current === "audio" ? null : "audio")}><ChevronUp size={15} /></button>
          {deviceMenu === "audio" && <div className="zoom-media-menu" role="dialog" aria-label="Opções do microfone">
            <strong>Microfone</strong>
            <select value={mediaPreferences.audioDeviceId} onChange={(event) => void changeAudioDevice(event.target.value)}><option value="">Microfone padrão</option>{audioDevices.map((device, index) => <option value={device.deviceId} key={device.deviceId}>{device.label || `Microfone ${index + 1}`}</option>)}</select>
            <div className="zoom-menu-toggle"><span><strong>Reduzir ruído</strong><small>{noiseSuppressionSupported ? "Filtra sons de fundo" : "Indisponível neste navegador"}</small></span><button type="button" className={`compact-toggle${mediaPreferences.noiseSuppression ? " active" : ""}`} role="switch" aria-checked={mediaPreferences.noiseSuppression} disabled={!noiseSuppressionSupported} aria-label="Reduzir ruído do microfone" onClick={() => void toggleNoiseSuppression()}><i /></button></div>
          </div>}
        </div>}
        {permissions.video && <div className="zoom-control-combo">
          <button type="button" onClick={toggleVideo} className={`zoom-control-main ${videoOn ? "active" : "muted"}`} aria-label={videoOn ? "Desativar câmera" : "Ativar câmera"}>{videoOn ? <Video size={19} /> : <VideoOff size={19} />}<span>{videoOn ? "Câmera" : "Sem vídeo"}</span></button>
          <button type="button" className={`zoom-control-arrow ${videoOn ? "active" : "muted"}`} aria-label="Opções da câmera" aria-expanded={deviceMenu === "video"} onClick={() => setDeviceMenu((current) => current === "video" ? null : "video")}><ChevronUp size={15} /></button>
          {deviceMenu === "video" && <div className="zoom-media-menu" role="dialog" aria-label="Opções da câmera">
            <strong>Câmera</strong>
            <select value={mediaPreferences.videoDeviceId} onChange={(event) => void changeVideoDevice(event.target.value)}><option value="">Câmera padrão</option>{videoDevices.map((device, index) => <option value={device.deviceId} key={device.deviceId}>{device.label || `Câmera ${index + 1}`}</option>)}</select>
            <span className="zoom-menu-label">Fundo</span>
            <div className="zoom-background-options"><button type="button" className={mediaPreferences.virtualBackgroundMode === "none" ? "selected" : ""} disabled={!virtualBackgroundSupported} onClick={() => void changeVirtualBackground("none")}>Sem efeito</button><button type="button" className={mediaPreferences.virtualBackgroundMode === "blur" ? "selected" : ""} disabled={!virtualBackgroundSupported} onClick={() => void changeVirtualBackground("blur")}>Desfocar</button></div>
          </div>}
        </div>}
        {permissions.screen_share && <button type="button" onClick={toggleShare} className={sharing ? "active" : "muted"} aria-label={sharing ? "Parar compartilhamento" : "Compartilhar tela"}><MonitorUp size={19} /><span>{sharing ? "Compartilhando" : "Tela"}</span></button>}
        <LiveCaptionControls
          canSpeak={permissions.audio}
          microphoneOn={audioOn}
          captionLanguage={captionLanguage}
          onCaptionLanguageChange={setCaptionLanguage}
          onTranscript={publishTranscript}
        />
        <button type="button" onClick={leave} className="danger"><PhoneOff size={19} /><span>Sair</span></button>
      </div>
    </div>
  );
}
