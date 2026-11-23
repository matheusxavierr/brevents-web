"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Plus, ShieldCheck, Trash2 } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import type { EventCoordinator, EventData } from "@/lib/api-types";
import { useI18n } from "../i18n-provider";
import { Dialog, Empty, type DashboardAction } from "./shared";
import styles from "./dashboard.module.css";

export function CoordinatorsPanel({ event, action, busy }: { event: EventData; action: DashboardAction; busy: boolean }) {
  const { t } = useI18n();
  const [members, setMembers] = useState<EventCoordinator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [removing, setRemoving] = useState<EventCoordinator | null>(null);
  const path = `events/${event.id}/coordinators/`;

  useEffect(() => {
    let active = true;
    apiClient<EventCoordinator[]>(path).then((items) => { if (active) setMembers(items); })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : t("Não foi possível carregar os coordenadores.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [path, t]);

  async function add(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    if (await action(async () => {
      const items = await apiClient<EventCoordinator[]>(path, { method: "POST", body: { email: email.trim() } });
      setMembers(items);
    }, t("Coordenador adicionado ao evento."))) setEmail("");
  }

  return <div className={styles.twoColumns}>
    <section className={styles.card}><div className={styles.cardHeading}><div><h2>{t("Equipe do evento")}</h2><p>{t("Organizador e coordenadores têm acesso completo à gestão deste evento.")}</p></div><ShieldCheck size={24} /></div>
      {event.owner && <div className={styles.listRow}><div><strong>{[event.owner.first_name, event.owner.last_name].filter(Boolean).join(" ") || event.owner.username}</strong><p>{event.owner.email}</p></div><span className={styles.badge}>{t("Organizador responsável")}</span></div>}
      {error && <p role="alert">{error}</p>}
      {loading ? <Empty>{t("Carregando equipe…")}</Empty> : members.length ? members.map((member) => <div className={styles.listRow} key={member.id}><div><strong>{[member.first_name, member.last_name].filter(Boolean).join(" ") || member.username}</strong><p>{member.email}</p></div><div className={styles.rowActions}><span className={styles.badge}>{t("Coordenador")}</span><button className={styles.danger} disabled={busy} aria-label={t("Remover {email}", { email: member.email })} onClick={() => setRemoving(member)}><Trash2 size={15} /> {t("Remover")}</button></div></div>) : <Empty>{t("Nenhum coordenador adicionado ainda.")}</Empty>}
    </section>
    <section className={styles.card}><h2>{t("Adicionar coordenador")}</h2><p>{t("Informe o e-mail de uma pessoa que já possui conta no BR Events. Ela verá este evento no próprio painel.")}</p><form className={styles.form} onSubmit={add}><label className={styles.field}>{t("E-mail da conta")}<input type="email" value={email} onChange={(change) => setEmail(change.target.value)} required placeholder={t("pessoa@empresa.com")} maxLength={254} /></label><div className={styles.formActions}><button className={styles.primary} disabled={busy || loading}><Plus size={16} /> {t("Adicionar coordenador")}</button></div></form><p className={styles.hint}>{t("O acesso inclui programação, participantes, moderação, configurações e salas de matchmaking. A permissão vale somente para este evento.")}</p></section>
    {removing && <Dialog title={t("Remover coordenador?")} onClose={() => setRemoving(null)} busy={busy}><p>{t("{email} perderá o acesso de coordenador a este evento. A conta da pessoa será mantida.", { email: removing.email })}</p><div className={styles.formActions}><button className={styles.secondary} onClick={() => setRemoving(null)} disabled={busy}>{t("Cancelar")}</button><button className={styles.danger} disabled={busy} onClick={async () => {
      if (await action(async () => setMembers(await apiClient<EventCoordinator[]>(path, { method: "DELETE", body: { email: removing.email } })), t("Coordenador removido."))) setRemoving(null);
    }}>{t("Remover coordenador")}</button></div></Dialog>}
  </div>;
}
