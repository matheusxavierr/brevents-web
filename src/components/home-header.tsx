"use client";

import { ArrowRight, CalendarDays, ChevronDown, LoaderCircle, LogOut, Mail, Menu, PlusCircle, Radio, ShieldCheck, UserRound, Video, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import type { EventData } from "@/lib/api-types";
import { loadRegisteredEvents } from "@/lib/registered-events";
import { Brand } from "./brand";
import { useSession } from "./session-provider";

type OpenMenu = "produtos" | "eventos" | null;

function menuEventDate(event: EventData) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: event.timezone,
  }).format(new Date(event.starts_at));
}

export function HomeHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, setUser } = useSession();
  const [profileOpen, setProfileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false); // mobile hamburger
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const [myEvents, setMyEvents] = useState<EventData[] | null>(null);
  const headerRef = useRef<HTMLElement | null>(null);
  const currentUserId = user?.id ?? null;
  const [eventsUserId, setEventsUserId] = useState<number | null>(currentUserId);
  if (eventsUserId !== currentUserId) {
    setEventsUserId(currentUserId);
    setMyEvents(null);
    setOpenMenu(null);
  }

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setProfileOpen(false);
      setOpenMenu(null);
      setMenuOpen(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  useEffect(() => {
    if (!openMenu) return;
    function closeOnOutsideClick(event: MouseEvent) {
      if (headerRef.current && !headerRef.current.contains(event.target as Node)) setOpenMenu(null);
    }
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [openMenu]);

  useEffect(() => {
    if (openMenu !== "eventos" || !user || myEvents !== null) return;
    let active = true;
    loadRegisteredEvents()
      .then((items) => {
        if (active) setMyEvents(items);
      })
      .catch(() => {
        if (active) setMyEvents([]);
      });
    return () => {
      active = false;
    };
  }, [myEvents, openMenu, user]);

  function toggleMenu(menu: Exclude<OpenMenu, null>) {
    setOpenMenu((current) => (current === menu ? null : menu));
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setOpenMenu(null);
    setMenuOpen(false);
    router.refresh();
  }

  const produtosActive = pathname.startsWith("/servicos");
  const eventosActive = pathname.startsWith("/meus-eventos");

  return (
    <header ref={headerRef} className={menuOpen ? "home-header menu-open" : "home-header"}>
      <div className="home-header-inner">
        <Brand href="/" />
        <button className="home-menu-toggle" type="button" onClick={() => setMenuOpen((v) => !v)} aria-expanded={menuOpen} aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}>
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
        <nav className="home-product-switcher" aria-label="Soluções">
          {user ? (
            <>
              <div className="home-menu">
                <button className={`home-menu-trigger${produtosActive ? " active" : ""}`} type="button" aria-expanded={openMenu === "produtos"} aria-haspopup="true" onClick={() => toggleMenu("produtos")}>
                  Produtos <ChevronDown size={14} aria-hidden="true" />
                </button>
                {openMenu === "produtos" && (
                  <div className="home-menu-panel">
                    <Link href="/servicos/web-events" onClick={() => setOpenMenu(null)}>
                      <Radio size={17} aria-hidden="true" />
                      <span><strong>Web Events</strong><small>Transmissões, inscrições e palco moderado</small></span>
                    </Link>
                    <Link href="/servicos/meetings" onClick={() => setOpenMenu(null)}>
                      <Video size={17} aria-hidden="true" />
                      <span><strong>Meetings</strong><small>Reuniões colaborativas com câmera e chat</small></span>
                    </Link>
                  </div>
                )}
              </div>
              <div className="home-menu">
                <button className={`home-menu-trigger${eventosActive ? " active" : ""}`} type="button" aria-expanded={openMenu === "eventos"} aria-haspopup="true" onClick={() => toggleMenu("eventos")}>
                  Meus eventos <ChevronDown size={14} aria-hidden="true" />
                </button>
                {openMenu === "eventos" && (
                  <div className="home-menu-panel home-menu-events">
                    {myEvents === null && <span className="home-menu-loading"><LoaderCircle className="spin" size={15} /> Buscando suas inscrições…</span>}
                    {myEvents !== null && myEvents.length > 0 && (
                      <>
                        {myEvents.slice(0, 5).map((event) => (
                          <Link href={`/eventos/${event.slug}`} key={event.id} onClick={() => setOpenMenu(null)}>
                            <CalendarDays size={17} aria-hidden="true" />
                            <span><strong>{event.name}</strong><small>{menuEventDate(event)}{event.status === "ended" ? " · encerrado" : ""}</small></span>
                          </Link>
                        ))}
                        <Link className="home-menu-all" href="/meus-eventos" onClick={() => setOpenMenu(null)}>Ver todos os meus eventos <ArrowRight size={14} aria-hidden="true" /></Link>
                      </>
                    )}
                    {myEvents !== null && myEvents.length === 0 && (
                      <span className="home-menu-empty">Você ainda não está inscrito em nenhum evento.</span>
                    )}
                  </div>
                )}
              </div>
              <Link className={`home-menu-quick${pathname === "/meetings/novo" ? " active" : ""}`} href="/meetings/novo">
                <PlusCircle size={15} aria-hidden="true" /> Criar meeting
              </Link>
            </>
          ) : (
            <>
              <Link className={pathname === "/" || pathname === "/servicos/web-events" ? "active" : undefined} href="/servicos/web-events">
                Web Events
              </Link>
              <Link className={pathname === "/servicos/meetings" ? "active" : undefined} href="/servicos/meetings">
                Meetings
              </Link>
            </>
          )}
        </nav>
        <nav className="home-account-nav" aria-label="Conta">
          {user ? (
            <>
              <Link className={`home-quick-link${pathname === "/hub" ? " active" : undefined}`} href="/hub">Hub da empresa</Link>
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
          ) : (
            <>
              <Link className="home-signin" href="/entrar">Entrar</Link>
              <Link className="button button-primary" href="/criar-conta">Criar conta</Link>
            </>
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
              <Link className="button button-secondary" href="/meus-eventos" onClick={() => setProfileOpen(false)}>Meus eventos</Link>
              <Link className="button button-secondary" href="/meetings/novo" onClick={() => setProfileOpen(false)}>Criar meeting</Link>
              {user.account_type === "organizer" && <Link className="button button-primary" href="/painel" onClick={() => setProfileOpen(false)}>Meu painel</Link>}
            </div>
          </section>
        </div>
      )}
    </header>
  );
}
