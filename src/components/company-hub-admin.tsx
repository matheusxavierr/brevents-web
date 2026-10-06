"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Building2, ExternalLink, ImageIcon, LoaderCircle, Plus, Save, Share2 } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import type { Organization, Paginated } from "@/lib/api-types";

const EMPTY_BRANDING = { primary_color: "#A65C45", accent_color: "#7A8C74" };

export function CompanyHubAdmin() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [activeId, setActiveId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const active = useMemo(
    () => organizations.find((organization) => organization.id === activeId) ?? null,
    [activeId, organizations],
  );

  useEffect(() => {
    let activeRequest = true;

    apiClient<Paginated<Organization>>("organizations/")
      .then((data) => {
        if (!activeRequest) return;
        setOrganizations(data.results);
        setActiveId(data.results[0]?.id || "");
      })
      .catch((reason: unknown) => {
        if (!activeRequest) return;
        setError(reason instanceof Error ? reason.message : "Não foi possível carregar o hub.");
      })
      .finally(() => {
        if (activeRequest) setLoading(false);
      });

    return () => { activeRequest = false; };
  }, []);

  async function createHub(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    const form = formEvent.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    setSaving(true); setError("");
    try {
      const organization = await apiClient<Organization>("organizations/", {
        method: "POST",
        body: {
          name: String(data.name),
          slug: slugify(String(data.name)),
          headline: String(data.headline || ""),
          description: String(data.description || ""),
          branding: EMPTY_BRANDING,
          social_links: {},
        },
      });
      setOrganizations((current) => [...current, organization]);
      setActiveId(organization.id);
      form.reset();
      setNotice("Hub criado. Agora personalize a página da empresa.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível criar o hub.");
    } finally { setSaving(false); }
  }

  async function saveHub(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    if (!active) return;
    const data = Object.fromEntries(new FormData(formEvent.currentTarget));
    setSaving(true); setError("");
    try {
      const updated = await apiClient<Organization>(`organizations/${active.id}/`, {
        method: "PATCH",
        body: {
          name: data.name,
          slug: data.slug,
          headline: data.headline,
          description: data.description,
          logo_url: data.logo_url,
          cover_image_url: data.cover_image_url,
          contact_email: data.contact_email,
          contact_phone: data.contact_phone,
          website_url: data.website_url,
          social_links: {
            instagram: data.instagram,
            linkedin: data.linkedin,
            youtube: data.youtube,
          },
          branding: {
            primary_color: data.primary_color,
            accent_color: data.accent_color,
          },
        },
      });
      setOrganizations((current) => current.map((item) => item.id === updated.id ? updated : item));
      setNotice("Página da empresa atualizada.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível salvar o hub.");
    } finally { setSaving(false); }
  }

  if (loading) return <section className="dashboard-card hub-loading"><LoaderCircle className="spin" /><span>Carregando o hub da empresa…</span></section>;

  return <div className="company-hub-admin">
    <header className="hub-admin-heading">
      <div><p className="eyebrow"><Building2 size={14} /> Hub das empresas</p><h2>Sua empresa dentro do BR Events.</h2><p>Uma página permanente, com estrutura padrão e a identidade da sua marca.</p></div>
      {organizations.length > 0 && <label className="event-switcher"><span className="sr-only">Empresa atual</span><select value={activeId} onChange={(event) => setActiveId(event.target.value)}>{organizations.map((organization) => <option value={organization.id} key={organization.id}>{organization.name}</option>)}</select></label>}
    </header>
    {error && <p className="form-error" role="alert">{error}</p>}{notice && <p className="form-success">{notice}</p>}
    {!active ? <section className="dashboard-card hub-first-step"><Building2 size={32} /><div><h3>Crie a página da sua empresa</h3><p>Você poderá alterar imagens, texto, contatos, redes sociais e cores.</p><small className="required-note">* Campo obrigatório</small></div><form className="compact-form" onSubmit={createHub}><label className="field"><span>Nome da empresa <b aria-hidden="true">*</b></span><input name="name" placeholder="Ex.: Minha Empresa" required aria-required="true" /></label><label className="field"><span>Frase principal <small>Opcional</small></span><input name="headline" placeholder="Uma frase sobre a empresa" /></label><label className="field"><span>História da empresa <small>Opcional</small></span><textarea name="description" placeholder="Conte brevemente a história da empresa" /></label><button className="button button-primary" disabled={saving}><Plus size={16} /> Criar hub</button></form></section> : <div className="hub-editor-grid">
      <form className="dashboard-card compact-form hub-editor-form" onSubmit={saveHub} key={active.id}>
        <div className="card-header"><div><p className="eyebrow">Personalização</p><h2>Conteúdo da página</h2></div><Link className="button button-secondary" href={`/empresas/${active.slug}`} target="_blank">Ver página <ExternalLink size={15} /></Link></div>
        <p className="required-note">* Campos obrigatórios</p><div className="form-grid"><label className="field"><span>Nome <b aria-hidden="true">*</b></span><input name="name" defaultValue={active.name} required aria-required="true" /></label><label className="field"><span>Endereço da página <b aria-hidden="true">*</b></span><input name="slug" defaultValue={active.slug} required aria-required="true" /></label></div>
        <label className="field"><span>Frase principal</span><input name="headline" defaultValue={active.headline} placeholder="Uma ideia forte sobre a empresa" /></label>
        <label className="field"><span>Apresentação</span><textarea name="description" defaultValue={active.description} rows={5} /></label>
        <div className="form-grid"><label className="field"><span><ImageIcon size={14} /> Logo (URL)</span><input name="logo_url" type="url" defaultValue={active.logo_url} /></label><label className="field"><span><ImageIcon size={14} /> Imagem de capa (URL)</span><input name="cover_image_url" type="url" defaultValue={active.cover_image_url} /></label></div>
        <div className="form-grid"><label className="field"><span>E-mail</span><input name="contact_email" type="email" defaultValue={active.contact_email} /></label><label className="field"><span>Telefone</span><input name="contact_phone" defaultValue={active.contact_phone} /></label></div>
        <label className="field"><span>Site</span><input name="website_url" type="url" defaultValue={active.website_url} /></label>
        <div className="form-grid"><label className="field"><span><Share2 size={14} /> Instagram</span><input name="instagram" type="url" defaultValue={active.social_links?.instagram} /></label><label className="field"><span>LinkedIn</span><input name="linkedin" type="url" defaultValue={active.social_links?.linkedin} /></label><label className="field"><span>YouTube</span><input name="youtube" type="url" defaultValue={active.social_links?.youtube} /></label></div>
        <div className="form-grid hub-color-fields"><label className="field"><span>Cor principal</span><input name="primary_color" type="color" defaultValue={active.branding?.primary_color || EMPTY_BRANDING.primary_color} /></label><label className="field"><span>Cor de apoio</span><input name="accent_color" type="color" defaultValue={active.branding?.accent_color || EMPTY_BRANDING.accent_color} /></label></div>
        <button className="button button-primary" disabled={saving}>{saving ? <LoaderCircle className="spin" size={16} /> : <Save size={16} />} Salvar personalização</button>
      </form>
      <HubPreview organization={active} />
    </div>}
  </div>;
}

function HubPreview({ organization }: { organization: Organization }) {
  const primary = organization.branding?.primary_color || EMPTY_BRANDING.primary_color;
  return <aside className="dashboard-card hub-live-preview" style={{ "--hub-primary": primary } as React.CSSProperties}><span className="eyebrow">Prévia da estrutura</span><div className="hub-preview-cover" style={organization.cover_image_url ? { backgroundImage: `url(${organization.cover_image_url})` } : undefined}>{organization.logo_url ? <Image src={organization.logo_url} alt="" width={70} height={70} unoptimized /> : <span>{organization.name.slice(0, 2).toUpperCase()}</span>}</div><h2>{organization.headline || organization.name}</h2><p>{organization.description || "A apresentação da empresa aparecerá aqui."}</p><div className="hub-preview-meta"><span>Sobre</span><span>Eventos</span><span>Contato</span></div></aside>;
}

function slugify(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
