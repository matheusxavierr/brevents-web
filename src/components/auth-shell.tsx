import { Brand } from "./brand";

export function AuthShell({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <main className="auth-page">
      <section className="auth-brand-panel" aria-label="BR Events">
        <Brand />
        <div><p className="eyebrow">Eventos com presença</p><h1>Uma plataforma.<br />Toda a experiência.</h1><p>Crie, transmita e acompanhe eventos que continuam relevantes depois do ao vivo.</p></div>
        <small>BR Events · Produto e comunidade no mesmo lugar.</small>
      </section>
      <section className="auth-card-wrap">
        <div className="auth-card">
          <div className="auth-mobile-brand"><Brand /></div>
          <p className="eyebrow">Bem-vindo</p>
          <h2>{title}</h2>
          <p className="muted">{description}</p>
          {children}
        </div>
      </section>
    </main>
  );
}
