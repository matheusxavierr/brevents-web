"use client";

import { ArrowLeft, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { apiClient } from "@/lib/api-client";
import type { EventData, Organization, Paginated, Room } from "@/lib/api-types";
import { Brand } from "./brand";

export function CreateEventForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [organizations, setOrganizations] = useState<Organization[]>([]);

  useEffect(() => {
    apiClient<Paginated<Organization>>("organizations/")
      .then((data) => setOrganizations(data.results))
      .catch((reason) => console.error("Não foi possível carregar as empresas.", reason));
  }, []);

  async function submit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault(); setLoading(true); setError("");
    const data = Object.fromEntries(new FormData(formEvent.currentTarget));
    try {
      const event = await apiClient<EventData>("events/", {
        method: "POST",
        body: {
          organization: data.organization || null,
          name: data.name,
          slug: slugify(String(data.slug || data.name)),
          description: data.description,
          starts_at: new Date(String(data.starts_at)).toISOString(),
          ends_at: new Date(String(data.ends_at)).toISOString(),
          timezone: "America/Sao_Paulo",
          access_mode: data.access_mode,
          public_config: { subtitle: data.subtitle, location: "Online" },
          branding: { primary_color: "#135BCA", accent_color: "#24824F" },
          feature_flags: { chat: true, questions: true, polls: true, recordings: true },
        },
      });
      await apiClient<Room>("rooms/", {
        method: "POST",
        body: {
          event: event.id, name: "Auditório principal", description: "Sala principal do evento", mode: "event", position: 0,
          module_config: [
            { type: "call.zoom", config: { session_name: `brevents-${event.id}`, passcode: "" } },
            { type: "chat.native", config: { volatile: false } },
            { type: "question", config: { active: true, requires_moderation: true } },
            { type: "poll", config: { active: true } },
          ],
        },
      });
      await apiClient(`events/${event.id}/publish/`, { method: "POST" });
      router.push(`/painel?event=${event.id}`); router.refresh();
    } catch (reason) {
      console.error("Não foi possível criar o evento.", reason);
      setError(reason instanceof Error ? reason.message : "Não foi possível criar o evento."); setLoading(false);
    }
  }

  return <main className="event-builder"><header className="builder-header"><Brand href="/painel" /><Link className="button button-secondary" href="/painel"><ArrowLeft size={16} /> Voltar ao painel</Link></header><div className="builder-layout"><aside><p className="eyebrow">Novo evento</p><h1>Comece pelo essencial.</h1><p>Ao continuar, criaremos a página pública e uma sala Zoom principal pronta para testes.</p><ol><li className="active">Informações gerais</li><li>Sala Zoom automática</li><li>Publicação automática</li></ol></aside><section><form className="builder-form" onSubmit={submit}><div><p className="eyebrow">Configuração inicial</p><h2>Informações do evento</h2><p className="muted">O evento será publicado ao final e poderá ser editado a qualquer momento.</p></div><div className="form-grid">
    {organizations.length > 0 && <label className="field field-wide"><span>Publicar no hub da empresa</span><select name="organization" defaultValue={organizations[0]?.id}><option value="">Evento independente</option>{organizations.map((organization) => <option value={organization.id} key={organization.id}>{organization.name}</option>)}</select></label>}
    <label className="field field-wide"><span>Nome do evento</span><input name="name" placeholder="Ex.: Future Summit 2026" required /></label><label className="field field-wide"><span>Frase principal</span><input name="subtitle" placeholder="Ideias ao vivo. Conexões reais." required /></label><label className="field field-wide"><span>Descrição</span><textarea name="description" required /></label><label className="field"><span>Início</span><input name="starts_at" type="datetime-local" required /></label><label className="field"><span>Término</span><input name="ends_at" type="datetime-local" required /></label><label className="field"><span>Slug personalizado (opcional)</span><input name="slug" placeholder="future-summit-2026" /></label><label className="field"><span>Acesso</span><select name="access_mode" defaultValue="registration"><option value="registration">Inscrição obrigatória</option><option value="public">Público</option><option value="invite">Somente convidados</option></select></label></div>{!organizations.length && <p className="builder-tip">Você poderá criar o hub da empresa pelo menu principal da BR Events.</p>}{error && <p className="form-error" role="alert">{error}</p>}<button className="button button-primary" type="submit" disabled={loading}>{loading && <LoaderCircle className="spin" size={18} />}Criar, configurar e publicar</button></form></section></div></main>;
}

function slugify(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
