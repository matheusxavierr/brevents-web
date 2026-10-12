import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useZoomCaptions } from "@/components/use-zoom-captions";
import { LiveCaptionControls } from "@/components/live-caption-controls";
import { fireEvent, render, screen } from "@testing-library/react";
import { assertCaptionSuccess, captionTimestamp, configureCaptionLanguage, mergeTranscriptHistory, shouldDisplayCaption, type ZoomCaptionMessage } from "@/lib/zoom-captions";

function mockClient() {
  const listeners = new Map<string, (...args: never[]) => void>();
  let speaking: string | undefined;
  let reading: string | undefined;
  const ltt = {
    startLiveTranscription: vi.fn().mockResolvedValue({ autoCaption: true, lang: 6, language: "pt" }),
    setSpeakingLanguage: vi.fn().mockImplementation(async (language: string) => { speaking = language; return ""; }),
    setTranslationLanguage: vi.fn().mockImplementation(async (language?: string) => { reading = language; return ""; }),
    getCurrentTranscriptionLanguage: vi.fn(() => speaking ? { code: speaking } : null),
    getCurrentTranslationLanguage: vi.fn(() => reading ? { code: reading } : null),
    disableCaptions: vi.fn(),
    getLiveTranscriptionStatus: vi.fn().mockReturnValue({
      isLiveTranscriptionEnabled: true, isLiveTranslationEnabled: true, isHostDisableCaptions: false,
      transcriptionLanguage: "en;pt;es;ar;",
      translationLanguage: [{ speakingLanguage: "pt", translatedToLanguage: "pt-br;pt-pt;en;es;ar;" }, { speakingLanguage: "en", translatedToLanguage: "pt-br;pt-pt;es;ar;" }],
    }),
  };
  const client = {
    getLiveTranscriptionClient: () => ltt,
    getCurrentUserInfo: () => ({ userId: 42 }),
    getAllUser: () => [{ userId: 42 }, { userId: 7 }],
    getCommandClient: () => ({ send: vi.fn().mockResolvedValue({ text: "language metadata" }) }),
    on: vi.fn((event, listener) => listeners.set(event, listener)),
    off: vi.fn((event) => listeners.delete(event)),
  };
  const emit = (message: ZoomCaptionMessage) => act(() => listeners.get("caption-message")?.(message as never));
  const emitEvent = (name: string, value: unknown) => act(() => listeners.get(name)?.(value as never));
  return { client: client as unknown as Parameters<typeof useZoomCaptions>[0]["client"], ltt, emit, emitEvent };
}
const message = { msgId: "phrase-1", userId: 42, displayName: "Organizador", text: "Bom dia", language: 400, timestamp: 1791737780, done: true };

describe("Zoom native captions", () => {
  beforeEach(() => localStorage.clear());
  it("uses original captions only when the actual speaker's language matches the selected reading language", () => {
    expect(shouldDisplayCaption(message, "en-US", "en-US")).toBe(true);
    expect(shouldDisplayCaption(message, "en-US", "pt-BR")).toBe(false);
    expect(shouldDisplayCaption(message, "en-US", undefined)).toBe(false);
    expect(shouldDisplayCaption(message, null, "en-US")).toBe(false);
    expect(shouldDisplayCaption({ ...message, language: 0 }, "en-US", "pt-BR")).toBe(true);
  });
  it("does not reapply an already-active reading language, and accepts only a confirmed timeout", async () => {
    const configure = vi.fn();
    await configureCaptionLanguage(() => ({ code: "en" }), configure, "en");
    expect(configure).not.toHaveBeenCalled();
    let code = "es";
    const timeout = { type: "OPERATION_TIMEOUT", errorCode: 1 };
    configure.mockImplementationOnce(async () => { code = "en"; throw timeout; });
    await expect(configureCaptionLanguage(() => ({ code }), configure, "en")).resolves.toBeUndefined();
    configure.mockRejectedValueOnce(timeout);
    await expect(configureCaptionLanguage(() => ({ code: "es" }), configure, "en")).rejects.toBe(timeout);
    const denied = { type: "INVALID_OPERATION", errorCode: 7304 };
    configure.mockImplementationOnce(async () => { code = "en"; throw denied; });
    code = "es";
    await expect(configureCaptionLanguage(() => ({ code }), configure, "en")).rejects.toBe(denied);
  });
  it("shows English originals from local and known remote English speakers, but never Portuguese originals", async () => {
    localStorage.setItem("brevents-spoken-language", "en-US");
    localStorage.setItem("brevents-caption-language", "en-US");
    const zoom = mockClient();
    const { result } = renderHook(() => useZoomCaptions({ client: zoom.client, sessionId: 1, saveTranscript: vi.fn() }));
    await waitFor(() => expect(zoom.ltt.setTranslationLanguage).toHaveBeenLastCalledWith("en"));
    zoom.emit({ ...message, text: "Hello", done: false });
    expect(result.current.overlay?.text).toBe("Hello");
    zoom.emitEvent("command-channel-message", { senderId: "7", text: JSON.stringify({ type: "caption.language", language: "en-US" }) });
    zoom.emit({ ...message, userId: 7, text: "Remote English", done: false });
    expect(result.current.overlay?.text).toBe("Remote English");
    zoom.emitEvent("command-channel-message", { senderId: "7", text: JSON.stringify({ type: "caption.language", language: "pt-BR" }) });
    zoom.emit({ ...message, userId: 7, text: "Bom dia", done: false });
    expect(result.current.overlay?.text).toBe("Remote English");
    zoom.emit({ ...message, userId: 7, language: 0, text: "Good morning", done: false });
    expect(result.current.overlay?.text).toBe("Good morning");
    act(() => result.current.selectSpokenLanguage("es-ES"));
    await waitFor(() => expect(zoom.ltt.setSpeakingLanguage).toHaveBeenLastCalledWith("es"));
    expect(zoom.ltt.setTranslationLanguage).toHaveBeenCalledTimes(1);
  });
  it("clears only a transient timeout once the requested language is confirmed and a matching caption arrives", async () => {
    const zoom = mockClient();
    const { result } = renderHook(() => useZoomCaptions({ client: zoom.client, sessionId: 1, saveTranscript: vi.fn() }));
    await waitFor(() => expect(zoom.ltt.setSpeakingLanguage).toHaveBeenCalled());
    zoom.ltt.setTranslationLanguage.mockRejectedValueOnce({ type: "OPERATION_TIMEOUT", errorCode: 1 });
    act(() => result.current.selectCaptionLanguage("en-US"));
    await waitFor(() => expect(result.current.error).toContain("confirmar"));
    zoom.emit({ ...message, language: 0, text: "Old caption", done: false });
    expect(result.current.error).toContain("confirmar");
    zoom.ltt.getCurrentTranslationLanguage.mockReturnValue({ code: "en" });
    zoom.emit({ ...message, language: 0, text: "Confirmed caption", done: false });
    expect(result.current.error).toBe("");
  });
  it("restores English original captions after retry without resending an already-active translation setting", async () => {
    localStorage.setItem("brevents-spoken-language", "en-US");
    localStorage.setItem("brevents-caption-language", "en-US");
    const zoom = mockClient();
    const { result } = renderHook(() => useZoomCaptions({ client: zoom.client, sessionId: 1, saveTranscript: vi.fn() }));
    await waitFor(() => expect(zoom.ltt.setTranslationLanguage).toHaveBeenCalledTimes(1));
    act(() => result.current.retry());
    await waitFor(() => expect(zoom.ltt.startLiveTranscription).toHaveBeenCalledTimes(2));
    await act(async () => { await Promise.resolve(); });
    zoom.emit({ ...message, text: "Still working", done: false });
    expect(result.current.overlay?.text).toBe("Still working");
    expect(zoom.ltt.setTranslationLanguage).toHaveBeenCalledTimes(1);
  });
  it("accepts the real active caption-status response without swallowing SDK failures", () => {
    expect(() => assertCaptionSuccess({ autoCaption: true, lang: 6, language: "pt" })).not.toThrow();
    const failure = { type: "INVALID_OPERATION", errorCode: 7305, reason: "unsupported" };
    expect(() => assertCaptionSuccess(failure)).toThrow();
    expect(() => assertCaptionSuccess({})).toThrow("resultado inesperado");
  });
  it("starts immediately with saved Portuguese reading and uses separate speech and translation codes", async () => {
    localStorage.setItem("brevents-spoken-language", "pt-BR");
    localStorage.setItem("brevents-caption-language", "pt-BR");
    const zoom = mockClient();
    const { result } = renderHook(() => useZoomCaptions({ client: zoom.client, sessionId: 1, saveTranscript: vi.fn() }));
    await waitFor(() => expect(zoom.ltt.setTranslationLanguage).toHaveBeenLastCalledWith("pt-br"));
    expect(zoom.ltt.setSpeakingLanguage).toHaveBeenLastCalledWith("pt");
    expect(result.current.error).toBe("");
    expect(result.current.translationLanguages).toContain("pt-BR");
    zoom.emit({ ...message, language: 40, done: false });
    expect(result.current.overlay?.text).toBe("Bom dia");
    act(() => result.current.selectSpokenLanguage("en-US"));
    await waitFor(() => expect(zoom.ltt.setSpeakingLanguage).toHaveBeenLastCalledWith("en"));
    expect(zoom.ltt.setTranslationLanguage).toHaveBeenLastCalledWith("pt-br");
    zoom.emit({ ...message, msgId: "translated-pt", language: 40, text: "Olá novamente" });
    expect(result.current.overlay?.text).toBe("Olá novamente");
  });
  it("normalizes Zoom seconds and milliseconds without Invalid Date", () => {
    expect(captionTimestamp(1791737780)).toBe(captionTimestamp(1791737780000));
  });
  it("merges persisted and live history without losing or duplicating a sentence on reconnect", () => {
    const entry = { id: "stored-uuid", zoom_session: 1, message_id: "phrase-1", speaker_identity: "u:42", speaker_name: "Organizador", source_language: "pt-BR" as const, original_text: "Bom dia", translations: {}, created_at: captionTimestamp(message.timestamp) };
    expect(mergeTranscriptHistory([entry], [{ ...entry, id: "zoom:1:phrase-1" }])).toHaveLength(1);
    expect(mergeTranscriptHistory([entry], [{ ...entry, zoom_session: 2 }])).toHaveLength(2);
  });
  it("stores only finalized originals once and never stores translated or remote speech", async () => {
    const zoom = mockClient(); const saveTranscript = vi.fn().mockResolvedValue(undefined); const onCaption = vi.fn();
    renderHook(() => useZoomCaptions({ client: zoom.client, sessionId: 1, saveTranscript, onCaption }));
    await waitFor(() => expect(zoom.ltt.setSpeakingLanguage).toHaveBeenCalled());
    zoom.emit({ ...message, done: false });
    zoom.emit({ ...message, language: 0 });
    expect(saveTranscript).not.toHaveBeenCalled();
    zoom.emit(message); zoom.emit(message);
    zoom.emit({ ...message, msgId: "remote-1", userId: 7 });
    await waitFor(() => expect(saveTranscript).toHaveBeenCalledTimes(1));
    expect(onCaption).toHaveBeenCalledTimes(2);
    expect(saveTranscript).toHaveBeenCalledWith("Bom dia", expect.any(String), "phrase-1");
  });
  it("shows translated interim messages immediately and hides them without disabling the session", async () => {
    const zoom = mockClient();
    const { result, unmount } = renderHook(() => useZoomCaptions({ client: zoom.client, sessionId: 1, saveTranscript: vi.fn() }));
    await waitFor(() => expect(result.current.ready).toBe(true));
    act(() => result.current.selectCaptionLanguage("en-US"));
    zoom.emit({ ...message, done: false, language: 0, text: "Good morning" });
    expect(result.current.overlay?.text).toBe("Good morning");
    act(() => result.current.selectCaptionLanguage(null));
    expect(result.current.overlay).toBeNull();
    unmount();
    expect(zoom.ltt.disableCaptions).not.toHaveBeenCalled();
    expect(zoom.client?.off).toHaveBeenCalled();
  });
  it("surfaces missing account entitlement without switching back to browser recognition", async () => {
    const zoom = mockClient(); zoom.ltt.startLiveTranscription.mockRejectedValue({ errorCode: 7300 });
    const { result } = renderHook(() => useZoomCaptions({ client: zoom.client, sessionId: 1, saveTranscript: vi.fn() }));
    await waitFor(() => expect(result.current.error).toContain("conta Zoom"));
    expect(result.current.ready).toBe(false);
    expect(zoom.ltt.setTranslationLanguage).not.toHaveBeenCalled();
  });
  it("removes listeners on exit and does not reinitialize when transcript callbacks change", async () => {
    const zoom = mockClient();
    const { result, rerender } = renderHook<ReturnType<typeof useZoomCaptions>, { callback: ReturnType<typeof vi.fn> }>(({ callback }) => useZoomCaptions({ client: zoom.client, sessionId: 1, saveTranscript: vi.fn(), onCaption: callback }), { initialProps: { callback: vi.fn() } });
    await waitFor(() => expect(result.current.ready).toBe(true));
    rerender({ callback: vi.fn() });
    expect(zoom.ltt.startLiveTranscription).toHaveBeenCalledTimes(1);
    zoom.emitEvent("caption-host-disable", true);
    expect(result.current.ready).toBe(false);
    expect(result.current.error).toContain("organizador");
    zoom.emitEvent("caption-host-disable", false);
    await waitFor(() => expect(result.current.ready).toBe(true));
  });
  it("keeps live captions working when persistence fails", async () => {
    const zoom = mockClient(); const saveTranscript = vi.fn().mockRejectedValue(new Error("API offline"));
    const { result } = renderHook(() => useZoomCaptions({ client: zoom.client, sessionId: 1, saveTranscript }));
    await waitFor(() => expect(result.current.ready).toBe(true));
    act(() => result.current.selectCaptionLanguage("en-US"));
    zoom.emit(message);
    zoom.emit({ ...message, language: 0, text: "Good morning" });
    await waitFor(() => expect(result.current.error).toContain("histórico"));
    expect(result.current.overlay?.text).toBe("Good morning");
  });
  it("offers supported read languages to a Web Event viewer without speaking controls", () => {
    const select = vi.fn();
    render(<LiveCaptionControls canSpeak={false} microphoneOn={false} captionLanguage={null} spokenLanguage="pt-BR" onCaptionLanguageChange={select} onSpokenLanguageChange={vi.fn()} availableLanguages={["pt-BR", "en-US"]} translationLanguages={["en-US"]} ready error="" onRetry={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Legendas" }));
    expect(screen.queryByLabelText("Idioma da minha fala")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Español" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "English" }));
    expect(select).toHaveBeenCalledWith("en-US");
    fireEvent.click(screen.getByRole("button", { name: "Ocultar legendas" }));
    expect(select).toHaveBeenCalledWith(null);
  });
});
