"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff, MonitorUp, MonitorX, PhoneOff, Search, Settings, UserMinus, UserPlus, Users, Video, VideoOff, X } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import type { CaptionLanguage, LiveCaption, ParticipantDirectoryEntry, StageInvitation, ZoomJoinResponse, ZoomSession } from "@/lib/api-types";
import { LiveCaptionControls } from "./live-caption-controls";

type ZoomModule = typeof import("@zoom/videosdk");
type ZoomClient = ReturnType<ZoomModule["default"]["createClient"]>;
type ZoomStream = ReturnType<ZoomClient["getMediaStream"]>;
type ZoomParticipant = ReturnType<ZoomClient["getAllUser"]>[number];
type StageInvite = { senderId: number; audio: boolean; video: boolean; screen_share: boolean };
type StageMember = Pick<StageInvitation, "status" | "allow_audio" | "allow_video" | "allow_screen_share">;
type MediaControl = "audio" | "video" | "share";
type MediaRequest = { senderId: number; control: MediaControl };

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

export function ZoomVideoRoom({ session, eventId, guest = false }: { session: ZoomSession; eventId: string; guest?: boolean }) {
  const container = useRef<HTMLDivElement>(null);
  const shareContainer = useRef<HTMLDivElement>(null);
  const sharePreviewVideo = useRef<HTMLVideoElement>(null);
  const sharePreviewCanvas = useRef<HTMLCanvasElement>(null);
  const remoteShareCanvas = useRef<HTMLCanvasElement>(null);
  const clientRef = useRef<ZoomClient | null>(null);
  const streamRef = useRef<ZoomStream | null>(null);
  const zoomRef = useRef<ZoomModule | null>(null);
  const videoPlayers = useRef(new Map<number, HTMLElement>());
  const videoAttachVersions = useRef(new Map<number, number>());
  const remoteSharePlayer = useRef<HTMLElement | null>(null);
  const remoteShareUsesCanvas = useRef(false);
  const activeShareUserIdRef = useRef<number | null>(null);
  const mediaStateRef = useRef({ audioOn: false, videoOn: false, sharing: false });
  const heartbeatTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const participantDirectoryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const moderationFeedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const feedbackId = useRef(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const participantTrigger = useRef<HTMLButtonElement>(null);
  const participantSearchInput = useRef<HTMLInputElement>(null);
  const selfIdentity = useRef("");
  const captionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHost = useRef(false);
  const [state, setState] = useState<"ready" | "joining" | "joined" | "left">("ready");
  const [error, setError] = useState("");
  const [audioOn, setAudioOn] = useState(false);
  const [videoOn, setVideoOn] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [sharePreviewKind, setSharePreviewKind] = useState<"video" | "canvas" | null>(null);
  const [activeShareUserId, setActiveShareUserId] = useState<number | null>(null);
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
  }, [eventId, guest, session.id]);

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

  function zoomFailureReason(result: unknown) {
    if (!result || typeof result !== "object" || !("type" in result)) return "retorno inválido do Zoom SDK";
    const failure = result as { type: string; reason?: string; errorCode?: number };
    return `${failure.type}${failure.errorCode ? ` (${failure.errorCode})` : ""}: ${failure.reason ?? "sem detalhes"}`;
  }

  function ensureZoomSuccess(result: unknown) {
    if (result && typeof result === "object" && "type" in result) {
      const failure = result as { errorCode?: number };
      const error = new Error(zoomFailureReason(result)) as Error & { errorCode?: number };
      error.errorCode = failure.errorCode;
      throw error;
    }
  }

  async function refreshParticipantDirectory() {
    const entries = await apiClient<ParticipantDirectoryEntry[]>(`zoom-sessions/${session.id}/participant-directory/`);
    setParticipantDirectory(Object.fromEntries(entries.map((entry) => [entry.identity, entry])));
  }

  function refreshParticipants() {
    if (clientRef.current) setParticipants(clientRef.current.getAllUser());
    if (!isHost.current) return;
    if (participantDirectoryTimer.current) clearTimeout(participantDirectoryTimer.current);
    participantDirectoryTimer.current = setTimeout(() => {
      refreshParticipantDirectory().catch((directoryError) => {
        console.error("Não foi possível atualizar o diretório de participantes.", directoryError);
      });
    }, 350);
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
    player.tabIndex = 0;
    player.setAttribute("role", "button");
    player.setAttribute("aria-label", "Colocar este vídeo em destaque");
    player.addEventListener("click", () => setFocus(`video:${userId}`));
    player.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") setFocus(`video:${userId}`);
    });
  }

  async function attachVideo(userId: number) {
    const stream = streamRef.current;
    const zoom = zoomRef.current;
    if (!stream || !zoom || !container.current) return;
    const version = (videoAttachVersions.current.get(userId) ?? 0) + 1;
    videoAttachVersions.current.set(userId, version);
    const player = await stream.attachVideo(userId, zoom.VideoQuality.Video_360P);
    if (player instanceof HTMLElement) {
      if (videoAttachVersions.current.get(userId) !== version || !container.current) {
        player.remove();
        return;
      }
      videoPlayers.current.get(userId)?.remove();
      player.dataset.zoomUserId = String(userId);
      videoPlayers.current.set(userId, player);
      makeVideoFocusable(player, userId);
      ensureSdkContainer(container.current, "zoom-video-sdk-container").appendChild(player);
    }
  }

  async function detachVideo(userId: number) {
    videoAttachVersions.current.set(userId, (videoAttachVersions.current.get(userId) ?? 0) + 1);
    await streamRef.current?.detachVideo(userId);
    videoPlayers.current.get(userId)?.remove();
    videoPlayers.current.delete(userId);
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
    setRemoteShareFallback(false);
    setFocus((current) => current === "share" ? "grid" : current);
  }

  async function join() {
    setState("joining");
    setError("");
    try {
      const credentials = guest
        ? await fetch(`/api/guest/zoom/${session.id}/join`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ eventId }),
          }).then(async (response) => {
            const data = await response.json();
            if (!response.ok) throw new Error(typeof data.detail === "string" ? data.detail : "Não foi possível validar seu ingresso.");
            return data as ZoomJoinResponse;
          })
        : await apiClient<ZoomJoinResponse>(`zoom-sessions/${session.id}/join/`, { method: "POST" });
      const zoom = await import("@zoom/videosdk");
      const client = zoom.default.createClient();
      zoomRef.current = zoom;
      clientRef.current = client;
      await client.init("en-US", "Global", { patchJsMedia: true, leaveOnPageUnload: true });
      await client.join(
        credentials.session_name,
        credentials.token,
        credentials.user_name,
        credentials.session_passcode,
      );
      const stream = client.getMediaStream();
      streamRef.current = stream;
      selfIdentity.current = participantIdentity(client.getCurrentUserInfo());
      setPermissions(credentials.media_permissions);
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
      setParticipants(client.getAllUser());
      setState("joined");

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

      client.on("user-added", refreshParticipants);
      client.on("user-removed", refreshParticipants);
      client.on("user-updated", refreshParticipants);
      client.on("command-channel-message", async (payload) => {
        try {
          const command = JSON.parse(payload.text) as {
            type?: string;
            permissions?: ZoomJoinResponse["media_permissions"];
            caption?: LiveCaption;
          };
          const senderId = Number(payload.senderId);
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
            setVideoOn(false);
          }
          if (command.type === "stage.stop-share") {
            await stream.stopShareScreen();
            setSharing(false);
            setSharePreviewKind(null);
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
            captionTimer.current = setTimeout(() => setLiveCaption(null), 8_000);
          }
        } catch (commandError) {
          console.error("Não foi possível processar o comando de palco.", commandError);
        }
      });
      client.on("peer-video-state-change", async ({ action, userId }) => {
        if (action === "Start") await attachVideo(userId);
        else await detachVideo(userId);
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
        await stream.startAudio();
        if (!stream.isAudioMuted()) await stream.muteAudio();
        mediaStateRef.current.audioOn = false;
        setAudioOn(false);
      } catch (audioStartError) {
        console.error("Não foi possível conectar ao áudio da sala.", audioStartError);
        mediaStateRef.current.audioOn = false;
        setAudioOn(false);
      }
      mediaStateRef.current.videoOn = false;
      setVideoOn(false);
    } catch (reason) {
      setState("ready");
      setError(reason instanceof Error ? reason.message : "Não foi possível entrar na sala Zoom.");
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
      await stream.startVideo();
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

  async function leave() {
    const client = clientRef.current;
    if (heartbeatTimer.current) clearInterval(heartbeatTimer.current);
    heartbeatTimer.current = null;
    if (participantDirectoryTimer.current) clearTimeout(participantDirectoryTimer.current);
    participantDirectoryTimer.current = null;
    if (moderationFeedbackTimer.current) clearTimeout(moderationFeedbackTimer.current);
    moderationFeedbackTimer.current = null;
    if (captionTimer.current) clearTimeout(captionTimer.current);
    captionTimer.current = null;
    if (isHost.current) {
      try { await apiClient(`zoom-sessions/${session.id}/end-live/`, { method: "POST" }); }
      catch (endLiveError) { console.error("Não foi possível encerrar o status da transmissão.", endLiveError); }
    }
    isHost.current = false;
    if (client) await client.leave();
    container.current?.replaceChildren();
    shareContainer.current?.querySelector("video-player-container")?.remove();
    videoPlayers.current.clear();
    videoAttachVersions.current.clear();
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
      void audioContextRef.current?.close();
      if (isHost.current) {
        void fetch(`/api/backend/zoom-sessions/${session.id}/end-live/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
          keepalive: true,
        });
      }
      clientRef.current?.leave().catch(() => undefined);
    };
  }, [session.id]);

  if (state !== "joined") {
    return (
      <div className="zoom-prejoin">
        <span className="live-pill"><span className="live-dot" /> Sala interativa</span>
        <h1>{state === "left" ? "Você saiu da sala" : "Entre no palco ao vivo"}</h1>
        <p>Áudio, vídeo e interação em tempo real, sem sair do BR Events.</p>
        <div className="zoom-capabilities" aria-label="Recursos da sala">
          <span><Video size={15} /> Live Meeting</span>
        </div>
        <button className="button button-primary" onClick={join} disabled={state === "joining"}>
          {state === "joining" ? "Conectando…" : state === "left" ? "Entrar novamente" : "Entrar na sala"}
        </button>
        {!session.configured && <p className="zoom-setup-note">Aguardando as credenciais do Zoom Video SDK no servidor.</p>}
        {error && <p className="live-error" role="alert">{error}</p>}
      </div>
    );
  }

  const hasActiveShare = sharing || activeShareUserId !== null;
  const focusClass = focus === "share" ? "share-focused" : focus.startsWith("video:") ? "video-focused" : "grid-focused";
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
      <div className="zoom-meeting-status">
        <span className="live-dot" /> AO VIVO · {role === "host" ? "ORGANIZADOR" : onStage ? "NO PALCO" : role === "viewer" ? "ESPECTADOR" : "PLATEIA"}
        {role === "host"
          ? <div className="zoom-meeting-actions"><a className="zoom-event-settings" href={`/painel?event=${encodeURIComponent(eventId)}&tab=settings`} target="_blank" rel="noopener noreferrer"><Settings size={14} /> Configurar evento</a><button ref={participantTrigger} type="button" className="zoom-participant-trigger" aria-expanded={participantPanelOpen} aria-controls="zoom-participant-directory" onClick={() => setParticipantPanelOpen((current) => !current)}><Users size={14} /> Participantes <strong>{audienceParticipants.length}</strong></button></div>
          : <span><Users size={14} /> {participants.length}</span>}
      </div>
      <div className={`zoom-media-stage ${hasActiveShare ? "has-share" : "no-share"} ${focusClass}`}>
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
        <span>{liveCaption.translations[captionLanguage]}</span>
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
          <button type="button" className={participantView === "stage" ? "active" : ""} onClick={() => setParticipantView("stage")}>No palco <span>{onStageParticipantCount}</span></button>
        </div>
        {moderationFeedback && <div className={`zoom-moderation-feedback${moderationFeedback.failed ? " failed" : ""}`} role="status" aria-live="polite">{moderationFeedback.message}</div>}
        <div className="zoom-participant-list">
          {visibleParticipants.map((participant) => {
            const identity = participantIdentity(participant);
            const identityLabel = identity.startsWith("g:") ? "Visitante" : identity.startsWith("u:") ? "Conta" : "Externo";
            const directoryEntry = participantDirectory[identity];
            const stageMember = stageMembers[identity];
            const statusLabel = stageMember?.status === "accepted" ? "No palco" : stageMember?.status === "pending" ? "Convite enviado" : identityLabel;
            return <div className={`zoom-participant-row${stageMember?.status === "accepted" ? " on-stage" : ""}`} key={participant.userId}>
              <span><strong>{participant.displayName}</strong><small title={directoryEntry?.email}>{directoryEntry?.email || statusLabel}</small>{directoryEntry?.email && <em>{statusLabel}</em>}</span>
              <div>
                {stageMember?.status === "accepted"
                  ? <button type="button" className="remove-stage" onClick={() => removeFromStage(participant)} aria-label={`Tirar ${participant.displayName} do palco`} title="Tirar do palco"><UserMinus size={15} /></button>
                  : <button type="button" onClick={() => inviteToStage(participant)} disabled={stageMember?.status === "pending" || (!identity.startsWith("u:") && !identity.startsWith("g:"))} aria-label={`Convidar ${participant.displayName} ao palco`} title={stageMember?.status === "pending" ? "Convite enviado" : "Convidar ao palco"}><UserPlus size={15} /></button>}
                <button type="button" className={moderationFeedback?.userId === participant.userId && moderationFeedback.control === "audio" ? moderationFeedback.failed ? "control-failed" : "control-confirmed" : ""} onClick={() => controlParticipantAudio(participant)} disabled={stageMember?.status !== "accepted"} aria-label={participant.muted ? `Solicitar microfone de ${participant.displayName}` : `Mutar ${participant.displayName}`} title={participant.muted ? "Pedir para ligar microfone" : "Mutar participante"}>{participant.muted ? <Mic size={15} /> : <MicOff size={15} />}</button>
                <button type="button" className={moderationFeedback?.userId === participant.userId && moderationFeedback.control === "video" ? moderationFeedback.failed ? "control-failed" : "control-confirmed" : ""} onClick={() => controlParticipantVideo(participant)} disabled={stageMember?.status !== "accepted"} aria-label={participant.bVideoOn ? `Desligar câmera de ${participant.displayName}` : `Solicitar câmera de ${participant.displayName}`} title={participant.bVideoOn ? "Desligar câmera" : "Pedir para ligar câmera"}>{participant.bVideoOn ? <VideoOff size={15} /> : <Video size={15} />}</button>
                <button type="button" className={moderationFeedback?.userId === participant.userId && moderationFeedback.control === "share" ? moderationFeedback.failed ? "control-failed" : "control-confirmed" : ""} onClick={() => controlParticipantShare(participant)} disabled={stageMember?.status !== "accepted"} aria-label={participant.sharerOn ? `Interromper compartilhamento de ${participant.displayName}` : `Solicitar compartilhamento de ${participant.displayName}`} title={participant.sharerOn ? "Interromper compartilhamento" : "Pedir compartilhamento de tela"}>{participant.sharerOn ? <MonitorX size={15} /> : <MonitorUp size={15} />}</button>
              </div>
            </div>;
          })}
          {visibleParticipants.length === 0 && <div className="zoom-participant-empty"><Search size={20} /><strong>Ninguém encontrado</strong><span>Tente outro nome ou e-mail.</span></div>}
        </div>
      </aside>}
      {mediaFeedback && <div className="zoom-media-feedback" key={mediaFeedback.id} role="status" aria-live="polite">{mediaFeedback.message}</div>}
      <div className="zoom-controls" aria-label="Controles da reunião">
        {permissions.audio && <button type="button" onClick={toggleAudio} className={audioOn ? "active" : "muted"} aria-label={audioOn ? "Desativar microfone" : "Ativar microfone"}>
          {audioOn ? <Mic size={19} /> : <MicOff size={19} />}<span>{audioOn ? "Microfone" : "Sem áudio"}</span>
        </button>}
        {permissions.video && <button type="button" onClick={toggleVideo} className={videoOn ? "active" : "muted"} aria-label={videoOn ? "Desativar câmera" : "Ativar câmera"}>
          {videoOn ? <Video size={19} /> : <VideoOff size={19} />}<span>{videoOn ? "Câmera" : "Sem vídeo"}</span>
        </button>}
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
