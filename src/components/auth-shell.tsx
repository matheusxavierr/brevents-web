"use client";

import { LanguageSwitcher } from "./language-switcher";
import { Brand } from "./brand";
import { useI18n } from "./i18n-provider";

export function AuthShell({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  const { t } = useI18n();
  return (
    <main className="auth-page">
      <section className="auth-brand-panel" aria-label="BR Events">
        <Brand />
        <div><p className="eyebrow">{t("Eventos com presença")}</p><h1>{t("Uma plataforma.")}<br />{t("Toda a experiência.")}</h1><p>{t("Crie, transmita e acompanhe eventos que continuam relevantes depois do ao vivo.")}</p></div>
        <small>{t("BR Events · Produto e comunidade no mesmo lugar.")}</small>
      </section>
      <section className="auth-card-wrap">
        <div className="auth-card">
          <div className="auth-mobile-brand"><Brand /></div>
          <div className="auth-card-top"><p className="eyebrow">{t("Bem-vindo")}</p><LanguageSwitcher className="auth-language-inline" /></div>
          <h2>{title}</h2>
          <p className="muted">{description}</p>
          {children}
        </div>
      </section>
    </main>
  );
}
