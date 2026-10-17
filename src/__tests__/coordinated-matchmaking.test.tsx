import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MatchmakingBoard } from "@/components/matchmaking-board";
import { MatchmakingLobby } from "@/components/matchmaking-lobby";
import { NetworkingSala } from "@/components/networking-sala";
import { roundClock } from "@/components/use-matchmaking";
import type { EventData, MatchmakingState, Room } from "@/lib/api-types";

const mocks = vi.hoisted(() => ({ api: vi.fn(), replace: vi.fn(), snapshot: null as unknown, now: 0, refresh: vi.fn() }));
vi.mock("@/lib/api-client", () => ({ apiClient: mocks.api }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mocks.replace }) }));
vi.mock("@/components/session-provider", () => ({ useSession: () => ({ user: { id: 1 } }) }));
vi.mock("@/components/home-header", () => ({ HomeHeader: () => <header>BR Events</header> }));
vi.mock("@/components/connected-meeting-experience", () => ({ ConnectedMeetingExperience: ({ roomOverride }: { roomOverride: Room }) => <div data-testid="call">{roomOverride.company_name}</div> }));
vi.mock("@/components/use-matchmaking", async (importOriginal) => ({ ...await importOriginal<object>(), useMatchmaking: () => ({ data: mocks.snapshot, error: "", now: mocks.now, refresh: mocks.refresh }) }));

const event: EventData = { id: "event", name: "Encontro", slug: "encontro", description: "", starts_at: "2026-10-16T12:00:00Z", ends_at: "2026-10-16T18:00:00Z", timezone: "America/Sao_Paulo", access_mode: "registration", registration_open: true, public_config: {}, branding: {}, feature_flags: { networking_open: true } };
const room: Room = { id: "room", name: "Acme", company_name: "Acme", description: "", mode: "meeting", coordinated: true, capacity: 2, position: 0, zoom_session: { id: 1, configured: true, is_live: false, session_name: "round-1" } };
const importer = { id: "buyer", name: "Ana Compradora", company: "Buyer Co", matchmaking_role: "importer" as const };
const exporter = { id: "seller", name: "Bia Exportadora", company: "Acme", matchmaking_role: "exporter" as const };
const round = { id: "round", room: room.id, exporter, importer, starts_at: event.starts_at, expires_at: "2026-10-16T12:10:00Z", ended_at: null, end_reason: "" };
const state: MatchmakingState = { server_time: event.starts_at, open: true, role: "coordinator", registration: null, room: null, round: null, waiting: [importer], rooms: [{ room, exporter, online: true, round: null }] };

describe("matchmaking coordenado", () => {
  beforeEach(() => { mocks.snapshot = structuredClone(state); mocks.now = Date.parse(event.starts_at); mocks.api.mockResolvedValue(room); mocks.api.mockClear(); mocks.replace.mockClear(); });
  afterEach(cleanup);

  it("exige selecionar um importador para direcioná-lo à empresa", async () => {
    render(<MatchmakingBoard event={event} />);
    const assign = screen.getByRole("button", { name: "Direcionar participante" });
    expect(assign).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /Ana Compradora/ }));
    expect(assign).toBeEnabled();
    fireEvent.click(assign);
    await waitFor(() => expect(mocks.api).toHaveBeenCalledWith("matchmaking/assign/", { method: "POST", body: { event: event.id, importer: importer.id, room: room.id } }));
  });

  it("confirma o encerramento em modal antes de devolver à espera", async () => {
    mocks.snapshot = { ...state, rooms: [{ room, exporter, online: true, round }] };
    render(<MatchmakingBoard event={event} />);
    expect(screen.getByLabelText("Tempo restante")).toHaveTextContent("10:00");
    fireEvent.click(screen.getByRole("button", { name: "Encerrar e devolver à espera" }));
    expect(screen.getByRole("dialog", { name: "Encerrar esta reunião?" })).toBeInTheDocument();
    expect(mocks.api).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Encerrar reunião" }));
    await waitFor(() => expect(mocks.api).toHaveBeenCalledWith("matchmaking/end/", { method: "POST", body: { event: event.id, round: round.id } }));
  });

  it("mantém o importador esperando e abre automaticamente a sala atribuída", () => {
    mocks.snapshot = { ...state, role: "importer", registration: importer, waiting: undefined, rooms: undefined };
    const view = render(<MatchmakingLobby event={event} />);
    expect(screen.getByText("ÁREA DE ESPERA")).toBeInTheDocument();
    expect(mocks.replace).not.toHaveBeenCalled();
    mocks.snapshot = { ...(mocks.snapshot as MatchmakingState), round, room };
    view.rerender(<MatchmakingLobby event={event} />);
    expect(mocks.replace).toHaveBeenCalledWith("/eventos/encontro/networking/salas/room");
  });

  it("abre diretamente a sala do exportador", () => {
    mocks.snapshot = { ...state, role: "exporter", registration: exporter, room };
    render(<MatchmakingLobby event={event} />);
    expect(mocks.replace).toHaveBeenCalledWith("/eventos/encontro/networking/salas/room");
  });

  it("identifica a empresa do exportador na própria sala", async () => {
    mocks.snapshot = { ...state, role: "exporter", registration: exporter, room };
    render(<NetworkingSala event={event} roomId="room" />);
    expect(await screen.findByText("Esta é a sua sala · Acme")).toBeInTheDocument();
    expect(screen.getByTestId("call")).toBeInTheDocument();
  });

  it("remove a chamada e devolve o importador à espera ao atingir dez minutos", () => {
    mocks.snapshot = { ...state, role: "importer", registration: importer, round, room };
    const view = render(<NetworkingSala event={event} roomId="room" />);
    expect(screen.getByTestId("call")).toBeInTheDocument();
    mocks.now = Date.parse(round.expires_at);
    view.rerender(<NetworkingSala event={event} roomId="room" />);
    expect(screen.queryByTestId("call")).not.toBeInTheDocument();
    expect(mocks.replace).toHaveBeenCalledWith("/eventos/encontro/networking");
    expect(roundClock(round.expires_at, mocks.now + 5000)).toBe("00:00");
  });
});
