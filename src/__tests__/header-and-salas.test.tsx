import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HomeHeader } from "@/components/home-header";
import { MyEventsPage } from "@/components/my-events-page";
import { NetworkingLobby } from "@/components/networking-lobby";
import { SessionProvider } from "@/components/session-provider";
import type { EventData, User } from "@/lib/api-types";

const apiClientMock = vi.fn();

vi.mock("@/lib/api-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-client")>("@/lib/api-client");
  return { ...actual, apiClient: (...args: unknown[]) => apiClientMock(...args) };
});

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn(), push: vi.fn() }),
}));

const user: User = {
  id: 7,
  username: "ana@example.com",
  name: "Ana Lima",
  first_name: "Ana",
  last_name: "Lima",
  email: "ana@example.com",
  is_staff: false,
  is_superuser: false,
  account_type: "attendee",
};

const event: EventData = {
  id: "e1",
  name: "BR Tech Webinar",
  slug: "br-tech-webinar",
  description: "Evento de tecnologia",
  timezone: "America/Sao_Paulo",
  starts_at: "2026-11-10T18:00:00-03:00",
  ends_at: "2026-11-10T22:00:00-03:00",
  status: "published",
  access_mode: "registration",
  registration_open: true,
  public_config: {},
  branding: {},
  feature_flags: {},
};

function paginated<T>(results: T[]) {
  return { count: results.length, next: null, previous: null, results };
}

function mockRegisteredEvents() {
  const meeting = { ...event, id: "m1", name: "Meeting privado", slug: "meeting-privado", public_config: { product_type: "meeting" } };
  apiClientMock.mockImplementation((path: string) => {
    if (path === "registrations/") {
      return Promise.resolve(paginated([event, meeting].map((item) => ({
        id: `registration-${item.id}`, event: item.id, user: user.id, email: user.email,
        name: user.name, status: "confirmed", ticket_code: item.id, profile: {}, created_at: "",
      }))));
    }
    if (path === "events/") return Promise.resolve(paginated([meeting, event]));
    return Promise.resolve(paginated([]));
  });
}

describe("header logado e salas de matchmaking", () => {
  beforeEach(() => {
    apiClientMock.mockReset();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    cleanup();
  });

  it("mostra os menus Produtos e Meus eventos com as inscrições do usuário", async () => {
    mockRegisteredEvents();

    render(<SessionProvider initialUser={user}><HomeHeader /></SessionProvider>);

    expect(screen.getByRole("button", { name: /Produtos/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Criar meeting/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Hub da empresa" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Meus eventos/i }));
    expect(await screen.findByText("BR Tech Webinar")).toBeInTheDocument();
    expect(screen.queryByText("Meeting privado")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ver todos os meus eventos/i })).toHaveAttribute("href", "/meus-eventos");
  });

  it("lista somente Web Events na página Meus eventos, mesmo com inscrição em Meeting", async () => {
    mockRegisteredEvents();

    render(<SessionProvider initialUser={user}><MyEventsPage /></SessionProvider>);

    expect(await screen.findByRole("heading", { name: event.name })).toBeInTheDocument();
    expect(screen.queryByText("Meeting privado")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Entrar no lobby/i })).toHaveAttribute("href", `/eventos/${event.slug}/lobby`);
  });

  it("exige empresa e nome ao criar uma sala no matchmaking", async () => {
    const createdRoom = {
      id: "sala-1",
      event: "e1",
      name: "Acme · Ana Lima",
      description: "",
      mode: "meeting" as const,
      purpose: "networking" as const,
      visibility: "public" as const,
      capacity: null,
      position: 1,
      company_name: "Acme",
      contact_name: "Ana Lima",
      location: "São Paulo",
      host_registration: "reg-1",
      zoom_session: null,
    };
    apiClientMock.mockImplementation((path: string) => {
      if (path.startsWith("public/events/")) return Promise.resolve({ ...event, feature_flags: { networking_open: true } });
      if (path === "networking-presences/heartbeat/") {
        return Promise.resolve({ id: "p1", event: "e1", registration: "reg-1", registration_detail: { id: "reg-1", event: "e1", user: 7, email: user.email, name: user.name, status: "confirmed", ticket_code: "abc", profile: {}, created_at: "" }, last_seen_at: "" });
      }
      if (path.startsWith("networking-presences/online/")) return Promise.resolve([]);
      if (path.startsWith("networking-requests/")) return Promise.resolve(paginated([]));
      if (path === "rooms/networking/") return Promise.resolve(createdRoom);
      if (path.startsWith("rooms/")) return Promise.resolve(paginated([]));
      return Promise.resolve(paginated([]));
    });

    render(<SessionProvider initialUser={user}><NetworkingLobby event={event} /></SessionProvider>);

    fireEvent.click(await screen.findByRole("tab", { name: "Salas" }));
    fireEvent.click(screen.getByRole("button", { name: /Criar sala/i }));
    const dialog = screen.getByRole("dialog", { name: /Criar sala da empresa/i });
    const company = within(dialog).getByPlaceholderText("Ex.: Acme Ltda.");
    expect(company).toBeRequired();
    expect(within(dialog).getByPlaceholderText("Ex.: Ana Lima")).toBeRequired();

    fireEvent.click(within(dialog).getByRole("button", { name: /^Criar sala$/i }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Informe o nome da empresa.");

    fireEvent.change(company, { target: { value: "Acme" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /^Criar sala$/i }));
    await waitFor(() =>
      expect(apiClientMock).toHaveBeenCalledWith("rooms/networking/", {
        method: "POST",
        body: expect.objectContaining({ event: "e1", company_name: "Acme", contact_name: "Ana Lima" }),
      }),
    );
    expect(await screen.findByText(/Sala criada/i)).toBeInTheDocument();
  });
});
