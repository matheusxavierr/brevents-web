import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventLanding } from "@/components/event-landing";
import { EventLobby } from "@/components/event-lobby";
import { NetworkingLobby } from "@/components/networking-lobby";
import { RegistrationForm } from "@/components/registration-form";
import { SessionProvider } from "@/components/session-provider";
import { TransmissionPanel } from "@/components/event-dashboard/management-panels";
import type { EventData, User } from "@/lib/api-types";

const mocks = vi.hoisted(() => ({ api: vi.fn(), router: { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() } }));
vi.mock("@/lib/api-client", async () => ({ ...await vi.importActual<typeof import("@/lib/api-client")>("@/lib/api-client"), apiClient: mocks.api }));
vi.mock("next/navigation", () => ({ usePathname: () => "/eventos/encontro", useRouter: () => mocks.router }));
const event: EventData = { id: "event-1", name: "Encontro", slug: "encontro", description: "Conecte ideias e negócios", starts_at: "2026-10-10T15:00:00Z", ends_at: "2026-10-10T18:00:00Z", timezone: "America/Sao_Paulo", status: "published", registration_open: true, access_mode: "public", public_config: {}, feature_flags: { networking_open: false }, branding: {}, sessions: [], speakers: [{ id: "speaker", name: "Marina", bio: "Especialista em inovação", avatar_url: "" }] };
const user: User = { id: 7, name: "Ana", username: "ana", first_name: "Ana", last_name: "", email: "ana@example.com", is_staff: false, is_superuser: false, account_type: "attendee" };
const action = async (operation: () => Promise<unknown>) => { await operation(); return true; };

describe("página do evento e lobby", () => {
  beforeEach(() => { mocks.api.mockReset(); mocks.router.replace.mockReset(); vi.stubGlobal("fetch", vi.fn()); });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it("troca entre programação e palestrantes sem navegar para outra página", () => {
    render(<SessionProvider initialUser={null}><EventLanding event={event} /></SessionProvider>);
    fireEvent.click(screen.getByRole("tab", { name: "Programação" }));
    expect(screen.getByText("A programação será divulgada em breve.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Palestrantes" }));
    expect(screen.getByText("Marina")).toBeInTheDocument();
    expect(mocks.router.replace).not.toHaveBeenCalled();
  });

  it("conclui inscrição de visitante e encaminha ao lobby", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ id: "reg", status: "confirmed", name: "Visitante" }) } as Response);
    render(<SessionProvider initialUser={null}><RegistrationForm eventId={event.id} eventSlug={event.slug} accessMode="public" /></SessionProvider>);
    fireEvent.change(screen.getByLabelText("Nome completo"), { target: { value: "Visitante" } });
    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "visitante@example.com" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.submit(screen.getByRole("button", { name: "Confirmar inscrição" }).closest("form")!);
    await waitFor(() => expect(mocks.router.replace).toHaveBeenCalledWith("/eventos/encontro/lobby"));
    expect(screen.getByRole("link", { name: "Entrar no evento" })).toHaveAttribute("href", "/eventos/encontro/lobby");
  });

  it("conclui inscrição com conta e encaminha ao lobby", async () => {
    mocks.api.mockResolvedValue({ id: "reg", status: "confirmed" });
    render(<SessionProvider initialUser={user}><RegistrationForm eventId={event.id} eventSlug={event.slug} accessMode="registration" /></SessionProvider>);
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.submit(screen.getByRole("button", { name: "Confirmar inscrição" }).closest("form")!);
    await waitFor(() => expect(mocks.router.replace).toHaveBeenCalledWith("/eventos/encontro/lobby"));
  });

  it("permite o auditório mas mostra rodadas fechadas para inscrito", async () => {
    mocks.api.mockImplementation(async (path: string) => path.startsWith("public/") ? event : {});
    render(<SessionProvider initialUser={user}><EventLobby event={event} /></SessionProvider>);
    expect(await screen.findByRole("link", { name: "Entrar no auditório" })).toHaveAttribute("href", "/eventos/encontro/ao-vivo");
    expect(screen.getByRole("button", { name: "Aguardando abertura" })).toBeDisabled();
    expect(screen.queryByRole("link", { name: "Encontrar pessoas" })).not.toBeInTheDocument();
  });

  it("exige inscrição antes de liberar destinos no lobby", () => {
    mocks.api.mockResolvedValue(event);
    render(<SessionProvider initialUser={null}><EventLobby event={event} /></SessionProvider>);
    expect(screen.getByRole("link", { name: "Fazer inscrição" })).toHaveAttribute("href", "/eventos/encontro/inscricao");
    expect(screen.queryByRole("link", { name: "Entrar no auditório" })).not.toBeInTheDocument();
  });

  it("organizador confirma a abertura das rodadas pelo painel", async () => {
    mocks.api.mockResolvedValue({ ...event, feature_flags: { networking_open: true } });
    render(<TransmissionPanel event={event} rooms={[]} analytics={null} action={action} busy={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir rodadas" }));
    expect(mocks.api).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(mocks.api).toHaveBeenCalledWith("events/event-1/networking-state/", { method: "POST", body: { open: true } }));
  });

  it("acesso direto ao networking fechado não exibe pessoas nem inicia presença", async () => {
    mocks.api.mockImplementation(async (path: string) => path.startsWith("public/") ? event : { results: [], next: null });
    render(<SessionProvider initialUser={user}><NetworkingLobby event={event} /></SessionProvider>);
    expect(await screen.findByText("As rodadas estão fechadas.")).toBeInTheDocument();
    expect(mocks.api.mock.calls.some(([path]) => path === "networking-presences/heartbeat/")).toBe(false);
  });
});
