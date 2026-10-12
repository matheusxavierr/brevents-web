import type { CaptionLanguage, LiveCaption } from "./api-types";

export const captionLanguages = {
  "pt-BR": { label: "Português", short: "PT", zoom: "pt", translation: "pt-br", code: 40 },
  "en-US": { label: "English", short: "EN", zoom: "en", translation: "en", code: 0 },
  "es-ES": { label: "Español", short: "ES", zoom: "es", translation: "es", code: 7 },
  "ar-SA": { label: "العربية", short: "AR", zoom: "ar", translation: "ar", code: 14 },
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
  if (error && typeof error === "object" && "type" in error && error.type === "OPERATION_TIMEOUT") return "O Zoom demorou para confirmar o idioma solicitado. Tente novamente se a legenda não aparecer.";
  const code = error && typeof error === "object" && "errorCode" in error ? error.errorCode : null;
  if (code === 7300) return "Transcrição e tradução não estão habilitadas nesta conta Zoom.";
  if (code === 7301) return "As legendas foram desativadas pelo organizador.";
  if (code === 7304) return "A tradução não está habilitada nesta conta Zoom. A transcrição pode continuar disponível.";
  return "Não foi possível configurar as legendas do Zoom. Tente novamente.";
}

export function assertCaptionSuccess(result: unknown): void {
  if (result === "" || result === undefined) return;
  if (result && typeof result === "object") {
    if ("type" in result || "errorCode" in result) throw result;
    // SDK 2.5 resolves startLiveTranscription with caption-status, despite its
    // declaration promising ExecutedResult. Do not reject a real active status.
    if ("autoCaption" in result && result.autoCaption === true) return;
  }
  throw new Error("O Zoom retornou um resultado inesperado ao configurar as legendas.");
}

type CurrentLanguage = { code: string } | null;

export async function configureCaptionLanguage(
  current: () => CurrentLanguage,
  configure: () => Promise<unknown>,
  requested: string | undefined,
): Promise<void> {
  const matches = () => current()?.code.toLowerCase() === requested;
  if (matches()) return;
  try {
    assertCaptionSuccess(await configure());
  } catch (reason) {
    // A timeout can be a missing acknowledgement, not a failed change. Only
    // accept it when the SDK confirms the exact requested language is active.
    if (reason && typeof reason === "object" && "type" in reason && reason.type === "OPERATION_TIMEOUT" && matches()) return;
    throw reason;
  }
}

export function shouldDisplayCaption(message: ZoomCaptionMessage, selected: CaptionLanguage | null, speakerLanguage: CaptionLanguage | undefined): boolean {
  if (!selected) return false;
  return message.language === captionLanguages[selected].code
    || (message.language === 400 && speakerLanguage === selected);
}

export function mergeTranscriptHistory(history: LiveCaption[], incoming: LiveCaption[]): LiveCaption[] {
  const entries = new Map<string, LiveCaption>();
  for (const entry of [...history, ...incoming]) {
    const id = entry.message_id ? `zoom:${entry.zoom_session}:${entry.message_id}` : entry.id;
    entries.set(id, { ...entry, id });
  }
  return [...entries.values()].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
}
