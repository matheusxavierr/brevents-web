import type { LiveCaption } from "./api-types";
import { localeIntl, translateMessage, type Locale } from "./i18n";
import { mergeTranscriptHistory } from "./zoom-captions";

export type TranscriptCursor = { before_at: string; before_id: string };

export async function loadCompleteTranscript(fetchPage: (cursor?: TranscriptCursor) => Promise<LiveCaption[]>, locale: Locale = "pt"): Promise<LiveCaption[]> {
  let cursor: TranscriptCursor | undefined;
  let entries: LiveCaption[] = [];
  const seen = new Set<string>();
  while (true) {
    const page = await fetchPage(cursor);
    if (!Array.isArray(page)) throw new Error(translateMessage(locale, "O histórico de transcrição retornou um formato inválido."));
    entries = mergeTranscriptHistory(page, entries);
    if (page.length < 500) return entries;
    const first = page[0];
    const key = `${first.created_at}:${first.id}`;
    if (seen.has(key)) throw new Error(translateMessage(locale, "Não foi possível buscar todas as páginas da transcrição."));
    seen.add(key);
    cursor = { before_at: first.created_at, before_id: first.id };
  }
}

export function transcriptText(entries: LiveCaption[], title: string, roomName: string, timeZone = "America/Sao_Paulo", locale: Locale = "pt"): string {
  const formatter = new Intl.DateTimeFormat(localeIntl[locale], { timeZone, dateStyle: "short", timeStyle: "medium" });
  const lines = mergeTranscriptHistory([], entries).map((entry) => {
    const date = new Date(entry.created_at);
    const when = Number.isNaN(date.getTime()) ? translateMessage(locale, "Horário indisponível") : formatter.format(date);
    return `[${when}] ${entry.speaker_name}\r\n${entry.original_text}`;
  });
  const roomLabel = translateMessage(locale, "Sala: {room}", { room: roomName });
  const timeZoneLabel = translateMessage(locale, "Fuso: {timeZone}", { timeZone });
  return `\uFEFF${translateMessage(locale, "BR Events — Transcrição")}\r\n${title}\r\n${roomLabel}\r\n${timeZoneLabel}\r\n${translateMessage(locale, "Texto original das falas")}\r\n\r\n${lines.join("\r\n\r\n")}\r\n`;
}

export function downloadTranscript(entries: LiveCaption[], title: string, roomName: string, timeZone: string, locale: Locale = "pt"): void {
  const blob = new Blob([transcriptText(entries, title, roomName, timeZone, locale)], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const name = `${title}-${roomName}`.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").slice(0, 140);
  link.href = url;
  link.download = `${translateMessage(locale, "transcrição")}-${name || translateMessage(locale, "reunião")}.txt`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
