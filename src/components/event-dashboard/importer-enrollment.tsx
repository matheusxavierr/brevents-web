"use client";

import { useState, type FormEvent } from "react";
import { CheckCircle2, Download, FileUp, LoaderCircle, UserPlus } from "lucide-react";

import { ApiError, apiClient } from "@/lib/api-client";
import type { EventData } from "@/lib/api-types";
import { Dialog, type DashboardAction } from "./shared";
import styles from "./dashboard.module.css";
import layout from "./importer-enrollment.module.css";

type PreviewRow = {
  row: number; name?: string; email?: string; company?: string; role?: string;
  state: "ready" | "existing" | "duplicate" | "invalid"; message: string;
};
type ImportPreview = { rows: PreviewRow[]; total: number; ready: number; skipped: number; token: string; expires_in: number };
type ImportResult = { created: number; skipped: number };
const stateLabels = { ready: "Pronto", existing: "Já inscrito", duplicate: "Repetido", invalid: "Corrigir" };
const acceptedFiles = ".csv,.xlsx,.docx,.pdf";
const fieldLabels: Record<string, string> = { name: "Nome", email: "E-mail", company: "Empresa", role: "Cargo", file: "Arquivo", event: "Evento" };

function enrollmentError(reason: unknown) {
  if (reason instanceof ApiError && reason.details && typeof reason.details === "object" && !Array.isArray(reason.details)) {
    return Object.entries(reason.details).map(([key, messages]) => `${fieldLabels[key] ? `${fieldLabels[key]}: ` : ""}${Array.isArray(messages) ? messages.join(" ") : String(messages)}`).join(" ");
  }
  return reason instanceof Error ? reason.message : "Não foi possível concluir o cadastro. Tente novamente.";
}

export function ImporterEnrollment({ event, action, busy }: { event: EventData; action: DashboardAction; busy: boolean }) {
  const [mode, setMode] = useState<"single" | "file" | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [page, setPage] = useState(0);
  const disabled = busy || pending;
  const unavailable = event.status === "ended" || event.status === "archived";

  function open(next: "single" | "file") {
    setMode(next); setError(""); setFile(null); setPreview(null); setResult(null); setPage(0);
  }

  async function register(eventSubmit: FormEvent<HTMLFormElement>) {
    eventSubmit.preventDefault();
    if (disabled) return;
    const data = new FormData(eventSubmit.currentTarget);
    setPending(true); setError("");
    try {
      const saved = await action(() => apiClient("registrations/importer/", {
        method: "POST", body: { event: event.id, name: data.get("name"), email: data.get("email"), company: data.get("company"), role: data.get("role") },
      }), "Cliente inscrito como importador.", (reason) => setError(enrollmentError(reason)));
      if (saved) setResult({ created: 1, skipped: 0 });
    } finally { setPending(false); }
  }

  async function analyze(eventSubmit: FormEvent<HTMLFormElement>) {
    eventSubmit.preventDefault();
    if (!file || disabled) return;
    setError(""); setPreview(null); setPage(0);
    if (!/\.(csv|xlsx|docx|pdf)$/i.test(file.name)) { setError("Selecione um arquivo CSV, XLSX, DOCX ou PDF."); return; }
    if (file.size > 3 * 1024 * 1024) { setError("O arquivo pode ter no máximo 3 MB."); return; }
    setPending(true);
    const body = new FormData();
    body.set("event", event.id); body.set("file", file);
    try { setPreview(await apiClient<ImportPreview>("registrations/import-preview/", { method: "POST", body })); }
    catch (reason) { setError(enrollmentError(reason)); }
    finally { setPending(false); }
  }

  async function confirm() {
    if (!preview?.ready || disabled) return;
    setPending(true); setError("");
    try {
      let outcome: ImportResult | null = null;
      const saved = await action(async () => {
        outcome = await apiClient<ImportResult>("registrations/import-confirm/", { method: "POST", body: { event: event.id, token: preview.token } });
      }, "Importação concluída. Lista de participantes atualizada.", (reason) => setError(enrollmentError(reason)));
      if (saved && outcome) setResult(outcome);
    } finally { setPending(false); }
  }

  return <>
    <div className={layout.launchers}>
      <button type="button" className={styles.secondary} disabled={disabled || unavailable} onClick={() => open("file")}><FileUp size={16} /> Importar arquivo</button>
      <button type="button" className={styles.primary} disabled={disabled || unavailable} onClick={() => open("single")}><UserPlus size={16} /> Inscrever importador</button>
    </div>
    {mode && <Dialog title={mode === "single" ? "Inscrever cliente importador" : "Importar clientes importadores"} busy={disabled} onClose={() => setMode(null)}>
      <div className={layout.event}><span>EVENTO SELECIONADO</span><strong>{event.name}</strong><small>As inscrições serão confirmadas com o perfil Importador.</small></div>
      {result ? <div className={layout.result} role="status"><CheckCircle2 size={34} /><h3>{result.created === 1 ? "1 cliente inscrito" : `${result.created} clientes inscritos`}</h3><p>{result.skipped > 0 ? `${result.skipped} já estavam inscritos na confirmação e foram preservados. ` : ""}Nenhuma conta ou senha foi criada e nenhum e-mail foi enviado. Compartilhe o link do evento com os clientes.</p><p>Para acessar o matchmaking, o cliente precisa entrar ou criar uma conta com o mesmo e-mail da inscrição.</p><div className={styles.formActions}><button type="button" className={styles.secondary} onClick={() => open(mode)}>Cadastrar mais</button><button type="button" className={styles.primary} onClick={() => setMode(null)}>Concluir</button></div></div> : <>
        <p className={layout.notice}>Vinculamos contas existentes pelo e-mail. Quem ainda não tem conta poderá criá-la depois com o mesmo e-mail. Não criamos senhas nem enviamos convites automaticamente.</p>
        {error && <div className={layout.error} role="alert">{error}</div>}
        {mode === "single" ? <form className={styles.form} onSubmit={register}>
          <div className={styles.formGrid}>
            <label className={styles.field}>Nome completo *<input autoFocus name="name" autoComplete="name" required maxLength={200} disabled={disabled} /></label>
            <label className={styles.field}>E-mail *<input name="email" type="email" autoComplete="email" required maxLength={254} disabled={disabled} /></label>
            <label className={styles.field}>Empresa<input name="company" autoComplete="organization" maxLength={120} disabled={disabled} /></label>
            <label className={styles.field}>Cargo<input name="role" autoComplete="organization-title" maxLength={120} disabled={disabled} /></label>
          </div>
          <p className={styles.hint}>* Campos obrigatórios. Inscreva apenas clientes cujos dados você tem autorização para utilizar. O cadastro não registra consentimento em nome do cliente.</p>
          <div className={styles.formActions}><button type="button" className={styles.secondary} onClick={() => setMode(null)} disabled={disabled}>Cancelar</button><button type="submit" className={styles.primary} disabled={disabled}>{pending && <LoaderCircle size={16} className="spin" />} Confirmar inscrição</button></div>
        </form> : <>
          <details className={layout.instructions} open={!preview}>
            <summary>Como preparar o arquivo</summary>
            <p><strong>CSV, XLSX, DOCX ou PDF · até 3 MB e 500 pessoas.</strong> Nome e e-mail são obrigatórios. Empresa e cargo são opcionais.</p>
            <code>Nome | E-mail | Empresa | Cargo</code><code>Ana Lima | ana@exemplo.com | Aurora | Compradora</code>
            <ul><li><strong>CSV:</strong> UTF-8, primeira linha com os títulos das colunas. Use vírgula, ponto e vírgula ou tabulação.</li><li><strong>XLSX:</strong> dados na primeira aba, cabeçalho na primeira linha, uma pessoa por linha. Sem fórmulas ou células mescladas.</li><li><strong>DOCX:</strong> uma única tabela com cabeçalho, sem células mescladas. Também aceita uma pessoa por parágrafo com os campos separados por <strong>|</strong>.</li><li><strong>PDF:</strong> texto selecionável, até 20 páginas, cabeçalho e uma pessoa por linha com os campos separados por <strong>|</strong>. Não aceita foto, digitalização ou senha.</li></ul>
            <a className={layout.download} href="/modelos/importadores.csv" download><Download size={15} /> Baixar modelo CSV</a>
            <p>Não envie senhas. Arquivos .xls, .doc e imagens não são aceitos. Dados de inscrições existentes nunca serão sobrescritos.</p>
          </details>
          <form className={layout.upload} onSubmit={analyze}>
            <label className={styles.field}>Arquivo de clientes<input type="file" accept={acceptedFiles} required disabled={disabled} onChange={(change) => { setFile(change.target.files?.[0] ?? null); setPreview(null); setPage(0); setError(""); }} /></label>
            <button type="submit" className={styles.secondary} disabled={!file || disabled}>{pending && !preview ? <LoaderCircle size={16} className="spin" /> : <FileUp size={16} />} Analisar arquivo</button>
          </form>
          {preview && <section className={layout.preview} aria-label="Prévia da importação">
            <div className={layout.summary} role="status"><strong>{preview.ready} prontos para inscrever</strong><span>{preview.skipped} ignorados · {preview.total} encontrados</span></div>
            <p>Revise antes de confirmar. Somente os válidos serão inscritos; corrija os demais no arquivo e envie novamente. A prévia vale por 30 minutos.</p>
            <div className={layout.previewList}>{preview.rows.slice(page * 10, page * 10 + 10).map((row) => <article key={row.row} className={layout.previewRow}><div><strong>{row.name || "Sem nome"}</strong><span className={row.state === "ready" ? layout.ready : layout.skipped}>{stateLabels[row.state]}</span></div><small>Linha {row.row} · {row.email || "Sem e-mail"}</small>{(row.company || row.role) && <small>{[row.company, row.role].filter(Boolean).join(" · ")}</small>}<p>{row.message}</p></article>)}</div>
            <div className={layout.pagination}><button type="button" className={styles.secondary} disabled={page === 0 || disabled} onClick={() => setPage(page - 1)}>Anterior</button><span>{page + 1} / {Math.max(1, Math.ceil(preview.rows.length / 10))}</span><button type="button" className={styles.secondary} disabled={(page + 1) * 10 >= preview.rows.length || disabled} onClick={() => setPage(page + 1)}>Próxima</button></div>
            <p className={styles.hint}>Confirme somente se tiver autorização para cadastrar os dados destes clientes.</p>
            <div className={styles.formActions}><button type="button" className={styles.secondary} disabled={disabled} onClick={() => setMode(null)}>Cancelar</button><button type="button" className={styles.primary} disabled={disabled || preview.ready === 0} onClick={() => void confirm()}>{pending && <LoaderCircle size={16} className="spin" />} Inscrever {preview.ready} {preview.ready === 1 ? "importador válido" : "importadores válidos"}</button></div>
          </section>}
        </>}
      </>}
    </Dialog>}
  </>;
}
