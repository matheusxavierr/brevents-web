import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CompanyHubIntroduction } from "@/components/company-hub-introduction";

vi.mock("@/components/home-header", () => ({ HomeHeader: () => <header>BR Events</header> }));
afterEach(cleanup);

describe("apresentação do hub", () => {
  it("explica o hub e oferece configuração sem mostrar o formulário antes do clique", () => {
    render(<CompanyHubIntroduction />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Sua empresa merece um lugar para se apresentar.");
    expect(screen.getByText(/Destaque até 3 produtos/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Criar ou editar meu hub/ })).toHaveAttribute("href", "/hub/configurar");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
});
