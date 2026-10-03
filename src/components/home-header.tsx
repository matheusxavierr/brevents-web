"use client";

import { LogOut } from "lucide-react";
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

  useEffect(() => {
    fetch("/api/auth/me")
      .then(async (response) => {
        if (response.ok) setUser(await response.json());
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

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
        </nav>
        <nav className="home-account-nav" aria-label="Conta">
          {loaded && user ? (
            <>
              <span className="home-user">
                <span className="avatar">{user.first_name?.slice(0, 1) || "U"}</span>
                <span>{user.name || user.username}</span>
              </span>
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
    </header>
  );
}
