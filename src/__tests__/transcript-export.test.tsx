import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EventData, LiveCaption } from "@/lib/api-types";
import { loadCompleteTranscript, transcriptText } from "@/lib/transcript-export";
import { ConnectedLiveExperience } from "@/components/connected-live-experience";
import { ConnectedMeetingExperience } from "@/components/connected-meeting-experience";

const mocks = vi.hoisted(() => ({ api: vi.fn(), guest: false, user: { id: 1, username: "organizador", name: "Organizador", first_name: "Org", last_name: "", email: "org@example.com", is_staff: false, is_superuser: false, account_type: "organizer" }, router: { push: vi.fn(), replace: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => mocks.router }));
vi.mock("@/components/session-provider", () => ({ useSession: () => ({ user: mocks.guest ? null : mocks.user }) }));
vi.mock("@/lib/api-client", async () => ({ ...await vi.importActual<typeof import("@/lib/api-client")>("@/lib/api-client"), apiClient: mocks.api }));
vi.mock("@/components/zoom-video-room", () => ({ ZoomVideoRoom: ({ onCaption, onJoinedChange }: { onCaption: (caption: LiveCaption) => void; onJoinedChange: (joined: boolean) => void }) => <div><button onClick={() => onJoinedChange(true)}>Entrar teste</button><button onClick={() => onCaption(caption)}>Falar teste</button><button onClick={() => onJoinedChange(false)}>Encerrar teste</button></div> }));

const caption: LiveCaption = { id: "phrase-1", message_id: "msg-1", zoom_session: 1, speaker_identity: "u:1", speaker_name: "Matheus", source_language: "pt-BR", original_text: "Olá, reunião e negócios!", translations: { "en-US": "Hello" }, created_at: "2026-10-12T15:00:00Z" };
const event = { id: "event-1", name: "Evento teste", slug: "evento-teste", description: "", timezone: "America/Sao_Paulo", starts_at: "2026-10-12T15:00:00Z", ends_at: "2026-10-12T18:00:00Z", status: "published", access_mode: "public", registration_open: true, rooms: [{ id: "room-1", event: "event-1", name: "Auditório", mode: "meeting", purpose: "main", position: 0, description: "", capacity: null, zoom_session: { id: 1, configured: true, session_name: "test", room: "room-1" } }] } as EventData;

class TestSocket {
  static OPEN = 1;
  readyState = 1;
  send = vi.fn();
  close = vi.fn();
}

describe("transcrição e download", () => {
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
  beforeEach(() => {
    mocks.guest = false;
    mocks.api.mockReset();
    mocks.api.mockImplementation(async (path: string) => {
      if (path.includes("captions/")) return [];
      if (path.startsWith("rooms/")) return { results: event.rooms };
      if (path.includes("join-token")) return { token: "local-test" };
      return { results: [], count: 0, next: null };
    });
    vi.stubGlobal("WebSocket", TestSocket);
    Object.defineProperty(HTMLElement.prototype, "scrollTo", { configurable: true, value: vi.fn() });
    URL.createObjectURL = vi.fn(() => "blob:test-transcript");
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
  });

  it("fetches all pages instead of truncating exports at 500 phrases", async () => {
    const records = Array.from({ length: 501 }, (_, index) => ({ ...caption, id: `id-${index}`, message_id: `msg-${index}`, created_at: new Date(Date.parse(caption.created_at) + index * 1000).toISOString() }));
    const page = vi.fn().mockResolvedValueOnce(records.slice(1)).mockResolvedValueOnce(records.slice(0, 1));
    const complete = await loadCompleteTranscript(page);
    expect(complete).toHaveLength(501);
    expect(page).toHaveBeenLastCalledWith({ before_at: records[1].created_at, before_id: "id-1" });
  });
  it("rejects a repeated history page rather than downloading a silently incomplete file", async () => {
    const page = vi.fn().mockResolvedValue(Array.from({ length: 500 }, (_, index) => ({ ...caption, id: `id-${index}` })));
    await expect(loadCompleteTranscript(page)).rejects.toThrow("todas as páginas");
  });
  it("exports original text, author, event timezone and Unicode without duplicates", () => {
    const text = transcriptText([caption, { ...caption, id: "zoom:1:msg-1" }], event.name, "Auditório", event.timezone);
    expect(text.startsWith("\uFEFF")).toBe(true);
    expect(text).toContain("12:00:00");
    expect(text).toContain("Matheus");
    expect(text).toContain("Olá, reunião e negócios!");
    expect(text).not.toContain("Hello");
    expect(text.match(/Olá, reunião/g)).toHaveLength(1);
  });
  it("adds Web Event transcription without removing Chat, Questions or Polls", async () => {
    render(<ConnectedLiveExperience event={event} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Entrar teste" })).toBeInTheDocument());
    for (const name of ["Chat", "Perguntas", "Enquete", "Transcrição"]) expect(screen.getByRole("tab", { name })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Entrar teste" }));
    fireEvent.click(screen.getByRole("button", { name: "Falar teste" }));
    fireEvent.click(screen.getByRole("tab", { name: "Transcrição" }));
    expect(await screen.findByText(caption.original_text)).toBeInTheDocument();
    expect(screen.getByText("Matheus")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Encerrar teste" }));
    expect(screen.getByText(caption.original_text)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Baixar transcrição" }));
    await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalled());
  });
  it("keeps Meeting transcript and download available after leaving or ending the room", async () => {
    render(<ConnectedMeetingExperience event={event} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Entrar teste" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Entrar teste" }));
    fireEvent.click(screen.getByRole("button", { name: "Falar teste" }));
    await act(async () => { await Promise.resolve(); });
    fireEvent.click(screen.getByRole("button", { name: "Encerrar teste" }));
    expect(screen.getByRole("tab", { name: "Transcrição" })).toHaveAttribute("aria-selected", "true");
    expect(await screen.findByText(caption.original_text)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Baixar transcrição" }));
    await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalled());
  });
  it("lets a registered guest read transcription without unlocking chat moderation or exposing the ticket", async () => {
    mocks.guest = true;
    const fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => [caption] });
    vi.stubGlobal("fetch", fetch);
    render(<ConnectedLiveExperience event={event} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Entrar teste" })).toBeInTheDocument());
    expect(screen.queryByRole("tab", { name: "Perguntas" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Enquete" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Entrar teste" }));
    fireEvent.click(screen.getByRole("tab", { name: "Transcrição" }));
    expect(await screen.findByText(caption.original_text)).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("eventId=event-1"), { cache: "no-store" });
    expect(String(fetch.mock.calls[0][0])).not.toContain("ticket");
    fireEvent.click(screen.getByRole("tab", { name: "Chat" }));
    expect(screen.getByText("Quer participar da conversa?")).toBeInTheDocument();
  });
});
