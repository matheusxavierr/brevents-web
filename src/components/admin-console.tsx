"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CalendarRange, LogOut, Pencil, ShieldCheck, Trash2, Users, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Brand } from "./brand";
import { LanguageSwitcher } from "./language-switcher";
import { AdminEventPanel } from "./admin-event-panel";
import { useI18n } from "./i18n-provider";
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
  const { t } = useI18n();
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
      catch (reason) { if (active) setError(reason instanceof Error ? reason.message : t("Falha ao abrir o admin.")); }
    }
    void bootstrap();
    return () => { active = false; };
  }, [load, t]);

  async function submitUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    const form = event.currentTarget;
    const data: Record<string, unknown> = Object.fromEntries(new FormData(form));
    data.is_active = data.is_active === "true";
    if (!data.password) delete data.password;
    try {
      if (editingUser) {
        await apiClient(`admin/users/${editingUser.id}/`, { method: "PATCH", body: data });
        setNotice(t("Usuário atualizado."));
      } else {
        await apiClient("admin/users/", { method: "POST", body: data });
        setNotice(t("Usuário criado."));
      }
      setEditingUser(null); form.reset(); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : t("Não foi possível salvar o usuário.")); }
  }

  async function updateUser(user: AdminUser, changes: Partial<AdminUser>) {
    try {
      await apiClient(`admin/users/${user.id}/`, { method: "PATCH", body: changes });
      setNotice(t("Usuário atualizado.")); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : t("Não foi possível atualizar o usuário.")); }
  }

  async function deleteUser(user: AdminUser) {
    if (!window.confirm(t("Excluir {name}? Esta ação não pode ser desfeita.", { name: user.username }))) return;
    try {
      await apiClient(`admin/users/${user.id}/`, { method: "DELETE" });
      setNotice(t("Usuário excluído.")); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : t("Não foi possível excluir o usuário.")); }
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
      setNotice(t("Evento criado."));
      form.reset(); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : t("Não foi possível salvar o evento.")); }
  }

  async function deleteEvent(item: AdminEvent) {
    if (!window.confirm(t("Excluir {name}? Esta ação remove também salas e inscrições.", { name: item.name }))) return;
    try {
      await apiClient(`admin/events/${item.id}/`, { method: "DELETE" });
      setNotice(t("Evento excluído.")); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : t("Não foi possível excluir o evento.")); }
  }

  async function logout() { await fetch("/api/auth/logout", { method: "POST" }); router.push("/"); router.refresh(); }

  return (
    <main className="admin-console">
      <aside>
        <Brand href="/" />
        <span className="admin-badge"><ShieldCheck size={15} /> {t("Superadmin")}</span>
        <nav>
          <button className={tab === "users" && !managedEvent ? "active" : ""} onClick={() => { setManagedEventId(null); setTab("users"); }}><Users size={18} /> {t("Usuários")}</button>
          <button className={tab === "events" ? "active" : ""} onClick={() => { setManagedEventId(null); setTab("events"); }}><CalendarRange size={18} /> {t("Todos os eventos")}</button>
        </nav>
        <div className="admin-side-footer"><LanguageSwitcher className="admin-language" /><Link href="/">{t("Ver site")}</Link><button onClick={logout}><LogOut size={16} /> {t("Sair")}</button></div>
      </aside>

      <section className="admin-content">
        {managedEvent ? <AdminEventPanel event={managedEvent} users={users} onBack={() => setManagedEventId(null)} onEventUpdated={load} /> : <>
        <header><div><p className="eyebrow">{t("Administração global")}</p><h1>{tab === "users" ? t("Usuários") : t("Eventos")}</h1></div><span>{t("{count} registros", { count: tab === "users" ? users.length : events.length })}</span></header>
        {notice && <p className="form-success">{notice}</p>}
        {error && <p className="form-error">{error}</p>}

        {tab === "users" ? (
          <div className="admin-global-grid">
            <section className="dashboard-card admin-editor">
              <div className="card-header"><h2>{editingUser ? t("Editar usuário") : t("Novo usuário")}</h2>{editingUser && <button className="icon-button" onClick={() => setEditingUser(null)} aria-label={t("Cancelar edição")}><X size={16} /></button>}</div>
              <form className="compact-form" key={editingUser?.id ?? "new-user"} onSubmit={submitUser}>
                <input name="username" placeholder={t("Usuário")} defaultValue={editingUser?.username} required />
                <input name="email" type="email" placeholder={t("E-mail")} defaultValue={editingUser?.email} required />
                <div className="form-grid"><input name="first_name" placeholder={t("Nome")} defaultValue={editingUser?.first_name} /><input name="last_name" placeholder={t("Sobrenome")} defaultValue={editingUser?.last_name} /></div>
                <input name="password" type="password" minLength={8} placeholder={editingUser ? t("Nova senha (opcional)") : t("Senha inicial")} required={!editingUser} />
                <select name="account_type" defaultValue={editingUser?.account_type ?? "attendee"}><option value="attendee">{t("Participante")}</option><option value="organizer">{t("Organizador")}</option></select>
                <label className="admin-checkbox"><input name="is_active" type="checkbox" value="true" defaultChecked={editingUser?.is_active ?? true} /> {t("Conta ativa")}</label>
                <button className="button button-primary">{editingUser ? t("Salvar alterações") : t("Criar usuário")}</button>
              </form>
            </section>
            <section className="dashboard-card admin-global-list">
              <div className="card-header"><h2>{t("Contas cadastradas")}</h2></div>
              {users.map((user) => <article key={user.id}><div><strong>{user.first_name || user.username} {user.last_name}</strong><span>{user.email} · @{user.username}{user.is_superuser ? ` · ${t("superadmin")}` : ""}</span></div><select value={user.account_type} onChange={(event) => updateUser(user, { account_type: event.target.value as AdminUser["account_type"] })} disabled={user.is_superuser}><option value="attendee">{t("Participante")}</option><option value="organizer">{t("Organizador")}</option></select><label><input type="checkbox" checked={user.is_active} onChange={(event) => updateUser(user, { is_active: event.target.checked })} disabled={user.is_superuser} /> {t("Ativo")}</label><button className="icon-button" onClick={() => setEditingUser(user)} aria-label={t("Editar {name}", { name: user.username })}><Pencil size={16} /></button><button className="icon-button danger" onClick={() => deleteUser(user)} aria-label={t("Excluir {name}", { name: user.username })} disabled={user.is_superuser}><Trash2 size={16} /></button></article>)}
            </section>
          </div>
        ) : (
          <div className="admin-global-grid">
            <section className="dashboard-card admin-editor">
              <div className="card-header"><h2>{t("Novo evento")}</h2></div>
              <form className="compact-form" onSubmit={submitEvent}>
                <input name="name" placeholder={t("Nome do evento")} required />
                <input name="slug" placeholder={t("slug-do-evento")} required />
                <textarea name="description" placeholder={t("Descrição")} rows={3} />
                <select name="owner" defaultValue="" required><option value="">{t("Organizador responsável")}</option>{users.filter((user) => user.account_type === "organizer" || user.is_superuser).map((user) => <option key={user.id} value={user.id}>{user.first_name || user.username}</option>)}</select>
                <div className="form-grid"><input name="starts_at" type="datetime-local" required /><input name="ends_at" type="datetime-local" required /></div>
                <div className="form-grid"><select name="access_mode" defaultValue="public"><option value="public">{t("Público")}</option><option value="registration">{t("Conta obrigatória")}</option><option value="invite">{t("Convidados")}</option></select><select name="status" defaultValue="draft"><option value="draft">{t("Rascunho")}</option><option value="published">{t("Publicado")}</option><option value="ended">{t("Encerrado")}</option><option value="archived">{t("Arquivado")}</option></select></div>
                <button className="button button-primary">{t("Criar evento")}</button>
              </form>
            </section>
            <section className="dashboard-card admin-global-list">
              <div className="card-header"><h2>{t("Todos os eventos")}</h2></div>
              {events.map((item) => <article key={item.id}><div><strong>{item.name}</strong><span>{t("/{slug} · dono #{owner} · {status}", { slug: item.slug, owner: item.owner, status: item.status })}</span></div><button className="button button-quiet" type="button" onClick={() => setManagedEventId(item.id)}>{t("Gerenciar")}</button><button className="icon-button danger" onClick={() => deleteEvent(item)} aria-label={t("Excluir {name}", { name: item.name })}><Trash2 size={16} /></button></article>)}
            </section>
          </div>
        )}
        </>}
      </section>
    </main>
  );
}
