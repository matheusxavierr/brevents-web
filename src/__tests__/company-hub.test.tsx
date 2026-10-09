import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CompanyHubView } from "@/components/company-hub-view";
import { getCompanyHubTheme } from "@/lib/company-hub-theme";
import type { Organization } from "@/lib/api-types";

const company: Organization = {
  id: "company-1", name: "Empresa Aurora", slug: "aurora", headline: "Conexões que transformam.",
  description: "Nossa história.\nUma nova ideia.", logo_url: "", cover_image_url: "https://example.com/cover.jpg",
  contact_email: "contato@aurora.com", contact_phone: "11999999999", website_url: "https://aurora.com",
  social_links: { instagram: "https://instagram.com/aurora", linkedin: "" }, custom_domain: null,
  branding: { primary_color: "#ff3f05", accent_color: "#40ff00" }, feature_flags: {}, events: [],
};

afterEach(cleanup);

describe("página da empresa", () => {
  it("aplica as duas cores mesmo com uma imagem de capa e mantém os contatos acessíveis", () => {
    const { container } = render(<CompanyHubView organization={company} />);
    const theme = container.firstElementChild as HTMLElement;
    expect(theme.style.getPropertyValue("--hub-primary")).toBe("#ff3f05");
    expect(theme.style.getPropertyValue("--hub-accent")).toBe("#40ff00");
    expect(theme.style.getPropertyValue("--hub-cover")).toContain(company.cover_image_url);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(company.headline);
    expect(screen.getByRole("link", { name: /E-mail/ })).toHaveAttribute("href", "mailto:contato@aurora.com");
    expect(screen.getByRole("link", { name: /Telefone/ })).toHaveAttribute("href", "tel:11999999999");
    expect(screen.getByRole("link", { name: "Instagram" })).toHaveAttribute("href", company.social_links.instagram);
    expect(screen.queryByRole("link", { name: "LinkedIn" })).not.toBeInTheDocument();
  });

  it("mantém as âncoras da prévia separadas das da página e trata conteúdo ausente", () => {
    const { container } = render(<CompanyHubView organization={{ ...company, logo_url: "", contact_email: "", contact_phone: "", website_url: "", social_links: {} }} preview />);
    const navigation = screen.getByRole("navigation", { name: "Seções da prévia" });
    fireEvent.click(within(navigation).getByRole("link", { name: "Sobre a empresa" }));
    expect(within(navigation).getByRole("link", { name: "Sobre a empresa" })).toHaveAttribute("href", "#preview-sobre");
    expect(container.querySelector("#preview-sobre")).toBeInTheDocument();
    expect(screen.getByText("Novos encontros vêm por aí.")).toBeInTheDocument();
    expect(screen.getByText(/Os canais de contato serão divulgados/)).toBeInTheDocument();
  });

  it("mostra produtos e serviços no mostruário e direciona o interesse aos contatos", () => {
    render(<CompanyHubView organization={{ ...company, showcase_items: [
      { name: "Produto Aurora", item_type: "product", description: "Feito para você", image_url: "https://example.com/produto.jpg", price: "149.90" },
      { name: "Consultoria", item_type: "service", description: "Orientação especializada", image_url: "" },
      { name: "Demonstração", item_type: "other", description: "", image_url: "", price: "0.00" },
    ] }} />);
    const showcase = screen.getByRole("region", { name: "Mostruário da empresa" });
    expect(within(showcase).getByRole("heading", { name: "Produto Aurora" })).toBeInTheDocument();
    expect(within(showcase).getByRole("img", { name: "Produto Aurora" })).toHaveAttribute("src", "https://example.com/produto.jpg");
    expect(within(showcase).getByText("Serviço")).toBeInTheDocument();
    expect(within(showcase).getByText(/R\$\s*149,90/)).toBeInTheDocument();
    expect(within(showcase).getByText(/R\$\s*0,00/)).toBeInTheDocument();
    expect(within(showcase).getAllByText(/R\$/)).toHaveLength(2);
    expect(within(showcase).getByRole("link", { name: "Saber mais sobre Consultoria" })).toHaveAttribute("href", "#contato");
  });
});

describe("contraste da identidade da empresa", () => {
  it("mantém texto legível para cores claras e escuras escolhidas pelo usuário", () => {
    expect(getCompanyHubTheme({ primary_color: "#ffffff", accent_color: "#000000" })).toMatchObject({ "--hub-on-primary": "#111827", "--hub-on-accent": "#FFFFFF" });
    expect(getCompanyHubTheme({ primary_color: "#000", accent_color: "#fff" })).toMatchObject({ "--hub-primary": "#000000", "--hub-accent": "#ffffff", "--hub-on-primary": "#FFFFFF", "--hub-on-accent": "#111827" });
    expect(getCompanyHubTheme({ primary_color: "#777777" })["--hub-on-primary"]).toBe("#000000");
  });

  it("usa as cores padrão para marcas sem personalização ou valores inválidos", () => {
    expect(getCompanyHubTheme({ primary_color: "", accent_color: "invalid" })).toEqual(getCompanyHubTheme());
  });
});
