import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StrictMode } from "react";
import { NetworkingLobby } from "@/components/networking-lobby";
import { SessionProvider } from "@/components/session-provider";
import { networkingPageLayout } from "@/lib/networking-layout";
import type { EventData, NetworkingPresence, NetworkingRequest, Registration, User } from "@/lib/api-types";

const mocks = vi.hoisted(() => ({ api: vi.fn(), router: { replace: vi.fn(), push: vi.fn(), refresh: vi.fn() } }));
vi.mock("@/lib/api-client", () => ({ apiClient: mocks.api }));
vi.mock("next/navigation", () => ({ useRouter: () => mocks.router, usePathname: () => "/eventos/encontro/networking" }));
const event: EventData = { id: "event", name: "Encontro", slug: "encontro", description: "", starts_at: "2026-10-10T15:00:00Z", ends_at: "2026-10-10T18:00:00Z", timezone: "America/Sao_Paulo", status: "published", registration_open: true, access_mode: "registration", public_config: {}, branding: {}, feature_flags: { networking_open: true } };
const user: User = { id: 7, name: "Ana", username: "ana", first_name: "Ana", last_name: "", email: "ana@example.com", is_staff: false, is_superuser: false, account_type: "attendee" };
const own: Registration = { id: "own", user: user.id, name: user.name, email: user.email, event: event.id, status: "confirmed", ticket_code: "", profile: {}, created_at: event.starts_at };
const people: NetworkingPresence[] = Array.from({ length: 12 }, (_, index) => ({ id: `presence-${index}`, event: event.id, registration: `reg-${index}`, last_seen_at: event.starts_at, registration_detail: { ...own, id: `reg-${index}`, user: index + 20, name: `Pessoa ${String(index + 1).padStart(2, "0")}`, email: `pessoa${index + 1}@example.com`, profile: { company: index === 11 ? "Aurora" : "Acme", role: "Diretoria" } } }));
function invitation(id: string, personIndex: number): NetworkingRequest {
  return { id, event: event.id, sender_registration: people[personIndex].registration, sender_detail: people[personIndex].registration_detail, recipient_registration: own.id, recipient_detail: own, topic: "Parceria", status: "pending", room: null, room_detail: null, responded_at: null, last_participant_seen_at: null, ended_at: null, created_at: event.starts_at, updated_at: event.starts_at };
}
function arrange(initial: NetworkingRequest[] = [], open = true) {
  let requests = [...initial];
  mocks.api.mockImplementation(async (path: string, options?: { method?: string; body?: Record<string, string> }) => {
    if (path.startsWith("public/")) return { ...event, feature_flags: { networking_open: open } };
    if (path === "networking-presences/heartbeat/") return { registration: own.id };
    if (path.startsWith("networking-presences/online/")) return people;
    if (path.startsWith("networking-requests/?")) { const state = new URLSearchParams(path.split("?")[1]).get("status"); return { results: requests.filter((item) => item.status === state), next: null }; }
    if (path === "networking-requests/" && options?.method === "POST") {
      const person = people.find((item) => item.registration === options.body?.recipient_registration)!;
      const created: NetworkingRequest = { ...invitation("sent", 0), sender_registration: own.id, sender_detail: own, recipient_registration: person.registration, recipient_detail: person.registration_detail, topic: options.body?.topic ?? "" };
      requests.push(created); return created;
    }
    const match = path.match(/^networking-requests\/(.+)\/(accept|decline|cancel|end)\/$/);
    if (match) {
      const item = requests.find((request) => request.id === match[1])!;
      item.status = match[2] === "accept" ? "accepted" : match[2] === "end" ? "ended" : match[2] === "decline" ? "declined" : "cancelled";
      if (match[2] === "accept") requests = requests.map((request) => request.id !== item.id && request.status === "pending" ? { ...request, status: "cancelled" } : request);
      return { ...item };
    }
    return {};
  });
  render(<StrictMode><SessionProvider initialUser={user}><NetworkingLobby event={{ ...event, feature_flags: { networking_open: open } }} /></SessionProvider></StrictMode>);
}

describe("networking", () => {
  beforeEach(() => { mocks.api.mockReset(); });
  afterEach(cleanup);

  it("ajusta a paginação à largura e à altura disponíveis", () => {
    expect(networkingPageLayout(1100, 380).pageSize).toBe(6);
    expect(networkingPageLayout(340, 300).pageSize).toBe(2);
    expect(networkingPageLayout(340, 140).pageSize).toBe(1);
    expect(networkingPageLayout(340, 140).compact).toBe(true);
  });

  it("pagina pessoas e busca por empresa e cargo", async () => {
    arrange();
    expect(await screen.findByText("Pessoa 01")).toBeInTheDocument();
    expect(screen.queryByText("Pessoa 12")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Próxima página" }));
    expect(screen.getByText("Pessoa 12")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Aurora" } });
    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(screen.getByText("Aurora · Diretoria")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Página anterior" })).toBeDisabled();
  });

  it("envia convite com assunto e permite cancelar pela aba Enviados", async () => {
    arrange();
    const person = await screen.findByText("Pessoa 01");
    fireEvent.click(within(person.closest("article")!).getByRole("button"));
    const dialog = screen.getByRole("dialog", { name: "Conversar com Pessoa 01?" });
    fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "Distribuição" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Enviar convite" }));
    await waitFor(() => expect(mocks.api).toHaveBeenCalledWith("networking-requests/", { method: "POST", body: { event: event.id, recipient_registration: "reg-0", topic: "Distribuição" } }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole("tab", { name: "Enviados" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar convite" }));
    expect(await screen.findByText("Convite cancelado.")).toBeInTheDocument();
  });

  it("aceita um entre vários convites, bloqueia novos e encerra com confirmação", async () => {
    arrange([invitation("first", 0), invitation("second", 1)]);
    await screen.findByText("Pessoa 01");
    fireEvent.click(screen.getByRole("tab", { name: "Recebidos" }));
    expect(screen.getAllByRole("button", { name: "Aceitar" })).toHaveLength(2);
    fireEvent.click(within(screen.getByText("Pessoa 01").closest("article")!).getByRole("button", { name: "Aceitar" }));
    const join = await screen.findByRole("link", { name: "Entrar na conversa" });
    expect(join).toHaveAttribute("href", "/eventos/encontro/networking/first");
    fireEvent.click(screen.getByRole("tab", { name: "Pessoas" }));
    expect(screen.getAllByRole("button", { name: "Você está em um 1:1" }).every((button) => button.hasAttribute("disabled"))).toBe(true);
    fireEvent.click(screen.getByRole("tab", { name: "Conversa 1:1" }));
    fireEvent.click(screen.getByRole("button", { name: "Sair do 1:1" }));
    expect(mocks.api.mock.calls.some(([path]) => path === "networking-requests/first/end/")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Confirmar saída" }));
    await screen.findByText("Conversa encerrada. Você pode iniciar novas conexões.");
    expect(screen.getAllByRole("button", { name: "Convidar para conversar" }).every((button) => !button.hasAttribute("disabled"))).toBe(true);
  });

  it("mantém acesso ao 1:1 ativo mesmo quando o organizador fecha as rodadas", async () => {
    arrange([{ ...invitation("active", 0), status: "accepted" }], false);
    expect(await screen.findByText("As rodadas estão fechadas.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Conversa 1:1" }));
    expect(screen.getByRole("link", { name: "Entrar na conversa" })).toHaveAttribute("href", "/eventos/encontro/networking/active");
    expect(mocks.api.mock.calls.some(([path]) => path === "networking-presences/heartbeat/")).toBe(false);
  });

  it("preserva o formulário e informa quando um convite falha", async () => {
    arrange();
    const person = await screen.findByText("Pessoa 01");
    const original = mocks.api.getMockImplementation()!;
    mocks.api.mockImplementation(async (path, options) => {
      if (path === "networking-requests/" && options?.method === "POST") throw new Error("Esta pessoa não está mais no lobby.");
      return original(path, options);
    });
    fireEvent.click(within(person.closest("article")!).getByRole("button"));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "Parceria" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Enviar convite" }));
    expect(await screen.findByText("Esta pessoa não está mais no lobby.")).toBeInTheDocument();
    expect(within(screen.getByRole("dialog")).getByRole("textbox")).toHaveValue("Parceria");
  });
});
