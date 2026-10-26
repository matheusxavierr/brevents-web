import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ImporterEnrollment } from "@/components/event-dashboard/importer-enrollment";
import type { DashboardAction } from "@/components/event-dashboard/shared";
import { ApiError } from "@/lib/api-client";
import type { EventData } from "@/lib/api-types";

const api = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api-client", async () => ({ ...await vi.importActual<typeof import("@/lib/api-client")>("@/lib/api-client"), apiClient: api }));
const event: EventData = { id: "event-1", name: "Encontro Aurora", slug: "aurora", description: "", starts_at: "2026-11-10T12:00:00Z", ends_at: "2026-11-10T14:00:00Z", timezone: "America/Sao_Paulo", access_mode: "registration", registration_open: true, public_config: {}, feature_flags: {}, branding: {} };
const action: DashboardAction = async (operation, _message, onError) => {
  try { await operation(); return true; } catch (reason) { onError?.(reason); return false; }
};
const preview = {
  total: 3, ready: 1, skipped: 2, token: "signed-preview", expires_in: 1800,
  rows: [
    { row: 2, name: "Ana Lima", email: "ana@example.com", company: "Aurora", role: "Diretora", state: "ready", message: "Pronto para inscrever como importador." },
    { row: 3, name: "Bia", email: "bia@example.com", state: "existing", message: "Já inscrito neste evento. Nenhum dado será alterado." },
    { row: 4, name: "Cris", email: "invalid", state: "invalid", message: "email: Informe um e-mail válido." },
  ],
};

function open(mode: "single" | "file") {
  render(<ImporterEnrollment event={event} action={action} busy={false} />);
  fireEvent.click(screen.getByRole("button", { name: mode === "single" ? "Inscrever importador" : "Importar arquivo" }));
  return screen.getByRole("dialog");
}

function selectFile(dialog: HTMLElement, file = new File(["Nome;E-mail\nAna;ana@example.com"], "clientes.csv", { type: "text/csv" })) {
  fireEvent.change(within(dialog).getByLabelText("Arquivo de clientes"), { target: { files: [file] } });
}

function analyzeFile(dialog: HTMLElement) {
  fireEvent.submit(within(dialog).getByRole("button", { name: "Analisar arquivo" }).closest("form")!);
}

describe("cadastro de clientes importadores", () => {
  beforeEach(() => { api.mockReset(); });
  afterEach(cleanup);

  it("cadastra cliente individual no evento certo sem enviar identidade ou consentimento do organizador", async () => {
    api.mockResolvedValue({ id: "registration" });
    const dialog = open("single");
    expect(within(dialog).getByText(event.name)).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText("Nome completo *"), { target: { value: "Ana Lima" } });
    fireEvent.change(within(dialog).getByLabelText("E-mail *"), { target: { value: "ana@example.com" } });
    fireEvent.change(within(dialog).getByLabelText("Empresa"), { target: { value: "Aurora" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirmar inscrição" }));
    await waitFor(() => expect(api).toHaveBeenCalledWith("registrations/importer/", { method: "POST", body: { event: event.id, name: "Ana Lima", email: "ana@example.com", company: "Aurora", role: "" } }));
    expect(await within(dialog).findByRole("heading", { name: "1 cliente inscrito" })).toBeInTheDocument();
    expect(within(dialog).getByText(/Nenhuma conta ou senha foi criada/)).toBeInTheDocument();
  });

  it("preserva os valores e mostra erros no modal", async () => {
    api.mockRejectedValue(new ApiError(400, { email: ["Este e-mail já está inscrito no evento."] }));
    const dialog = open("single");
    fireEvent.change(within(dialog).getByLabelText("Nome completo *"), { target: { value: "Ana" } });
    fireEvent.change(within(dialog).getByLabelText("E-mail *"), { target: { value: "ana@example.com" } });
    fireEvent.submit(within(dialog).getByRole("button", { name: "Confirmar inscrição" }).closest("form")!);
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("E-mail: Este e-mail já está inscrito no evento.");
    expect(within(dialog).getByLabelText("Nome completo *")).toHaveValue("Ana");
  });

  it("informa formatos, limite e estrutura e disponibiliza modelo CSV", () => {
    const dialog = open("file");
    expect(within(dialog).getByLabelText("Arquivo de clientes")).toHaveAttribute("accept", ".csv,.xlsx,.docx,.pdf");
    expect(within(dialog).getByText(/até 3 MB e 500 pessoas/)).toBeInTheDocument();
    expect(within(dialog).getByText("Nome | E-mail | Empresa | Cargo")).toBeInTheDocument();
    expect(within(dialog).getByText(/texto selecionável, até 20 páginas/)).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: /Baixar modelo CSV/ })).toHaveAttribute("href", "/modelos/importadores.csv");
    expect(within(dialog).getByRole("button", { name: "Analisar arquivo" })).toBeDisabled();
  });

  it("envia multipart para analisar, mostra prévia e só confirma os válidos com token", async () => {
    api.mockResolvedValueOnce(preview).mockResolvedValueOnce({ created: 1, skipped: 0 });
    const dialog = open("file");
    selectFile(dialog);
    analyzeFile(dialog);
    expect(await within(dialog).findByText("1 prontos para inscrever")).toBeInTheDocument();
    const body = api.mock.calls[0][1].body as FormData;
    expect(body.get("event")).toBe(event.id);
    expect((body.get("file") as File).name).toBe("clientes.csv");
    expect(api).toHaveBeenCalledTimes(1);
    expect(within(dialog).getByText("Já inscrito")).toBeInTheDocument();
    expect(within(dialog).getByText("Corrigir")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Inscrever 1 importador válido" }));
    await waitFor(() => expect(api).toHaveBeenLastCalledWith("registrations/import-confirm/", { method: "POST", body: { event: event.id, token: preview.token } }));
    expect(await within(dialog).findByRole("heading", { name: "1 cliente inscrito" })).toBeInTheDocument();
  });

  it("descarta prévia quando escolhe outro arquivo", async () => {
    api.mockResolvedValue(preview);
    const dialog = open("file");
    selectFile(dialog);
    analyzeFile(dialog);
    await within(dialog).findByLabelText("Prévia da importação");
    selectFile(dialog, new File(["different"], "nova-lista.csv"));
    expect(within(dialog).queryByLabelText("Prévia da importação")).not.toBeInTheDocument();
    expect(api).toHaveBeenCalledTimes(1);
  });

  it("não confirma uma prévia sem contatos válidos", async () => {
    api.mockResolvedValue({ ...preview, ready: 0 });
    const dialog = open("file");
    selectFile(dialog);
    analyzeFile(dialog);
    expect(await within(dialog).findByRole("button", { name: "Inscrever 0 importadores válidos" })).toBeDisabled();
  });

  it("rejeita extensão não suportada e arquivo grande antes de enviar", async () => {
    const dialog = open("file");
    selectFile(dialog, new File(["invalid"], "lista.xls"));
    analyzeFile(dialog);
    expect(within(dialog).getByRole("alert")).toHaveTextContent("Selecione um arquivo CSV, XLSX, DOCX ou PDF.");
    selectFile(dialog, new File([new Uint8Array(3 * 1024 * 1024 + 1)], "lista.pdf"));
    analyzeFile(dialog);
    expect(within(dialog).getByRole("alert")).toHaveTextContent("O arquivo pode ter no máximo 3 MB.");
    expect(api).not.toHaveBeenCalled();
  });

  it("mostra erros de leitura sem perder a escolha do arquivo", async () => {
    api.mockRejectedValue(new ApiError(400, { file: ["Cabeçalho obrigatório: Nome e E-mail."] }));
    const dialog = open("file");
    selectFile(dialog);
    analyzeFile(dialog);
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Arquivo: Cabeçalho obrigatório: Nome e E-mail.");
    expect(within(dialog).getByRole("button", { name: "Analisar arquivo" })).toBeEnabled();
  });

  it("desabilita cadastros no evento encerrado", () => {
    render(<ImporterEnrollment event={{ ...event, status: "ended" }} action={action} busy={false} />);
    expect(screen.getByRole("button", { name: "Inscrever importador" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Importar arquivo" })).toBeDisabled();
  });
});
