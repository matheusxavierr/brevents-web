"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { CheckCircle2, LoaderCircle } from "lucide-react";
import { apiClient, readError } from "@/lib/api-client";
import type { Registration, User } from "@/lib/api-types";
import { useSession } from "./session-provider";

export function RegistrationForm({ eventId, eventSlug, accessMode }: { eventId: string; eventSlug: string; accessMode: "public" | "registration" | "invite" }) {
  const { user, setUser } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [registration, setRegistration] = useState<Registration | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      if (!user && accessMode === "public") {
        const response = await fetch("/api/guest/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ event: eventId, name: data.name, email: data.email, profile: { company: data.company, role: data.role }, consent_at: new Date().toISOString() }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(readError(result));
        setRegistration(result as Registration);
        return;
      }
      let activeUser = user;
      if (!activeUser) {
        const response = await fetch("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: data.name, email: data.email, password: data.password }) });
        const result = await response.json();
        if (!response.ok) throw new Error(readError(result));
        activeUser = result as User; setUser(activeUser);
      }
      const created = await apiClient<Registration>("registrations/", { method: "POST", body: { event: eventId, name: activeUser.name || data.name, email: activeUser.email || data.email, profile: { company: data.company, role: data.role }, consent_at: new Date().toISOString() } });
      setRegistration(created);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível concluir sua inscrição."); }
    finally { setLoading(false); }
  }

  if (registration) return <div className="success-panel"><CheckCircle2 size={42} /><p className="eyebrow">Inscrição confirmada</p><h2>Você está dentro.</h2><p>{user ? "Seu ingresso está associado à sua conta." : "Seu ingresso foi salvo neste navegador. Você já pode assistir sem criar uma conta."}</p><div className="inline-actions"><Link className="button button-primary" href={`/eventos/${eventSlug}/ao-vivo`}>Entrar no evento</Link>{!user && <Link className="button button-secondary" href={`/criar-conta?next=/eventos/${eventSlug}/ao-vivo`}>Criar conta para interagir</Link>}</div></div>;

  return <form className="registration-form" onSubmit={submit}>
    <div className="form-grid">
      <label className="field"><span>Nome completo</span><input name="name" defaultValue={user?.name} disabled={Boolean(user)} required /></label>
      <label className="field"><span>E-mail</span><input name="email" type="email" defaultValue={user?.email} disabled={Boolean(user)} required /></label>
      {!user && accessMode !== "public" && <label className="field field-wide"><span>Crie uma senha para acessar o evento</span><input name="password" type="password" autoComplete="new-password" minLength={8} required /></label>}
      <label className="field"><span>Empresa</span><input name="company" /></label>
      <label className="field"><span>Cargo</span><input name="role" /></label>
    </div>
    <label className="check-field"><input name="consent" type="checkbox" required /><span>Concordo com o uso dos meus dados para a realização deste evento.</span></label>
    {error && <p className="form-error" role="alert">{error} {!user && accessMode !== "public" && <Link href={`/entrar?next=/eventos/${eventSlug}/inscricao`}>Entrar em uma conta existente</Link>}</p>}
    <button className="button button-primary" type="submit" disabled={loading}>{loading && <LoaderCircle className="spin" size={18} />}Confirmar inscrição</button>
  </form>;
}
