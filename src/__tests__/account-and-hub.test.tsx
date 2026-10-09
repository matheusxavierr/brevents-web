import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CompanyHubAdmin } from "@/components/company-hub-admin";
import { HomeHeader } from "@/components/home-header";
import { SessionProvider } from "@/components/session-provider";
import type { Organization, User } from "@/lib/api-types";

const apiClientMock = vi.fn();

vi.mock("@/lib/api-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-client")>("@/lib/api-client");
  return { ...actual, apiClient: (...args: unknown[]) => apiClientMock(...args) };
});

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn(), push: vi.fn() }),
}));

describe("conta e hub", () => {
  afterEach(cleanup);
  beforeEach(() => {
    apiClientMock.mockReset();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("abre os dados do usuário pelo header e oferece o hub para participante", async () => {
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

    render(<SessionProvider initialUser={user}><HomeHeader /></SessionProvider>);
    const accountButton = screen.getByRole("button", { name: /Ana Lima/i });
    expect(screen.getByRole("link", { name: "Hub da empresa" })).toBeInTheDocument();
    fireEvent.click(accountButton);
    expect(screen.getByRole("dialog", { name: "Ana Lima" })).toBeInTheDocument();
    expect(screen.getByText("ana@example.com")).toBeInTheDocument();
    expect(screen.getByText("Participante")).toBeInTheDocument();
  });

  it("mostra claramente os campos obrigatórios ao criar um hub", async () => {
    apiClientMock.mockResolvedValueOnce({ count: 0, next: null, previous: null, results: [] });
    render(<CompanyHubAdmin />);

    const name = await screen.findByRole("textbox", { name: /Nome da empresa/i });
    expect(name).toBeRequired();
    expect(screen.getByText("* Campo obrigatório")).toBeInTheDocument();
    expect(screen.getAllByText("Opcional")).toHaveLength(2);

    await waitFor(() => expect(apiClientMock).toHaveBeenCalledWith("organizations/"));
  });

  it("atualiza a prévia antes de salvar e publica as duas cores escolhidas", async () => {
    const company: Organization = {
      id: "hub-1", name: "Aurora", slug: "aurora", headline: "Olá, mundo", description: "Sobre nós",
      logo_url: "", cover_image_url: "https://example.com/capa.jpg", contact_email: "", contact_phone: "",
      website_url: "", social_links: {}, custom_domain: null,
      branding: { primary_color: "#135bca", accent_color: "#24824f" }, feature_flags: {}, events: [],
    };
    apiClientMock.mockResolvedValueOnce({ results: [company] });
    render(<CompanyHubAdmin />);
    const primary = await screen.findByLabelText(/Cor principal/);
    fireEvent.change(primary, { target: { value: "#ff3f05" } });
    fireEvent.change(screen.getByLabelText(/Cor de apoio/), { target: { value: "#40ff00" } });
    fireEvent.change(screen.getByLabelText("Frase principal"), { target: { value: "Uma marca nova" } });
    const preview = screen.getByRole("complementary");
    expect(within(preview).getByRole("heading", { name: "Uma marca nova" })).toBeInTheDocument();
    expect(preview.querySelector('[style*="--hub-primary"]')).toHaveStyle({ "--hub-primary": "#ff3f05", "--hub-accent": "#40ff00" });
    expect(apiClientMock).toHaveBeenCalledTimes(1);

    apiClientMock.mockResolvedValueOnce({ ...company, headline: "Uma marca nova", branding: { primary_color: "#ff3f05", accent_color: "#40ff00" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar personalização" }));
    await screen.findByText("Página da empresa atualizada.");
    expect(apiClientMock).toHaveBeenLastCalledWith("organizations/hub-1/", expect.objectContaining({
      method: "PATCH", body: expect.objectContaining({ headline: "Uma marca nova", branding: { primary_color: "#ff3f05", accent_color: "#40ff00" } }),
    }));
    expect(preview.querySelector('[style*="--hub-primary"]')).toHaveStyle({ "--hub-primary": "#ff3f05", "--hub-accent": "#40ff00" });
  });

  it("adiciona até três itens, permite editar e remover e envia o mostruário junto do hub", async () => {
    const company: Organization = {
      id: "showcase-hub", name: "Aurora", slug: "aurora", headline: "Uma empresa", description: "Sobre nós",
      logo_url: "", cover_image_url: "", contact_email: "", contact_phone: "", website_url: "",
      social_links: {}, custom_domain: null, branding: {}, feature_flags: {}, events: [], showcase_items: [],
    };
    apiClientMock.mockResolvedValueOnce({ results: [company] });
    render(<CompanyHubAdmin />);
    const add = await screen.findByRole("button", { name: "Adicionar produto ou serviço" });
    expect(screen.queryByRole("combobox", { name: "Empresa atual" })).not.toBeInTheDocument();
    fireEvent.click(add);
    fireEvent.change(screen.getByRole("textbox", { name: /Nome do item/ }), { target: { value: "Consultoria" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Tipo" }), { target: { value: "service" } });
    fireEvent.change(screen.getByLabelText("Frase principal"), { target: { value: "Nova frase" } });
    expect(within(screen.getByRole("complementary")).getByRole("heading", { name: "Consultoria" })).toBeInTheDocument();
    fireEvent.click(add);
    fireEvent.click(add);
    expect(add).toBeDisabled();
    expect(screen.getByText(/Limite de 3 itens atingido/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remover item 3" }));
    fireEvent.click(screen.getByRole("button", { name: "Remover item 2" }));
    expect(add).toBeEnabled();
    fireEvent.change(screen.getByRole("textbox", { name: /Nome do item/ }), { target: { value: "Consultoria empresarial" } });
    fireEvent.change(screen.getByRole("textbox", { name: /Preço \(R\$\)/ }), { target: { value: "1.234,56" } });
    expect(within(screen.getByRole("complementary")).getByText(/R\$\s*1\.234,56/)).toBeInTheDocument();
    const items = [{ name: "Consultoria empresarial", item_type: "service", description: "", image_url: "", price: "1234.56" }];
    apiClientMock.mockResolvedValueOnce({ ...company, showcase_items: items });
    fireEvent.click(screen.getByRole("button", { name: "Salvar personalização" }));
    await screen.findByText("Página da empresa atualizada.");
    expect(apiClientMock).toHaveBeenLastCalledWith("organizations/showcase-hub/", expect.objectContaining({
      body: expect.objectContaining({ showcase_items: items, headline: "Nova frase" }),
    }));
  });
});
