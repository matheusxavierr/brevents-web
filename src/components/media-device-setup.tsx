"use client";

import { Camera, CameraOff, Mic, MicOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export type VirtualBackgroundMode = "none" | "blur";

export type MediaPreferences = {
  audioEnabled: boolean;
  videoEnabled: boolean;
  audioDeviceId: string;
  videoDeviceId: string;
  noiseSuppression: boolean;
  virtualBackgroundMode: VirtualBackgroundMode;
};

export const defaultMediaPreferences: MediaPreferences = {
  audioEnabled: false,
  videoEnabled: false,
  audioDeviceId: "",
  videoDeviceId: "",
  noiseSuppression: true,
  virtualBackgroundMode: "none",
};

type MediaDeviceSetupProps = {
  value: MediaPreferences;
  onChange: (preferences: MediaPreferences) => void;
  active?: boolean;
  stopPreviewRef?: { current: (() => Promise<void>) | null };
};

export function MediaDeviceSetup({ value, onChange, active = true, stopPreviewRef }: MediaDeviceSetupProps) {
  const preview = useRef<HTMLDivElement>(null);
  const audioStream = useRef<MediaStream | null>(null);
  const videoTrack = useRef<ReturnType<typeof import("@zoom/videosdk")["default"]["createLocalVideoTrack"]> | null>(null);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function refreshDevices() {
      if (!navigator.mediaDevices?.enumerateDevices) return;
      const devices = await navigator.mediaDevices.enumerateDevices();
      if (cancelled) return;
      setAudioDevices(devices.filter((device) => device.kind === "audioinput"));
      setVideoDevices(devices.filter((device) => device.kind === "videoinput"));
    }

    void refreshDevices().catch((reason) => {
      console.error("Não foi possível listar os dispositivos de mídia.", reason);
    });
    navigator.mediaDevices?.addEventListener("devicechange", refreshDevices);
    return () => {
      cancelled = true;
      navigator.mediaDevices?.removeEventListener("devicechange", refreshDevices);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function stopPreview() {
      audioStream.current?.getTracks().forEach((track) => track.stop());
      audioStream.current = null;
      const activeVideoTrack = videoTrack.current;
      videoTrack.current = null;
      if (activeVideoTrack) await activeVideoTrack.stop();
      preview.current?.replaceChildren();
    }

    if (stopPreviewRef) stopPreviewRef.current = stopPreview;

    async function updatePreview() {
      await stopPreview();
      setError("");
      if (!active || (!value.audioEnabled && !value.videoEnabled)) return;

      try {
        if (value.audioEnabled) {
          const nextAudioStream = await navigator.mediaDevices.getUserMedia({
            audio: { deviceId: value.audioDeviceId ? { exact: value.audioDeviceId } : undefined, noiseSuppression: value.noiseSuppression },
            video: false,
          });
          if (cancelled) nextAudioStream.getTracks().forEach((track) => track.stop());
          else audioStream.current = nextAudioStream;
        }
        if (value.videoEnabled && !cancelled && preview.current) {
          const zoom = await import("@zoom/videosdk");
          const track = zoom.default.createLocalVideoTrack(value.videoDeviceId || undefined);
          const player = document.createElement("video-player");
          player.setAttribute("aria-label", "Prévia da câmera");
          preview.current.replaceChildren(player);
          videoTrack.current = track;
          const result = await track.start(
            player as Parameters<typeof track.start>[0],
            value.virtualBackgroundMode === "blur" ? { imageUrl: "blur", cropped: true } : undefined,
          );
          if (result instanceof Error) throw result;
        }
        const devices = await navigator.mediaDevices.enumerateDevices();
        if (!cancelled) {
          setAudioDevices(devices.filter((device) => device.kind === "audioinput"));
          setVideoDevices(devices.filter((device) => device.kind === "videoinput"));
        }
      } catch (reason) {
        console.error("Não foi possível abrir os dispositivos selecionados.", reason);
        setError("Não foi possível acessar a câmera ou o microfone. Verifique a permissão do navegador.");
      }
    }

    void updatePreview();
    return () => {
      cancelled = true;
      if (stopPreviewRef?.current === stopPreview) stopPreviewRef.current = null;
      void stopPreview();
    };
  }, [active, stopPreviewRef, value.audioDeviceId, value.audioEnabled, value.noiseSuppression, value.videoDeviceId, value.videoEnabled, value.virtualBackgroundMode]);

  function update(patch: Partial<MediaPreferences>) {
    onChange({ ...value, ...patch });
  }

  return (
    <div className="media-device-setup">
      <div className={`media-preview${value.videoEnabled ? " camera-on" : ""}`}>
        <div className="media-preview-player" ref={preview} />
        {!value.videoEnabled && <div><CameraOff size={30} /><span>Câmera desligada</span></div>}
      </div>
      <div className="media-device-controls">
        <div className="media-toggle-row">
          <button type="button" className={value.audioEnabled ? "active" : ""} onClick={() => update({ audioEnabled: !value.audioEnabled })}>
            {value.audioEnabled ? <Mic size={18} /> : <MicOff size={18} />}
            {value.audioEnabled ? "Microfone ligado" : "Microfone desligado"}
          </button>
          <button type="button" className={value.videoEnabled ? "active" : ""} onClick={() => update({ videoEnabled: !value.videoEnabled })}>
            {value.videoEnabled ? <Camera size={18} /> : <CameraOff size={18} />}
            {value.videoEnabled ? "Câmera ligada" : "Câmera desligada"}
          </button>
        </div>
        <div className="media-device-field">
          <div className="media-label-row"><label htmlFor="prejoin-microphone">Microfone</label><span className="compact-toggle-label">Reduzir ruído <button type="button" className={`compact-toggle${value.noiseSuppression ? " active" : ""}`} role="switch" aria-checked={value.noiseSuppression} aria-label="Reduzir ruído do microfone" onClick={() => update({ noiseSuppression: !value.noiseSuppression })}><i /></button></span></div>
          <select id="prejoin-microphone" value={value.audioDeviceId} onChange={(event) => update({ audioDeviceId: event.target.value })}>
            <option value="">Microfone padrão</option>
            {audioDevices.map((device, index) => <option value={device.deviceId} key={device.deviceId}>{device.label || `Microfone ${index + 1}`}</option>)}
          </select>
        </div>
        <label>
          <span>Câmera</span>
          <select value={value.videoDeviceId} onChange={(event) => update({ videoDeviceId: event.target.value })}>
            <option value="">Câmera padrão</option>
            {videoDevices.map((device, index) => <option value={device.deviceId} key={device.deviceId}>{device.label || `Câmera ${index + 1}`}</option>)}
          </select>
        </label>
        <label><span>Fundo da câmera</span><select value={value.virtualBackgroundMode} onChange={(event) => update({ virtualBackgroundMode: event.target.value as VirtualBackgroundMode })}><option value="none">Sem efeito</option><option value="blur">Desfocar fundo</option></select></label>
        {error && <p className="media-device-error" role="alert">{error}</p>}
      </div>
    </div>
  );
}
