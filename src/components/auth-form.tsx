"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CircleAlert, LoaderCircle } from "lucide-react";
import { readError } from "@/lib/api-client";

export function AuthForm({ mode, nextPath = "/", defaultAccountType = "attendee" }: { mode: "login" | "register"; nextPath?: string; defaultAccountType?: "attendee" | "organizer" }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const response = await fetch(`/api/auth/${mode === "login" ? "login" : "register"}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      setError(response.status === 401 ? "E-mail ou senha inválidos." : readError(data));
      setLoading(false);
      return;
    }
    router.push(nextPath.startsWith("/") ? nextPath : "/painel");
    router.refresh();
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      {mode === "register" && (
        <>
          <label className="field"><span>Nome completo</span><input name="name" autoComplete="name" required /></label>
          <label className="field"><span>Como você quer usar a BR Events?</span><select name="account_type" defaultValue={defaultAccountType}><option value="attendee">Quero participar de eventos</option><option value="organizer">Quero criar eventos e meetings</option></select></label>
        </>
      )}
      <label className="field">
        <span>E-mail</span>
        <input
          name="email"
          type="email"
          autoComplete={mode === "login" ? "username" : "email"}
          required
        />
      </label>
      <label className="field"><span>Senha</span><input name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={8} required /></label>
      {error && <p className="form-error" role="alert"><CircleAlert size={18} /> {error}</p>}
      <button className="button button-primary button-full" type="submit" disabled={loading}>
        {loading ? <LoaderCircle className="spin" size={18} /> : <ArrowRight size={18} />}
        {mode === "login" ? "Entrar" : "Criar minha conta"}
      </button>
      <p className="auth-switch">
        {mode === "login" ? "Ainda não tem uma conta? " : "Já tem uma conta? "}
        <Link href={mode === "login" ? "/criar-conta" : `/entrar?next=${encodeURIComponent(nextPath)}`}>{mode === "login" ? "Cadastre-se" : "Entrar"}</Link>
      </p>
    </form>
  );
}
