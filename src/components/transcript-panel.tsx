"use client";

import { Download, FileText } from "lucide-react";
import { formatChatTime } from "@/lib/format-date";
import type { LiveCaption } from "@/lib/api-types";

type Props = { captions: LiveCaption[]; loading: boolean; downloading: boolean; error: string; download: () => Promise<void>; ended?: boolean };

export function TranscriptDownload({ captions, downloading, download }: Pick<Props, "captions" | "downloading" | "download">) {
  return <button className="transcript-download" type="button" disabled={downloading || captions.length === 0} onClick={() => void download()}><Download size={15} aria-hidden="true" />{downloading ? "Preparando…" : "Baixar transcrição"}</button>;
}

export function TranscriptPanel(props: Props) {
  return <>
    <div className="transcript-toolbar"><span>{props.ended ? "Transcrição da sala" : "Transcrição ao vivo"}</span><TranscriptDownload {...props} /></div>
    {props.error && <p className="transcript-notice" role="alert">{props.error}</p>}
    {props.loading && <p className="transcript-notice" role="status">Carregando histórico…</p>}
    {props.captions.length ? props.captions.map((caption) => <article className="meeting-transcript-entry" key={caption.id}><strong>{caption.speaker_name}</strong><time>{formatChatTime(caption.created_at)}</time><p>{caption.original_text}</p></article>) : <div className="meeting-panel-empty"><FileText size={24} /><strong>Transcrição da sala</strong><span>As falas aparecem aqui quando os microfones estão ligados. O texto é registrado no idioma original.</span></div>}
  </>;
}
