"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Building2, ChevronLeft, ChevronRight, Plus, Search, Trash2 } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import type { EventData, Registration, Room } from "@/lib/api-types";
import { companyIdentity } from "@/lib/company-rooms";
import { Dialog, Empty, type DashboardAction } from "./shared";
import styles from "./dashboard.module.css";

export function CompanyRoomsPanel({ event, registrations, rooms, action, busy }: { event: EventData; registrations: Registration[]; rooms: Room[]; action: DashboardAction; busy: boolean }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState("");
  const [removing, setRemoving] = useState<Room | null>(null);
  const confirmed = registrations.filter((person) => person.status === "confirmed" && typeof person.profile?.company === "string" && person.profile.company.trim());
  const companies = [...new Map(confirmed.map((person) => [companyIdentity(person.profile.company), person.profile.company.trim()])).entries()].sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));
  const companyRooms = rooms.filter((room) => room.purpose === "networking" && room.visibility === "public" && room.company_name);
  const filtered = companies.filter(([, name]) => companyIdentity(name).includes(companyIdentity(search)));
  const pages = Math.max(1, Math.ceil(filtered.length / 8));
  const safePage = Math.min(page, pages - 1);
  const representatives = confirmed.filter((person) => companyIdentity(person.profile.company) === selected);
  const existing = companyRooms.find((room) => companyIdentity(room.company_name || "") === selected);
  const ended = event.status === "ended" || event.status === "archived";

  async function save(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    const data = new FormData(formEvent.currentTarget);
    if (await action(() => apiClient("rooms/networking/", { method: "POST", body: {
      event: event.id, host_registration: data.get("registration"), location: data.get("location"), topic: data.get("topic"),
    } }), existing ? "Sala da empresa atualizada." : "Sala preparada. A empresa já poderá encontrá-la no matchmaking.")) setEditing(false);
  }

  return <section className={styles.card}><div className={styles.cardHeading}><div><h2>Salas das empresas</h2><p>Prepare as salas usando as empresas e os representantes das inscrições confirmadas.</p></div><Building2 size={22} /></div>
    <div className={styles.toolbar}><label className={styles.search}><Search size={16} /><input type="search" placeholder="Buscar empresa inscrita" aria-label="Buscar empresa inscrita" value={search} onChange={(change) => { setSearch(change.target.value); setPage(0); }} /></label><button className={styles.primary} disabled={busy || ended || !companies.length} onClick={() => { setSelected(companies[0]?.[0] || ""); setEditing(true); }}><Plus size={16} /> Preparar sala</button></div>
    <p className={styles.hint}>Uma sala por empresa. As pessoas inscritas com o mesmo nome de empresa verão a sala como sua. Outros inscritos poderão visitá-la. Você pode preparar tudo com as rodadas fechadas.</p>
    {filtered.length ? <div className={styles.tableWrap}><table className={`${styles.table} ${styles.companyTable}`}><thead><tr><th>Empresa</th><th>Representantes inscritos</th><th>Sala</th><th>Ações</th></tr></thead><tbody>{filtered.slice(safePage * 8, safePage * 8 + 8).map(([key, name]) => {
      const people = confirmed.filter((person) => companyIdentity(person.profile.company) === key);
      const room = companyRooms.find((item) => companyIdentity(item.company_name || "") === key);
      return <tr key={key}><td><strong>{name}</strong></td><td>{people.map((person) => person.name).join(", ")}</td><td><span className={styles.badge}>{room ? "Pronta" : "Não preparada"}</span></td><td><div className={styles.rowActions}><button className={styles.secondary} disabled={busy || ended} onClick={() => { setSelected(key); setEditing(true); }}>{room ? "Editar sala" : "Preparar sala"}</button>{room && <><Link className={styles.secondary} href={`/eventos/${event.slug}/networking/salas/${room.id}`}>Abrir sala</Link><button className={styles.danger} disabled={busy} aria-label={`Excluir sala de ${name}`} onClick={() => setRemoving(room)}><Trash2 size={15} /></button></>}</div></td></tr>;
    })}</tbody></table></div> : <Empty>Nenhuma empresa encontrada nas inscrições confirmadas.</Empty>}
    <div className={styles.pagination}><span>{filtered.length} empresas · 8 por página</span><button aria-label="Empresas anteriores" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}><ChevronLeft size={16} /></button><span>{safePage + 1} / {pages}</span><button aria-label="Próximas empresas" disabled={safePage >= pages - 1} onClick={() => setPage(safePage + 1)}><ChevronRight size={16} /></button></div>
    {editing && <Dialog title={existing ? "Editar sala da empresa" : "Preparar sala da empresa"} onClose={() => setEditing(false)} busy={busy}><form className={styles.form} onSubmit={save}><label className={styles.field}>Empresa inscrita<select value={selected} onChange={(change) => setSelected(change.target.value)} required>{companies.map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label><div key={selected} className={styles.form}><label className={styles.field}>Representante de contato<select name="registration" defaultValue={existing?.host_registration || representatives[0]?.id} required>{representatives.map((person) => <option key={person.id} value={person.id}>{person.name} · {person.email}</option>)}</select></label><label className={styles.field}>Localização<input name="location" defaultValue={existing?.location || ""} maxLength={120} placeholder="Cidade ou região (opcional)" /></label><label className={styles.field}>Sobre a empresa / assunto<textarea name="topic" defaultValue={existing?.description || ""} maxLength={2000} placeholder="O que a empresa deseja apresentar?" /></label></div><div className={styles.formActions}><button type="button" className={styles.secondary} disabled={busy} onClick={() => setEditing(false)}>Cancelar</button><button className={styles.primary} disabled={busy || !representatives.length}>{busy ? "Salvando…" : "Salvar sala"}</button></div></form></Dialog>}
    {removing && <Dialog title="Excluir sala da empresa?" onClose={() => setRemoving(null)} busy={busy}><p>A sala de {removing.company_name} será excluída, incluindo o chat e a transcrição. Evite excluir uma sala durante uma conversa.</p><div className={styles.formActions}><button className={styles.secondary} disabled={busy} onClick={() => setRemoving(null)}>Cancelar</button><button className={styles.danger} disabled={busy} onClick={async () => { if (await action(() => apiClient(`rooms/${removing.id}/`, { method: "DELETE" }), "Sala excluída.")) setRemoving(null); }}>Excluir sala</button></div></Dialog>}
  </section>;
}
