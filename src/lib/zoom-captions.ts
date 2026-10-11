import type { CaptionLanguage, LiveCaption } from "./api-types";

export const captionLanguages = {
  "pt-BR": { label: "Português", short: "PT", zoom: "pt", code: 6 },
  "en-US": { label: "English", short: "EN", zoom: "en", code: 0 },
  "es-ES": { label: "Español", short: "ES", zoom: "es", code: 7 },
  "ar-SA": { label: "العربية", short: "AR", zoom: "ar", code: 14 },
} as const;

export type ZoomCaptionMessage = {
  msgId: string;
  userId: number;
  displayName: string;
  text: string;
  language: number;
  timestamp: number;
  done?: boolean;
};

export function isCaptionLanguage(value: string | null): value is CaptionLanguage {
  return value !== null && Object.hasOwn(captionLanguages, value);
}

export function defaultSpokenLanguage(): CaptionLanguage {
  if (typeof navigator === "undefined") return "pt-BR";
  const language = navigator.language.toLowerCase();
  if (language.startsWith("en")) return "en-US";
  if (language.startsWith("es")) return "es-ES";
  if (language.startsWith("ar")) return "ar-SA";
  return "pt-BR";
}

export function captionTimestamp(timestamp: number): string {
  // Zoom's timestamp is Unix time; some SDK transports return milliseconds.
  return new Date(timestamp < 1e12 ? timestamp * 1000 : timestamp).toISOString();
}

export function captionError(error: unknown): string {
  const code = error && typeof error === "object" && "errorCode" in error ? error.errorCode : null;
  if (code === 7300) return "Transcrição e tradução não estão habilitadas nesta conta Zoom.";
  if (code === 7301) return "As legendas foram desativadas pelo organizador.";
  if (code === 7304) return "A tradução não está habilitada nesta conta Zoom. A transcrição pode continuar disponível.";
  return "Não foi possível configurar as legendas do Zoom. Tente novamente.";
}

export function assertCaptionSuccess(result: unknown): void {
  if (result !== "" && result !== undefined) throw result;
}

export function mergeTranscriptHistory(history: LiveCaption[], incoming: LiveCaption[]): LiveCaption[] {
  const entries = new Map<string, LiveCaption>();
  for (const entry of [...history, ...incoming]) {
    const id = entry.message_id ? `zoom:${entry.zoom_session}:${entry.message_id}` : entry.id;
    entries.set(id, { ...entry, id });
  }
  return [...entries.values()].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
}
