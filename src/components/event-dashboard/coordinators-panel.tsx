"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Plus, ShieldCheck, Trash2 } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import type { EventCoordinator, EventData } from "@/lib/api-types";
import { Dialog, Empty, type DashboardAction } from "./shared";
import styles from "./dashboard.module.css";

export function CoordinatorsPanel({ event, action, busy }: { event: EventData; action: DashboardAction; busy: boolean }) {
  const [members, setMembers] = useState<EventCoordinator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [removing, setRemoving] = useState<EventCoordinator | null>(null);
  const path = `events/${event.id}/coordinators/`;

  useEffect(() => {
    let active = true;
    apiClient<EventCoordinator[]>(path).then((items) => { if (active) setMembers(items); })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Não foi possível carregar os coordenadores."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [path]);

  async function add(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    if (await action(async () => {
      const items = await apiClient<EventCoordinator[]>(path, { method: "POST", body: { email: email.trim() } });
      setMembers(items);
    }, "Coordenador adicionado ao evento.")) setEmail("");
  }

  return <div className={styles.twoColumns}>
    <section className={styles.card}><div className={styles.cardHeading}><div><h2>Equipe do evento</h2><p>Organizador e coordenadores têm acesso completo à gestão deste evento.</p></div><ShieldCheck size={24} /></div>
      {event.owner && <div className={styles.listRow}><div><strong>{[event.owner.first_name, event.owner.last_name].filter(Boolean).join(" ") || event.owner.username}</strong><p>{event.owner.email}</p></div><span className={styles.badge}>Organizador responsável</span></div>}
      {error && <p role="alert">{error}</p>}
      {loading ? <Empty>Carregando equipe…</Empty> : members.length ? members.map((member) => <div className={styles.listRow} key={member.id}><div><strong>{[member.first_name, member.last_name].filter(Boolean).join(" ") || member.username}</strong><p>{member.email}</p></div><div className={styles.rowActions}><span className={styles.badge}>Coordenador</span><button className={styles.danger} disabled={busy} aria-label={`Remover ${member.email}`} onClick={() => setRemoving(member)}><Trash2 size={15} /> Remover</button></div></div>) : <Empty>Nenhum coordenador adicionado ainda.</Empty>}
    </section>
    <section className={styles.card}><h2>Adicionar coordenador</h2><p>Informe o e-mail de uma pessoa que já possui conta no BR Events. Ela verá este evento no próprio painel.</p><form className={styles.form} onSubmit={add}><label className={styles.field}>E-mail da conta<input type="email" value={email} onChange={(change) => setEmail(change.target.value)} required placeholder="pessoa@empresa.com" maxLength={254} /></label><div className={styles.formActions}><button className={styles.primary} disabled={busy || loading}><Plus size={16} /> Adicionar coordenador</button></div></form><p className={styles.hint}>O acesso inclui programação, participantes, moderação, configurações e salas de matchmaking. A permissão vale somente para este evento.</p></section>
    {removing && <Dialog title="Remover coordenador?" onClose={() => setRemoving(null)} busy={busy}><p>{removing.email} perderá o acesso de coordenador a este evento. A conta da pessoa será mantida.</p><div className={styles.formActions}><button className={styles.secondary} onClick={() => setRemoving(null)} disabled={busy}>Cancelar</button><button className={styles.danger} disabled={busy} onClick={async () => {
      if (await action(async () => setMembers(await apiClient<EventCoordinator[]>(path, { method: "DELETE", body: { email: removing.email } })), "Coordenador removido.")) setRemoving(null);
    }}>Remover coordenador</button></div></Dialog>}
  </div>;
}
