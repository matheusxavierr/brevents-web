import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CoordinatorsPanel } from "@/components/event-dashboard/coordinators-panel";
import { CompanyRoomsPanel } from "@/components/event-dashboard/company-rooms-panel";
import { OrganizerDashboard } from "@/components/organizer-dashboard";
import { NetworkingLobby } from "@/components/networking-lobby";
import { HomeHeader } from "@/components/home-header";
import { SessionProvider } from "@/components/session-provider";
import type { EventCoordinator, EventData, Registration, Room, User } from "@/lib/api-types";
import type { DashboardAction } from "@/components/event-dashboard/shared";

const mocks = vi.hoisted(() => ({ api: vi.fn(), router: { replace: vi.fn(), push: vi.fn(), refresh: vi.fn() } }));
vi.mock("@/lib/api-client", () => ({ apiClient: mocks.api }));
vi.mock("next/navigation", () => ({ useRouter: () => mocks.router, usePathname: () => "/" }));
const user: User = { id: 7, username: "ana", name: "Ana", first_name: "Ana", last_name: "", email: "ana@example.com", account_type: "attendee", is_staff: false, is_superuser: false, can_manage_events: true };
const owner: EventCoordinator = { id: 1, username: "org", first_name: "Organizador", last_name: "", email: "org@example.com" };
const event: EventData = { id: "event", owner, managers: [user.id], name: "Encontro", slug: "encontro", description: "", starts_at: "2026-10-14T15:00:00Z", ends_at: "2026-10-14T19:00:00Z", timezone: "America/Sao_Paulo", status: "published", access_mode: "registration", registration_open: true, public_config: {}, branding: {}, feature_flags: { networking_open: true } };
const registrations: Registration[] = [
  { id: "reg-1", event: event.id, user: user.id, name: "Ana", email: user.email, status: "confirmed", ticket_code: "", profile: { company: "Acme" }, created_at: event.starts_at },
  { id: "reg-2", event: event.id, user: 8, name: "Bia", email: "bia@example.com", status: "confirmed", ticket_code: "", profile: { company: " ACME " }, created_at: event.starts_at },
];
const room: Room = { id: "company-room", event: event.id, name: "Acme · Bia", description: "Parcerias", company_name: "Acme", contact_name: "Bia", host_registration: "reg-2", mode: "meeting", purpose: "networking", visibility: "public", capacity: null, position: 0 };
const paginated = (results: unknown[]) => ({ results, next: null, count: results.length });
const action: DashboardAction = async (operation) => { await operation(); return true; };

describe("coordenação do evento e salas por empresa", () => {
  beforeEach(() => { mocks.api.mockReset(); mocks.router.replace.mockClear(); });
  afterEach(cleanup);

  it("adiciona coordenador pelo e-mail e confirma remoção em modal", async () => {
    const member: EventCoordinator = { id: 7, username: "ana", first_name: "Ana", last_name: "", email: user.email };
    mocks.api.mockImplementation(async (_path, options) => options?.method === "POST" ? [member] : []);
    render(<CoordinatorsPanel event={event} busy={false} action={action} />);
    await screen.findByText("Nenhum coordenador adicionado ainda.");
    fireEvent.change(screen.getByLabelText("E-mail da conta"), { target: { value: user.email } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar coordenador" }));
    await screen.findByText(user.email);
    expect(mocks.api).toHaveBeenCalledWith("events/event/coordinators/", { method: "POST", body: { email: user.email } });
    fireEvent.click(screen.getByRole("button", { name: `Remover ${user.email}` }));
    const dialog = screen.getByRole("dialog", { name: "Remover coordenador?" });
    expect(mocks.api.mock.calls.some(([, options]) => options?.method === "DELETE")).toBe(false);
    fireEvent.click(within(dialog).getByRole("button", { name: "Remover coordenador" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(mocks.api).toHaveBeenCalledWith("events/event/coordinators/", { method: "DELETE", body: { email: user.email } });
  });

  it("prepara uma sala por empresa usando representantes confirmados mesmo com rodadas fechadas", async () => {
    mocks.api.mockResolvedValue(room);
    render(<CompanyRoomsPanel event={{ ...event, feature_flags: {} }} registrations={[...registrations, { ...registrations[0], id: "cancelled", name: "Cancelada", profile: { company: "Cancelada" }, status: "cancelled" }]} rooms={[]} action={action} busy={false} />);
    expect(screen.getAllByRole("row")).toHaveLength(2);
    fireEvent.click(screen.getAllByRole("button", { name: "Preparar sala" })[0]);
    const dialog = screen.getByRole("dialog", { name: "Preparar sala da empresa" });
    expect(within(dialog).getByLabelText("Empresa inscrita").querySelectorAll("option")).toHaveLength(1);
    fireEvent.change(within(dialog).getByLabelText("Representante de contato"), { target: { value: "reg-2" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar sala" }));
    await waitFor(() => expect(mocks.api).toHaveBeenCalledWith("rooms/networking/", { method: "POST", body: { event: "event", host_registration: "reg-2", location: "", topic: "" } }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("abre o painel para coordenador com conta participante e exibe sua equipe", async () => {
    mocks.api.mockImplementation(async (path: string) => {
      if (path === "events/?managed=true") return paginated([event]);
      if (path.endsWith("/coordinators/")) return [];
      if (path.endsWith("/analytics/")) return { registrations: 2, rooms: [] };
      return paginated([]);
    });
    render(<SessionProvider initialUser={user}><OrganizerDashboard /></SessionProvider>);
    fireEvent.click(await screen.findByRole("button", { name: "Coordenadores" }));
    await screen.findByText("Equipe do evento");
    expect(mocks.router.replace).not.toHaveBeenCalledWith("/");
    expect(screen.queryByRole("link", { name: "Novo evento" })).not.toBeInTheDocument();
  });

  it("mostra Meu painel no cabeçalho de uma conta coordenadora", () => {
    render(<SessionProvider initialUser={user}><HomeHeader /></SessionProvider>);
    expect(screen.getByRole("link", { name: "Meu painel" })).toHaveAttribute("href", "/painel");
  });

  it("abre diretamente a aba Salas e destaca a sala da empresa para outro representante", async () => {
    mocks.api.mockImplementation(async (path: string) => {
      if (path.startsWith("public/")) return event;
      if (path === "networking-presences/heartbeat/") return { registration: "reg-1", registration_detail: registrations[0] };
      if (path.startsWith("networking-presences/online/")) return [];
      if (path.startsWith("rooms/?")) return paginated([room]);
      return paginated([]);
    });
    render(<SessionProvider initialUser={user}><NetworkingLobby event={event} /></SessionProvider>);
    expect(await screen.findByText("Sua sala neste evento")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Salas" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("link", { name: "Abrir minha sala" })).toHaveAttribute("href", "/eventos/encontro/networking/salas/company-room");
  });
});
