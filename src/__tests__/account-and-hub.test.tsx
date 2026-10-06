import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CompanyHubAdmin } from "@/components/company-hub-admin";
import { HomeHeader } from "@/components/home-header";

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
  beforeEach(() => {
    apiClientMock.mockReset();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("abre os dados do usuário pelo header e oferece o hub para participante", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      id: 7,
      username: "ana@example.com",
      name: "Ana Lima",
      first_name: "Ana",
      last_name: "Lima",
      email: "ana@example.com",
      is_staff: false,
      is_superuser: false,
      account_type: "attendee",
    }), { status: 200 }));

    render(<HomeHeader />);
    const accountButton = await screen.findByRole("button", { name: /Ana Lima/i });
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
});
