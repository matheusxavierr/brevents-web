export type EventDraft = {
  name: string; subtitle: string; description: string; starts_at: string; ends_at: string;
  slug: string; access_mode: "registration" | "public" | "invite"; organization: string;
};
export type SpeakerDraft = { id: string; name: string; email: string; bio: string };

export const emptyEventDraft: EventDraft = {
  name: "", subtitle: "", description: "", starts_at: "", ends_at: "", slug: "", access_mode: "registration", organization: "",
};
export const accessLabels = { registration: "Inscrição obrigatória", public: "Público", invite: "Somente convidados" };

export function eventSlug(draft: EventDraft) {
  return (draft.slug || draft.name).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function validateEventStep(step: number, draft: EventDraft): string | null {
  if (step === 0 && (!draft.name.trim() || !draft.subtitle.trim() || !draft.description.trim())) return "Preencha o nome, a frase principal e a descrição do evento.";
  if (step === 1) {
    const start = new Date(draft.starts_at).getTime(), end = new Date(draft.ends_at).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end)) return "Informe as datas e os horários de início e término.";
    if (end <= start) return "O término precisa ser posterior ao início do evento.";
    if (!eventSlug(draft)) return "Informe um endereço para o evento usando letras ou números.";
  }
  return null;
}

export function eventCreatePayload(draft: EventDraft, speakers: SpeakerDraft[]) {
  return {
    organization: draft.organization || null, name: draft.name.trim(), slug: eventSlug(draft), description: draft.description.trim(),
    starts_at: new Date(draft.starts_at).toISOString(), ends_at: new Date(draft.ends_at).toISOString(), timezone: "America/Sao_Paulo",
    access_mode: draft.access_mode, public_config: { subtitle: draft.subtitle.trim(), location: "Online" },
    branding: { primary_color: "#135BCA", accent_color: "#24824F" },
    feature_flags: { chat: true, questions: true, polls: true, recordings: false, networking_open: false },
    initial_speakers: speakers.map(({ name, email, bio }) => ({ name: name.trim(), email: email.trim(), bio: bio.trim() })),
  };
}
