"use client";

import { ArrowLeft, ArrowRight, CalendarDays, Check, ChevronLeft, ChevronRight, ClipboardCheck, Info, LoaderCircle, Pencil, Plus, Radio, ShieldCheck, Trash2, UserRound, UsersRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { apiClient } from "@/lib/api-client";
import { listAll } from "@/lib/api-pagination";
import type { EventData, Organization } from "@/lib/api-types";
import { ensureEventAuditorium } from "@/lib/event-room";
import { accessLabels, emptyEventDraft, eventCreatePayload, eventSlug, validateEventStep, type EventDraft, type SpeakerDraft } from "@/lib/event-builder";
import { formatDateValue, type Locale } from "@/lib/i18n";
import { Brand } from "./brand";
import { LanguageSwitcher } from "./language-switcher";
import { Dialog } from "./event-dashboard/shared";
import { useI18n } from "./i18n-provider";
import styles from "./create-event-form.module.css";

const steps = [
  { title: "Apresentação", detail: "Nome e descrição", heading: "Apresente seu evento.", description: "Essas informações aparecem na página pública.", icon: Info },
  { title: "Data e acesso", detail: "Horários e inscrições", heading: "Quando e como participar?", description: "Defina os horários, as regras de entrada e o endereço.", icon: CalendarDays },
  { title: "Palestrantes", detail: "Opcional · pode adicionar depois", heading: "Quem vai apresentar?", description: "Cadastre os palestrantes agora ou deixe para o painel.", icon: UsersRound },
  { title: "Revisão", detail: "Confira antes de publicar", heading: "Revise seu evento.", description: "Confira os dados. O auditório será criado automaticamente.", icon: ClipboardCheck },
];

export function CreateEventForm() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<EventDraft>({ ...emptyEventDraft });
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationError, setOrganizationError] = useState(false);
  const [speakers, setSpeakers] = useState<SpeakerDraft[]>([]);
  const [speakerEditor, setSpeakerEditor] = useState<SpeakerDraft | null>(null);
  const [speakerPage, setSpeakerPage] = useState(0);
  const [speakerPageSize, setSpeakerPageSize] = useState(4);
  const [loading, setLoading] = useState(false);
  const [savedEventId, setSavedEventId] = useState<string | null>(null);
  const draftSaved = savedEventId !== null;
  const [operation, setOperation] = useState("");
  const [error, setError] = useState("");
  const stepHeading = useRef<HTMLHeadingElement>(null);
  const organizationEdited = useRef(false);
  const saving = useRef(false);
  const resources = useRef<{ event: EventData | null; roomCreated: boolean }>({ event: null, roomCreated: false });

  useEffect(() => {
    let cancelled = false;
    listAll<Organization>("organizations/").then((items) => {
      if (cancelled) return;
      const eligible = items.filter((item) => item.can_manage !== false);
      setOrganizations(eligible);
      if (!organizationEdited.current) setDraft((previous) => ({ ...previous, organization: eligible[0]?.id ?? "" }));
    }).catch(() => { if (!cancelled) setOrganizationError(true); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const update = () => setSpeakerPageSize(window.innerHeight < 740 ? 2 : window.innerWidth <= 767 || window.innerHeight < 820 ? 3 : 4);
    const frame = window.requestAnimationFrame(update);
    window.addEventListener("resize", update);
    return () => { window.cancelAnimationFrame(frame); window.removeEventListener("resize", update); };
  }, []);

  useEffect(() => { stepHeading.current?.focus({ preventScroll: true }); }, [step]);

  function update<K extends keyof EventDraft>(key: K, value: EventDraft[K]) {
    if (key === "organization") organizationEdited.current = true;
    setDraft((previous) => ({ ...previous, [key]: value })); setError("");
  }

  function goTo(target: number) {
    if (loading || draftSaved) return;
    setError(""); setStep(target);
  }

  async function retryOrganizations() {
    try {
      const items = await listAll<Organization>("organizations/");
      setOrganizations(items.filter((item) => item.can_manage !== false)); setOrganizationError(false);
    } catch { setOrganizationError(true); }
  }

  async function publishEvent() {
    if (saving.current) return;
    for (let index = 0; index < 2; index += 1) {
      const issue = validateEventStep(index, draft);
      if (issue) { setStep(index); setError(t(issue)); return; }
    }
    saving.current = true; setLoading(true); setError("");
    try {
      let event = resources.current.event;
      if (!event) {
        setOperation(t("Salvando informações do evento…"));
        event = await apiClient<EventData>("events/", { method: "POST", body: eventCreatePayload(draft, speakers) });
        resources.current.event = event; setSavedEventId(event.id);
      }
      if (!resources.current.roomCreated) {
        setOperation(t("Preparando o auditório principal…"));
        await ensureEventAuditorium(event.id);
        resources.current.roomCreated = true;
      }
      setOperation(t("Publicando a página do evento…"));
      await apiClient(`events/${event.id}/publish/`, { method: "POST" });
      router.push(`/painel?event=${event.id}`); router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("Não foi possível concluir a criação do evento."));
      setLoading(false); setOperation("");
    } finally { saving.current = false; }
  }

  function advance(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    if (loading) return;
    if (step === 3) { void publishEvent(); return; }
    const issue = validateEventStep(step, draft);
    if (issue) { setError(t(issue)); return; }
    setError(""); setStep((current) => current + 1);
  }

  function saveSpeaker(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    if (!speakerEditor?.name.trim()) return;
    const values = { ...speakerEditor, name: speakerEditor.name.trim(), email: speakerEditor.email.trim(), bio: speakerEditor.bio.trim() };
    if (!speakers.some((item) => item.id === values.id)) setSpeakerPage(Math.floor(speakers.length / speakerPageSize));
    setSpeakers((items) => items.some((item) => item.id === values.id) ? items.map((item) => item.id === values.id ? values : item) : [...items, values]);
    setSpeakerEditor(null);
  }

  const speakerPages = Math.max(1, Math.ceil(speakers.length / speakerPageSize));
  const safeSpeakerPage = Math.min(speakerPage, speakerPages - 1);
  const StepIcon = steps[step].icon;
  const selectedOrganization = organizations.find((item) => item.id === draft.organization);

  return <main className={styles.page}>
    <header className={styles.header}><Brand href="/painel" /><div className="builder-header-actions"><LanguageSwitcher className="builder-language" /><Link className={styles.back} href="/painel"><ArrowLeft size={15} /> {t("Voltar ao painel")}</Link></div></header>
    <div className={styles.layout}>
      <aside className={styles.aside}><div><small>{t("NOVO WEB EVENT")}</small><h1>{t("Comece pelo essencial.")}</h1><p>{t("Um passo de cada vez para reunir ideias, pessoas e novas conexões.")}</p></div>
        <ol className={styles.asideSteps} aria-label={t("Etapas do cadastro")}>{steps.map((item, index) => <li key={item.title}><button type="button" disabled={index > step || loading || draftSaved} aria-current={index === step ? "step" : undefined} className={index === step ? styles.activeStep : index < step ? styles.completeStep : ""} onClick={() => goTo(index)}><span>{index < step ? <Check size={14} /> : index + 1}</span><div><strong>{t(item.title)}</strong><em>{t(item.detail)}</em></div></button></li>)}</ol>
        <div className={styles.asideNote}><Radio size={20} /><p>{t("Ao publicar, sua página e o auditório principal ficam prontos. As rodadas de negócios são liberadas pelo organizador no painel.")}</p></div>
      </aside>
      <section className={styles.panel} aria-label={t("Cadastro do evento")}><div className={styles.progressNav}><div aria-hidden="true">{steps.map((item, index) => <i key={item.title} className={index <= step ? styles.progressDone : ""} />)}</div><span role="status">{t("Etapa {current} de 4", { current: step + 1 })}</span></div>
        <form className={styles.form} aria-label={t("Criar evento")} onSubmit={advance}>
          <header className={styles.heading}><span><StepIcon size={15} />{t(steps[step].title)}</span><h2 ref={stepHeading} tabIndex={-1}>{t(steps[step].heading)}</h2><p>{t(steps[step].description)}</p></header>
          {error && <div className={styles.feedback} role="alert"><p>{error}</p>{savedEventId && <p>{t("Os dados já foram salvos como rascunho. Tente concluir novamente ou")} <Link href={`/painel?event=${savedEventId}`}>{t("abra o evento no painel")}</Link>.</p>}</div>}
          <div className={styles.body} role="region" aria-label={t("Etapa do cadastro")}>
            {step === 0 && <fieldset className={styles.fields} disabled={loading || draftSaved}><label className={styles.field}><span>{t("Nome do evento")} <b>*</b></span><input name="name" autoComplete="off" value={draft.name} onChange={(change) => update("name", change.target.value)} maxLength={200} placeholder={t("Ex.: Future Summit 2026")} required /></label><label className={styles.field}><span>{t("Frase principal")} <b>*</b></span><input name="subtitle" value={draft.subtitle} onChange={(change) => update("subtitle", change.target.value)} placeholder={t("Ideias ao vivo. Conexões reais.")} required /><small>{t("Uma chamada curta para a página do evento.")}</small></label><label className={styles.field}><span>{t("Descrição")} <b>*</b></span><textarea name="description" value={draft.description} onChange={(change) => update("description", change.target.value)} placeholder={t("Conte o que vai acontecer e por que participar.")} required /></label></fieldset>}
            {step === 1 && <fieldset className={styles.fields} disabled={loading || draftSaved}><div className={styles.row}><label className={styles.field}><span>{t("Início")} <b>*</b></span><input name="starts_at" type="datetime-local" value={draft.starts_at} onChange={(change) => update("starts_at", change.target.value)} required /></label><label className={styles.field}><span>{t("Término")} <b>*</b></span><input name="ends_at" type="datetime-local" value={draft.ends_at} onChange={(change) => update("ends_at", change.target.value)} required /></label></div><small className={styles.hint}>{t("Informe os horários no fuso do seu dispositivo. O evento será exibido em America/Sao_Paulo.")}</small><label className={styles.field}><span>{t("Quem pode acessar?")}</span><select name="access_mode" value={draft.access_mode} onChange={(change) => update("access_mode", change.target.value as EventDraft["access_mode"])}>{Object.entries(accessLabels).map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}</select></label><label className={styles.field}><span>{t("Endereço personalizado (opcional)")}</span><input name="slug" value={draft.slug} onChange={(change) => update("slug", change.target.value)} maxLength={120} placeholder={eventSlug(draft) || "nome-do-evento"} /><small>/eventos/{eventSlug(draft) || "nome-do-evento"}</small></label>{organizations.length > 0 && <label className={styles.field}><span>{t("Publicar no hub da empresa")}</span><select name="organization" value={draft.organization} onChange={(change) => update("organization", change.target.value)}><option value="">{t("Evento independente")}</option>{organizations.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>}{organizationError && <div className={styles.notice}><Info size={15} /><p>{t("Não foi possível carregar seus hubs. Você pode criar um evento independente ou")} <button type="button" onClick={() => void retryOrganizations()}>{t("tentar novamente")}</button>.</p></div>}</fieldset>}
            {step === 2 && <><div className={styles.speakerToolbar}><span>{t("{count} / 30 palestrantes", { count: speakers.length })}</span><button type="button" className={styles.secondary} disabled={speakers.length >= 30} onClick={() => setSpeakerEditor({ id: crypto.randomUUID(), name: "", email: "", bio: "" })}><Plus size={15} /> {t("Adicionar palestrante")}</button></div>{speakers.length ? <><div className={styles.speakerList}>{speakers.slice(safeSpeakerPage * speakerPageSize, (safeSpeakerPage + 1) * speakerPageSize).map((speaker) => <article className={styles.speakerRow} key={speaker.id}><span className={styles.avatar}>{speaker.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</span><div><strong title={speaker.name}>{speaker.name}</strong><small>{speaker.email || t("E-mail não informado")}</small></div><button className={styles.iconButton} type="button" aria-label={t("Editar {name}", { name: speaker.name })} onClick={() => setSpeakerEditor({ ...speaker })}><Pencil size={14} /></button><button className={styles.iconButton} type="button" aria-label={t("Remover {name}", { name: speaker.name })} onClick={() => setSpeakers((items) => items.filter((item) => item.id !== speaker.id))}><Trash2 size={14} /></button></article>)}</div><div className={styles.pagination}><button type="button" aria-label={t("Palestrantes anteriores")} disabled={safeSpeakerPage === 0} onClick={() => setSpeakerPage(safeSpeakerPage - 1)}><ChevronLeft size={15} /></button><span>{safeSpeakerPage + 1} / {speakerPages}</span><button type="button" aria-label={t("Próximos palestrantes")} disabled={safeSpeakerPage >= speakerPages - 1} onClick={() => setSpeakerPage(safeSpeakerPage + 1)}><ChevronRight size={15} /></button></div></> : <div className={styles.empty}><UserRound size={32} /><h3>{t("Você pode decidir isso depois.")}</h3><p>{t("Esta etapa é opcional. Os palestrantes e a programação também podem ser organizados no painel.")}</p></div>}</>}
            {step === 3 && <div className={styles.review}><section className={styles.reviewSection}><header><h3>{t("Apresentação")}</h3><button type="button" aria-label={t("Editar apresentação")} disabled={loading || draftSaved} onClick={() => goTo(0)}><Pencil size={12} /> {t("Editar")}</button></header><dl><div><dt>{t("Nome do evento")}</dt><dd title={draft.name}>{draft.name}</dd></div><div><dt>{t("Frase principal")}</dt><dd title={draft.subtitle}>{draft.subtitle}</dd></div></dl></section><section className={styles.reviewSection}><header><h3>{t("Data e acesso")}</h3><button type="button" aria-label={t("Editar data e acesso")} disabled={loading || draftSaved} onClick={() => goTo(1)}><Pencil size={12} /> {t("Editar")}</button></header><dl className={styles.reviewDates}><div><dt>{t("Início")}</dt><dd>{formatDate(draft.starts_at, locale)}</dd></div><div><dt>{t("Término")}</dt><dd>{formatDate(draft.ends_at, locale)}</dd></div><div><dt>{t("Acesso")}</dt><dd>{t(accessLabels[draft.access_mode])}</dd></div><div><dt>{t("Hub da empresa")}</dt><dd title={selectedOrganization?.name}>{selectedOrganization?.name || t("Evento independente")}</dd></div></dl><p className={styles.hint} style={{ margin: "10px 0 0" }}>/eventos/{eventSlug(draft)}</p></section><section className={styles.reviewSection}><header><h3>{t("Palestrantes")}</h3><button type="button" aria-label={t("Editar palestrantes")} disabled={loading || draftSaved} onClick={() => goTo(2)}><Pencil size={12} /> {t("Editar")}</button></header><dl><div><dd>{speakers.length ? speakers.length === 1 ? t("{count} palestrante cadastrado", { count: speakers.length }) : t("{count} palestrantes cadastrados", { count: speakers.length }) : t("Adicionar depois.")}</dd></div></dl></section><div className={styles.notice}><ShieldCheck size={17} /><p><span className={styles.noticeFull}>{t("O auditório Zoom e a página pública serão preparados automaticamente. As rodadas de negócios começam fechadas.")}</span><span className={styles.noticeCompact}>{t("Auditório automático. Rodadas de negócios fechadas.")}</span></p></div></div>}
          </div>
          <footer className={styles.footer}><span>{loading ? operation : step < 2 ? t("* Campos obrigatórios") : step === 2 ? t("Esta etapa é opcional.") : t("Você poderá editar o evento no painel.")}</span><div>{step > 0 && <button type="button" className={styles.secondary} disabled={loading || draftSaved} onClick={() => goTo(step - 1)}><ArrowLeft size={14} /> {t("Voltar")}</button>}<button type="submit" className={styles.primary} disabled={loading}>{loading && <LoaderCircle size={16} className="spin" />}{loading ? t("Publicando…") : step === 3 ? draftSaved ? t("Tentar concluir publicação") : t("Criar e publicar evento") : step === 2 && !speakers.length ? t("Continuar sem palestrantes") : t("Continuar")}{!loading && <ArrowRight size={15} />}</button></div></footer>
        </form>
      </section>
    </div>
    {speakerEditor && <Dialog title={speakers.some((item) => item.id === speakerEditor.id) ? t("Editar palestrante") : t("Adicionar palestrante")} onClose={() => setSpeakerEditor(null)}><form className={styles.modalForm} onSubmit={saveSpeaker}><label className={styles.field}><span>{t("Nome do palestrante")} <b>*</b></span><input value={speakerEditor.name} onChange={(change) => setSpeakerEditor((item) => item && ({ ...item, name: change.target.value }))} maxLength={200} required /></label><label className={styles.field}><span>{t("E-mail do palestrante")}</span><input type="email" value={speakerEditor.email} onChange={(change) => setSpeakerEditor((item) => item && ({ ...item, email: change.target.value }))} /></label><label className={styles.field}><span>{t("Apresentação")}</span><textarea value={speakerEditor.bio} onChange={(change) => setSpeakerEditor((item) => item && ({ ...item, bio: change.target.value }))} /></label><footer><button type="button" className={styles.secondary} onClick={() => setSpeakerEditor(null)}>{t("Cancelar")}</button><button className={styles.primary}>{t("Salvar palestrante")}</button></footer></form></Dialog>}
  </main>;
}

function formatDate(value: string, locale: Locale) {
  return formatDateValue(locale, value, { dateStyle: "short", timeStyle: "short" });
}
