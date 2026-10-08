"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CalendarRange, LogOut, Pencil, ShieldCheck, Trash2, Users, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Brand } from "./brand";
import { AdminEventPanel } from "./admin-event-panel";
import { useSession } from "./session-provider";
import { apiClient } from "@/lib/api-client";
import type { Paginated, User } from "@/lib/api-types";

type AdminUser = User & { is_active: boolean; date_joined: string };
type AdminEvent = {
  id: string; owner: number; name: string; slug: string; description: string;
  status: "draft" | "published" | "ended" | "archived";
  access_mode: "public" | "registration" | "invite";
  starts_at: string; ends_at: string;
};

export function AdminConsole() {
  const router = useRouter();
  const { user: sessionUser } = useSession();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [tab, setTab] = useState<"users" | "events">("users");
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [managedEventId, setManagedEventId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const managedEvent = events.find((item) => item.id === managedEventId) ?? null;

  const load = useCallback(async () => {
    if (!sessionUser) { router.push("/entrar?next=/admin"); return; }
    if (!sessionUser.is_superuser) { router.push("/"); return; }
    const [userData, eventData] = await Promise.all([
      apiClient<Paginated<AdminUser>>("admin/users/"),
      apiClient<Paginated<AdminEvent>>("admin/events/"),
    ]);
    setUsers(userData.results);
    setEvents(eventData.results);
  }, [router, sessionUser]);

  useEffect(() => {
    let active = true;
    async function bootstrap() {
      try { await load(); }
      catch (reason) { if (active) setError(reason instanceof Error ? reason.message : "Falha ao abrir o admin."); }
    }
    void bootstrap();
    return () => { active = false; };
  }, [load]);

  async function submitUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    const form = event.currentTarget;
    const data: Record<string, unknown> = Object.fromEntries(new FormData(form));
    data.is_active = data.is_active === "true";
    if (!data.password) delete data.password;
    try {
      if (editingUser) {
        await apiClient(`admin/users/${editingUser.id}/`, { method: "PATCH", body: data });
        setNotice("Usuário atualizado.");
      } else {
        await apiClient("admin/users/", { method: "POST", body: data });
        setNotice("Usuário criado.");
      }
      setEditingUser(null); form.reset(); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível salvar o usuário."); }
  }

  async function updateUser(user: AdminUser, changes: Partial<AdminUser>) {
    try {
      await apiClient(`admin/users/${user.id}/`, { method: "PATCH", body: changes });
      setNotice("Usuário atualizado."); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível atualizar o usuário."); }
  }

  async function deleteUser(user: AdminUser) {
    if (!window.confirm(`Excluir ${user.username}? Esta ação não pode ser desfeita.`)) return;
    try {
      await apiClient(`admin/users/${user.id}/`, { method: "DELETE" });
      setNotice("Usuário excluído."); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível excluir o usuário."); }
  }

  async function submitEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    const body = {
      ...data,
      starts_at: new Date(String(data.starts_at)).toISOString(),
      ends_at: new Date(String(data.ends_at)).toISOString(),
      managers: [],
      timezone: "America/Sao_Paulo",
      registration_open: true,
      public_config: {},
      branding: {},
      feature_flags: {},
    };
    try {
      await apiClient("admin/events/", { method: "POST", body });
      setNotice("Evento criado.");
      form.reset(); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível salvar o evento."); }
  }

  async function deleteEvent(item: AdminEvent) {
    if (!window.confirm(`Excluir ${item.name}? Esta ação remove também salas e inscrições.`)) return;
    try {
      await apiClient(`admin/events/${item.id}/`, { method: "DELETE" });
      setNotice("Evento excluído."); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível excluir o evento."); }
  }

  async function logout() { await fetch("/api/auth/logout", { method: "POST" }); router.push("/"); router.refresh(); }

  return (
    <main className="admin-console">
      <aside>
        <Brand href="/" />
        <span className="admin-badge"><ShieldCheck size={15} /> Superadmin</span>
        <nav>
          <button className={tab === "users" && !managedEvent ? "active" : ""} onClick={() => { setManagedEventId(null); setTab("users"); }}><Users size={18} /> Usuários</button>
          <button className={tab === "events" ? "active" : ""} onClick={() => { setManagedEventId(null); setTab("events"); }}><CalendarRange size={18} /> Todos os eventos</button>
        </nav>
        <div className="admin-side-footer"><Link href="/">Ver site</Link><button onClick={logout}><LogOut size={16} /> Sair</button></div>
      </aside>

      <section className="admin-content">
        {managedEvent ? <AdminEventPanel event={managedEvent} users={users} onBack={() => setManagedEventId(null)} onEventUpdated={load} /> : <>
        <header><div><p className="eyebrow">Administração global</p><h1>{tab === "users" ? "Usuários" : "Eventos"}</h1></div><span>{tab === "users" ? users.length : events.length} registros</span></header>
        {notice && <p className="form-success">{notice}</p>}
        {error && <p className="form-error">{error}</p>}

        {tab === "users" ? (
          <div className="admin-global-grid">
            <section className="dashboard-card admin-editor">
              <div className="card-header"><h2>{editingUser ? "Editar usuário" : "Novo usuário"}</h2>{editingUser && <button className="icon-button" onClick={() => setEditingUser(null)} aria-label="Cancelar edição"><X size={16} /></button>}</div>
              <form className="compact-form" key={editingUser?.id ?? "new-user"} onSubmit={submitUser}>
                <input name="username" placeholder="Usuário" defaultValue={editingUser?.username} required />
                <input name="email" type="email" placeholder="E-mail" defaultValue={editingUser?.email} required />
                <div className="form-grid"><input name="first_name" placeholder="Nome" defaultValue={editingUser?.first_name} /><input name="last_name" placeholder="Sobrenome" defaultValue={editingUser?.last_name} /></div>
                <input name="password" type="password" minLength={8} placeholder={editingUser ? "Nova senha (opcional)" : "Senha inicial"} required={!editingUser} />
                <select name="account_type" defaultValue={editingUser?.account_type ?? "attendee"}><option value="attendee">Participante</option><option value="organizer">Organizador</option></select>
                <label className="admin-checkbox"><input name="is_active" type="checkbox" value="true" defaultChecked={editingUser?.is_active ?? true} /> Conta ativa</label>
                <button className="button button-primary">{editingUser ? "Salvar alterações" : "Criar usuário"}</button>
              </form>
            </section>
            <section className="dashboard-card admin-global-list">
              <div className="card-header"><h2>Contas cadastradas</h2></div>
              {users.map((user) => <article key={user.id}><div><strong>{user.first_name || user.username} {user.last_name}</strong><span>{user.email} · @{user.username}{user.is_superuser ? " · superadmin" : ""}</span></div><select value={user.account_type} onChange={(event) => updateUser(user, { account_type: event.target.value as AdminUser["account_type"] })} disabled={user.is_superuser}><option value="attendee">Participante</option><option value="organizer">Organizador</option></select><label><input type="checkbox" checked={user.is_active} onChange={(event) => updateUser(user, { is_active: event.target.checked })} disabled={user.is_superuser} /> Ativo</label><button className="icon-button" onClick={() => setEditingUser(user)} aria-label={`Editar ${user.username}`}><Pencil size={16} /></button><button className="icon-button danger" onClick={() => deleteUser(user)} aria-label={`Excluir ${user.username}`} disabled={user.is_superuser}><Trash2 size={16} /></button></article>)}
            </section>
          </div>
        ) : (
          <div className="admin-global-grid">
            <section className="dashboard-card admin-editor">
              <div className="card-header"><h2>Novo evento</h2></div>
              <form className="compact-form" onSubmit={submitEvent}>
                <input name="name" placeholder="Nome do evento" required />
                <input name="slug" placeholder="slug-do-evento" required />
                <textarea name="description" placeholder="Descrição" rows={3} />
                <select name="owner" defaultValue="" required><option value="">Organizador responsável</option>{users.filter((user) => user.account_type === "organizer" || user.is_superuser).map((user) => <option key={user.id} value={user.id}>{user.first_name || user.username}</option>)}</select>
                <div className="form-grid"><input name="starts_at" type="datetime-local" required /><input name="ends_at" type="datetime-local" required /></div>
                <div className="form-grid"><select name="access_mode" defaultValue="public"><option value="public">Público</option><option value="registration">Conta obrigatória</option><option value="invite">Convidados</option></select><select name="status" defaultValue="draft"><option value="draft">Rascunho</option><option value="published">Publicado</option><option value="ended">Encerrado</option><option value="archived">Arquivado</option></select></div>
                <button className="button button-primary">Criar evento</button>
              </form>
            </section>
            <section className="dashboard-card admin-global-list">
              <div className="card-header"><h2>Todos os eventos</h2></div>
              {events.map((item) => <article key={item.id}><div><strong>{item.name}</strong><span>/{item.slug} · dono #{item.owner} · {item.status}</span></div><button className="button button-quiet" type="button" onClick={() => setManagedEventId(item.id)}>Gerenciar</button><button className="icon-button danger" onClick={() => deleteEvent(item)} aria-label={`Excluir ${item.name}`}><Trash2 size={16} /></button></article>)}
            </section>
          </div>
        )}
        </>}
      </section>
    </main>
  );
}
