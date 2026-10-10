import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CreateEventForm } from "@/components/create-event-form";
import { eventCreatePayload, validateEventStep, type EventDraft } from "@/lib/event-builder";

const mocks = vi.hoisted(() => ({ api: vi.fn(), router: { push: vi.fn(), refresh: vi.fn() } }));
vi.mock("@/lib/api-client", () => ({ apiClient: mocks.api }));
vi.mock("next/navigation", () => ({ useRouter: () => mocks.router }));
const draft: EventDraft = { name: "Evento novo", subtitle: "Ideias e conexões", description: "Um encontro online.", starts_at: "2026-10-15T10:00", ends_at: "2026-10-15T12:00", organization: "", slug: "", access_mode: "registration" };

function arrange(failPublication = false) {
  let failed = false;
  mocks.api.mockImplementation(async (path: string, options?: { method?: string; body?: unknown }) => {
    if (path === "organizations/" || path.startsWith("rooms/?")) return { results: [], next: null };
    if (path === "events/" && options?.method === "POST") return { ...draft, id: "created-event" };
    if (path === "rooms/" && options?.method === "POST") return { id: "created-room" };
    if (path.endsWith("/publish/") && failPublication && !failed) { failed = true; throw new Error("Publicação indisponível."); }
    return {};
  });
  render(<CreateEventForm />);
}
function fillPresentation() {
  fireEvent.change(screen.getByLabelText(/Nome do evento/), { target: { value: draft.name } });
  fireEvent.change(screen.getByLabelText(/Frase principal/), { target: { value: draft.subtitle } });
  fireEvent.change(screen.getByLabelText(/Descrição/), { target: { value: draft.description } });
  fireEvent.submit(screen.getByRole("form", { name: "Criar evento" }));
}
function fillDates() {
  fireEvent.change(screen.getByLabelText(/Início/), { target: { value: draft.starts_at } });
  fireEvent.change(screen.getByLabelText(/Término/), { target: { value: draft.ends_at } });
  fireEvent.submit(screen.getByRole("form", { name: "Criar evento" }));
}
function skipSpeakers() { fireEvent.click(screen.getByRole("button", { name: "Continuar sem palestrantes" })); }

describe("cadastro de evento por etapas", () => {
  beforeEach(() => { mocks.api.mockReset(); mocks.router.push.mockReset(); });
  afterEach(cleanup);

  it("valida os campos essenciais e rejeita término anterior ao início", () => {
    expect(validateEventStep(0, { ...draft, name: " " })).toMatch(/Preencha/);
    expect(validateEventStep(1, { ...draft, ends_at: "2026-10-15T09:00" })).toMatch(/posterior/);
    expect(validateEventStep(1, draft)).toBeNull();
    const payload = eventCreatePayload(draft, [{ id: "local-id", name: " Ana ", email: "", bio: " Bio " }]);
    expect(payload.initial_speakers).toEqual([{ name: "Ana", email: "", bio: "Bio" }]);
    expect(payload.feature_flags.networking_open).toBe(false);
  });

  it("não avança com campos vazios e preserva valores ao voltar", () => {
    arrange();
    fireEvent.submit(screen.getByRole("form", { name: "Criar evento" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Preencha");
    fillPresentation();
    expect(screen.getByText("Etapa 2 de 4")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(screen.getByLabelText(/Nome do evento/)).toHaveValue(draft.name);
    expect(screen.getByLabelText(/Descrição/)).toHaveValue(draft.description);
  });

  it("só cria o evento ao confirmar a revisão e prepara a sala antes de publicar", async () => {
    arrange(); fillPresentation(); fillDates(); skipSpeakers();
    expect(mocks.api.mock.calls.some(([path, options]) => path === "events/" && options?.method === "POST")).toBe(false);
    expect(screen.getByText(draft.name)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Criar e publicar evento" }));
    await waitFor(() => expect(mocks.router.push).toHaveBeenCalledWith("/painel?event=created-event"));
    const writes = mocks.api.mock.calls.filter(([, options]) => options?.method === "POST").map(([path]) => path);
    expect(writes).toEqual(["events/", "rooms/", "events/created-event/publish/"]);
  });

  it("adiciona, edita e remove palestrantes sem perder as outras etapas", async () => {
    arrange(); fillPresentation(); fillDates();
    fireEvent.click(screen.getByRole("button", { name: "Adicionar palestrante" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/Nome do palestrante/), { target: { value: "Ana" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar palestrante" }));
    expect(screen.getByText("Ana")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Editar Ana" }));
    fireEvent.change(within(screen.getByRole("dialog")).getByLabelText(/Nome do palestrante/), { target: { value: "Ana Lima" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar palestrante" }));
    expect(screen.getByText("Ana Lima")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remover Ana Lima" }));
    skipSpeakers();
    fireEvent.click(screen.getByRole("button", { name: "Editar apresentação" }));
    expect(screen.getByLabelText(/Frase principal/)).toHaveValue(draft.subtitle);
  });

  it("retoma publicação com falha sem duplicar evento ou auditório", async () => {
    arrange(true); fillPresentation(); fillDates(); skipSpeakers();
    fireEvent.click(screen.getByRole("button", { name: "Criar e publicar evento" }));
    await screen.findByText("Publicação indisponível.");
    fireEvent.click(screen.getByRole("button", { name: "Tentar concluir publicação" }));
    await waitFor(() => expect(mocks.router.push).toHaveBeenCalledWith("/painel?event=created-event"));
    expect(mocks.api.mock.calls.filter(([path, options]) => path === "events/" && options?.method === "POST")).toHaveLength(1);
    expect(mocks.api.mock.calls.filter(([path, options]) => path === "rooms/" && options?.method === "POST")).toHaveLength(1);
    expect(mocks.api.mock.calls.filter(([path]) => path === "events/created-event/publish/")).toHaveLength(2);
  });
});
