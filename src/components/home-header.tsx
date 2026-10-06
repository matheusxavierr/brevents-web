"use client";

import { LogOut, Mail, ShieldCheck, UserRound, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import type { User } from "@/lib/api-types";
import { Brand } from "./brand";

export function HomeHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then(async (response) => {
        if (response.ok) setUser(await response.json());
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (!profileOpen) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setProfileOpen(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [profileOpen]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    router.refresh();
  }

  return (
    <header className="home-header">
      <div className="home-header-inner">
        <Brand href="/" />
        <nav className="home-product-switcher" aria-label="Soluções">
          <Link className={pathname === "/" || pathname === "/servicos/web-events" ? "active" : undefined} href="/servicos/web-events">
            Web Events
          </Link>
          <Link className={pathname === "/servicos/meetings" ? "active" : undefined} href="/servicos/meetings">
            Meetings
          </Link>
          {loaded && user && (
            <Link className={pathname === "/hub" ? "active" : undefined} href="/hub">
              Hub da empresa
            </Link>
          )}
        </nav>
        <nav className="home-account-nav" aria-label="Conta">
          {loaded && user ? (
            <>
              <button className="home-user" type="button" onClick={() => setProfileOpen(true)} aria-haspopup="dialog">
                <span className="avatar">{user.first_name?.slice(0, 1) || "U"}</span>
                <span>{user.name || user.username}</span>
              </button>
              {user.account_type === "organizer" && <Link className="button button-secondary" href="/painel">Meu painel</Link>}
              {user.is_superuser && <Link className="button button-primary" href="/admin">Admin</Link>}
              <button className="home-logout" type="button" onClick={logout} aria-label="Sair da conta">
                <LogOut size={17} />
              </button>
            </>
          ) : loaded ? (
            <>
              <Link className="home-signin" href="/entrar">Entrar</Link>
              <Link className="button button-primary" href="/criar-conta">Criar conta</Link>
            </>
          ) : (
            <span className="home-account-loading" aria-hidden="true" />
          )}
        </nav>
      </div>
      {profileOpen && user && (
        <div className="profile-modal-backdrop" role="presentation" onMouseDown={() => setProfileOpen(false)}>
          <section className="profile-modal" role="dialog" aria-modal="true" aria-labelledby="profile-title" onMouseDown={(event) => event.stopPropagation()}>
            <button className="icon-button profile-modal-close" type="button" onClick={() => setProfileOpen(false)} aria-label="Fechar perfil"><X size={17} /></button>
            <span className="profile-modal-avatar">{user.first_name?.slice(0, 1) || "U"}</span>
            <p className="eyebrow"><UserRound size={14} /> Sua conta</p>
            <h2 id="profile-title">{user.name || user.username}</h2>
            <dl>
              <div><dt><Mail size={15} /> E-mail</dt><dd>{user.email}</dd></div>
              <div><dt><ShieldCheck size={15} /> Perfil</dt><dd>{user.account_type === "organizer" ? "Organizador" : "Participante"}</dd></div>
            </dl>
            <div className="profile-modal-actions">
              <Link className="button button-secondary" href="/hub" onClick={() => setProfileOpen(false)}>Hub da empresa</Link>
              {user.account_type === "organizer" && <Link className="button button-primary" href="/painel" onClick={() => setProfileOpen(false)}>Meu painel</Link>}
            </div>
          </section>
        </div>
      )}
    </header>
  );
}
