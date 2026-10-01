"use client";

import Link from "next/link";
import { LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Brand } from "./brand";
import type { User } from "@/lib/api-types";

export function HomeHeader() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me").then(async (response) => {
      if (response.ok) setUser(await response.json());
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    router.refresh();
  }

  return <header className="home-header"><div className="container home-header-inner"><Brand href="/" /><nav aria-label="Navegação principal"><Link href="/servicos/web-events">Web Events</Link><Link href="/servicos/meetings">Meetings</Link>{loaded && user ? <><span className="home-user"><span className="avatar">{user.first_name?.slice(0, 1) || "U"}</span>{user.name || user.username}</span>{user.account_type === "organizer" && <Link className="button button-secondary" href="/painel">Meu painel</Link>}{user.is_superuser && <Link className="button button-primary" href="/admin">Admin</Link>}<button className="home-logout" type="button" onClick={logout} aria-label="Sair da conta"><LogOut size={17} /></button></> : loaded ? <><Link href="/entrar">Entrar</Link><Link className="button button-primary" href="/criar-conta">Criar conta</Link></> : null}</nav></div></header>;
}
