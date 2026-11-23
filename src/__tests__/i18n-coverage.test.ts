import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { hasTranslation } from "@/lib/i18n";
import { accessLabels, emptyEventDraft, validateEventStep } from "@/lib/event-builder";
import { PRODUCT_PREVIEWS } from "@/lib/product-previews";
import { SHOWCASE_TYPE_LABELS } from "@/lib/company-showcase";
import { sessions } from "@/lib/demo-data";

const files: string[] = [];
function walk(dir: string) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) { if (!path.startsWith("src/lib/i18n") && !path.startsWith("src/__tests__")) walk(path); }
    else if (/\.(ts|tsx)$/.test(entry.name)) files.push(path);
  }
}
walk("src");
const sameInBoth = new Set(["Admin", "Web Events", "Meetings", "Matchmaking", "Chat", "OFF", "Instagram", "LinkedIn", "YouTube", "BR Events"]);
const keys = new Set<string>();
for (const file of files) {
  const source = readFileSync(file, "utf8");
  for (const match of source.matchAll(/\bt\(\s*"((?:[^"\\]|\\.)*)"/g)) keys.add(match[1].replace(/\\"/g, '"'));
}

const dynamicKeys = [
  ...Object.values(accessLabels),
  ...[
    validateEventStep(0, emptyEventDraft),
    validateEventStep(1, { ...emptyEventDraft, starts_at: "2026-01-02T10:00", ends_at: "2026-01-01T10:00" }),
    validateEventStep(1, { ...emptyEventDraft, starts_at: "invalid", ends_at: "invalid" }),
  ].filter((item): item is string => Boolean(item)),
  ...Object.values(PRODUCT_PREVIEWS).flatMap((item) => [item.title, item.label, item.description, item.alt, ...item.features]),
  ...Object.values(SHOWCASE_TYPE_LABELS),
  ...sessions.map((item) => item.track),
  "Todas", "Produto e inovação", "Comunidade", "Estratégia", "Design",
  "Apresentação", "Nome e descrição", "Apresente seu evento.", "Essas informações aparecem na página pública.",
  "Data e acesso", "Horários e inscrições", "Quando e como participar?", "Defina os horários, as regras de entrada e o endereço.",
  "Palestrantes", "Opcional · pode adicionar depois", "Quem vai apresentar?", "Cadastre os palestrantes agora ou deixe para o painel.",
  "Revisão", "Confira antes de publicar", "Revise seu evento.", "Confira os dados. O auditório será criado automaticamente.",
  "Visão geral", "Programação", "Auditório e rodadas", "Salas e matchmaking", "Participantes", "Coordenadores", "Interações", "Resultados", "Configurações",
  "Prepare e acompanhe seu evento em um só lugar.", "Organize as palestras, os horários e quem vai apresentar.",
  "O palco principal e as conversas de negócios deste evento.", "Inscrições, informações profissionais e controle de acesso.",
  "Crie enquetes e organize as perguntas do público.", "Audiência, participação e conexões geradas pelo evento.",
  "Informações públicas, inscrições e disponibilidade do evento.", "Compartilhe a gestão deste evento com sua equipe.",
  "Direcione importadores, acompanhe as empresas e gerencie cada conversa 1:1.",
  "Pessoas no networking", "Salas das empresas", "Convites recebidos", "Convites enviados", "Sua conversa 1:1",
  "Rascunho", "Publicada", "Cancelada", "Aberta", "Encerrada", "Arquivada", "Aguardando revisão", "Aprovada",
  "Pronto", "Já inscrito", "Repetido", "Corrigir", "Confirmada", "Pendente", "Bloqueada",
  "Aguardando", "Aceita", "Recusada", "Encerrada", "Inscrições", "Visitas", "Mensagens", "Rodadas realizadas",
  "Confirmadas", "Pendentes", "Canceladas", "Bloqueadas", "Encerrar conversa", "Você", "agora",
  "Bom dia! Muito feliz de estar aqui com vocês.", "A qualidade da transmissão está ótima por aqui 👏", "Esse ponto sobre comunidade faz muito sentido.",
];

describe("i18n coverage", () => {
  it("has EN and ES entries for literal t() keys", () => {
    const missing: string[] = [];
    for (const key of [...keys, ...dynamicKeys]) {
      if (sameInBoth.has(key) || !/[A-Za-zÀ-ú]/.test(key)) continue;
      for (const locale of ["en", "es"] as const) {
        if (!hasTranslation(locale, key)) missing.push(`${locale}: ${key}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
