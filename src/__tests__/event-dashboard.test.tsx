import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ParticipantsPanel, SettingsPanel } from "@/components/event-dashboard/management-panels";
import { AgendaPanel } from "@/components/event-dashboard/agenda-panel";
import { InteractionsPanel } from "@/components/event-dashboard/interactions-panel";
import { listAll, mainRoom } from "@/components/event-dashboard/shared";
import type { EventData, Poll, Registration, Room } from "@/lib/api-types";
import { ApiError } from "@/lib/api-client";

const api = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api-client", async () => ({ ...await vi.importActual<typeof import("@/lib/api-client")>("@/lib/api-client"), apiClient: api }));
const event: EventData = { id: "event-1", name: "Evento", slug: "evento", description: "Inovação", starts_at: "2026-10-10T15:00:00Z", ends_at: "2026-10-10T18:00:00Z", timezone: "America/Sao_Paulo", status: "published", registration_open: true, access_mode: "registration", public_config: {}, branding: {}, feature_flags: {} };
const room: Room = { id: "main", event: event.id, name: "Auditório", purpose: "main", mode: "event", description: "", capacity: null, position: 0 };
const action = async (operation: () => Promise<unknown>, message: string, onError?: (reason: unknown) => void) => {
  try { await operation(); return true; } catch (reason) { onError?.(reason); return false; }
};
const page = (results: unknown[]) => ({ results, count: results.length, next: null, previous: null });

describe("painel do evento", () => {
  afterEach(cleanup);
  beforeEach(() => { api.mockReset(); });

  it("busca também as páginas restantes da API", async () => {
    api.mockResolvedValueOnce({ ...page(["a"]), next: "https://api.example/api/registrations/?event=event-1&page=2" }).mockResolvedValueOnce(page(["b"]));
    expect(await listAll("registrations/?event=event-1")).toEqual(["a", "b"]);
    expect(api).toHaveBeenLastCalledWith("registrations/?event=event-1&page=2");
  });

  it("seleciona o auditório público e exclui salas privadas 1:1", () => {
    expect(mainRoom([{ ...room, id: "network", purpose: "networking" }, { ...room, id: "second", position: 2 }, room])?.id).toBe("main");
  });

  it("ignora salas de outro evento mesmo quando elas chegam na lista do painel", () => {
    expect(mainRoom([{ ...room, id: "foreign", event: "other" }, room], event.id)?.id).toBe(room.id);
    expect(mainRoom([{ ...room, event: "other" }], event.id)).toBeUndefined();
  });

  it("envia a programação ao auditório atual sem exigir categoria", async () => {
    api.mockResolvedValue({});
    render(<AgendaPanel event={event} rooms={[{ ...room, id: "foreign", event: "other" }, room]} speakers={[]} sessions={[]} action={action} busy={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Adicionar à programação" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Título *"), { target: { value: "Abertura do evento" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(api).toHaveBeenCalledWith("sessions/", expect.objectContaining({ body: expect.objectContaining({ event: event.id, room: room.id, track: "" }) })));
  });

  it("mostra o campo inválido dentro do próprio modal de programação", async () => {
    api.mockRejectedValue(new ApiError(400, { ends_at: ["O término deve ser posterior ao início."] }));
    render(<AgendaPanel event={event} rooms={[room]} speakers={[]} sessions={[]} action={action} busy={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Adicionar à programação" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Título *"), { target: { value: "Abertura do evento" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Término: O término deve ser posterior ao início.");
    expect(within(dialog).getByLabelText("Título *")).toHaveValue("Abertura do evento");
  });

  it("limita inscritos a dez por página, busca empresa/cargo e mostra cadastro de conta", () => {
    const registrations: Registration[] = Array.from({ length: 11 }, (_, index) => ({ id: String(index), event: event.id, name: `Pessoa ${index}`, email: `pessoa${index}@example.com`, status: "confirmed", user: index ? index : null, ticket_code: "", profile: { company: index === 10 ? "Aurora" : "Acme", role: "Diretoria" }, created_at: event.starts_at }));
    render(<ParticipantsPanel event={event} items={registrations} action={action} busy={false} />);
    expect(screen.getAllByRole("row")).toHaveLength(11);
    expect(screen.queryByText("Pessoa 10")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Próxima página" }));
    expect(screen.getByText("Pessoa 10")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Aurora" } });
    expect(screen.getAllByRole("row")).toHaveLength(2);
    expect(screen.getByText("Diretoria")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Página anterior" })).toBeDisabled();
  });

  it("edita um palestrante existente por modal", async () => {
    api.mockResolvedValue({});
    render(<AgendaPanel event={event} rooms={[room]} sessions={[]} speakers={[{ id: "speaker", event: event.id, name: "Ana", email: "ana@example.com", bio: "Bio", avatar_url: "" }]} action={action} busy={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Palestrantes (1)" }));
    fireEvent.click(screen.getByRole("button", { name: "Editar Ana" }));
    const dialog = screen.getByRole("dialog", { name: "Editar palestrante" });
    fireEvent.change(within(dialog).getByLabelText("Nome *"), { target: { value: "Ana Lima" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(api).toHaveBeenCalledWith("speakers/speaker/", expect.objectContaining({ method: "PATCH", body: expect.objectContaining({ name: "Ana Lima" }) })));
  });

  it("confirma o encerramento antes de chamar a API", async () => {
    api.mockResolvedValue({});
    render(<SettingsPanel event={event} action={action} busy={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Encerrar evento" }));
    expect(api).not.toHaveBeenCalled();
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(api).toHaveBeenCalledWith("events/event-1/end/", { method: "POST" }));
  });

  it("mostra resultados das enquetes e preserva opções após votos", async () => {
    const poll: Poll = { id: "poll", room: room.id, question: "Qual tema?", state: "open", total_votes: 4, options: [{ id: "a", text: "Produto", position: 0, votes: 3 }, { id: "b", text: "Tecnologia", position: 1, votes: 1 }] };
    api.mockImplementation(async (path: string) => page(path.startsWith("polls") ? [poll] : []));
    render(<InteractionsPanel event={event} rooms={[room]} />);
    expect(await screen.findByText("3 · 75%")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Editar enquete Qual tema?" }));
    expect(within(screen.getByRole("dialog")).getByLabelText("Opção 1")).toBeDisabled();
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(api).toHaveBeenCalledWith("polls/poll/", expect.objectContaining({ method: "PATCH", body: { room: room.id, question: "Qual tema?", show_results_before_close: true } })));
  });
});
