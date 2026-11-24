"use client";

import { ArrowRight, CalendarDays, ChevronDown, LoaderCircle, LogOut, Mail, Menu, PlusCircle, Radio, ShieldCheck, UserRound, Video, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import type { EventData } from "@/lib/api-types";
import { localeIntl } from "@/lib/i18n";
import { loadRegisteredEvents } from "@/lib/registered-events";
import { Brand } from "./brand";
import { LanguageSwitcher } from "./language-switcher";
import { useI18n } from "./i18n-provider";
import { useSession } from "./session-provider";

type OpenMenu = "produtos" | "eventos" | null;

function menuEventDate(locale: string, event: EventData) {
  return new Intl.DateTimeFormat(locale, {
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
  const { locale, t } = useI18n();
  const [profileOpen, setProfileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
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
    if (!openMenu && !menuOpen) return;
    function closeOnOutsideClick(event: MouseEvent) {
      if (headerRef.current && !headerRef.current.contains(event.target as Node)) {
        setOpenMenu(null);
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [menuOpen, openMenu]);

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
        <button className="home-menu-toggle" type="button" onClick={() => {
          setOpenMenu(null);
          setMenuOpen((value) => !value);
        }} aria-expanded={menuOpen} aria-controls="home-navigation" aria-label={menuOpen ? t("Fechar menu") : t("Abrir menu")}>
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
        <div id="home-navigation" className="home-navigation" onClick={(event) => {
          if (menuOpen && event.target instanceof Element && event.target.closest("a[href]")) setMenuOpen(false);
        }}>
        <nav className="home-product-switcher" aria-label={t("Soluções")}>
          {user ? (
            <>
              <div className="home-menu">
                <button className={`home-menu-trigger${produtosActive ? " active" : ""}`} type="button" aria-expanded={openMenu === "produtos"} aria-haspopup="true" onClick={() => toggleMenu("produtos")}>
                  {t("Produtos")} <ChevronDown size={14} aria-hidden="true" />
                </button>
                {openMenu === "produtos" && (
                  <div className="home-menu-panel">
                    <Link href="/servicos/web-events" onClick={() => setOpenMenu(null)}>
                      <Radio size={17} aria-hidden="true" />
                      <span><strong>{t("Web Events")}</strong><small>{t("Transmissões, inscrições e palco moderado")}</small></span>
                    </Link>
                    <Link href="/servicos/meetings" onClick={() => setOpenMenu(null)}>
                      <Video size={17} aria-hidden="true" />
                      <span><strong>{t("Meetings")}</strong><small>{t("Reuniões colaborativas com câmera e chat")}</small></span>
                    </Link>
                  </div>
                )}
              </div>
              <div className="home-menu">
                <button className={`home-menu-trigger${eventosActive ? " active" : ""}`} type="button" aria-expanded={openMenu === "eventos"} aria-haspopup="true" onClick={() => toggleMenu("eventos")}>
                  {t("Meus eventos")} <ChevronDown size={14} aria-hidden="true" />
                </button>
                {openMenu === "eventos" && (
                  <div className="home-menu-panel home-menu-events">
                    {myEvents === null && <span className="home-menu-loading"><LoaderCircle className="spin" size={15} /> {t("Buscando suas inscrições…")}</span>}
                    {myEvents !== null && myEvents.length > 0 && (
                      <>
                        {myEvents.slice(0, 5).map((event) => (
                          <Link href={`/eventos/${event.slug}`} key={event.id} onClick={() => setOpenMenu(null)}>
                            <CalendarDays size={17} aria-hidden="true" />
                            <span><strong>{event.name}</strong><small>{menuEventDate(localeIntl[locale], event)}{event.status === "ended" ? ` · ${t("encerrado")}` : ""}</small></span>
                          </Link>
                        ))}
                        <Link className="home-menu-all" href="/meus-eventos" onClick={() => setOpenMenu(null)}>{t("Ver todos os meus eventos")} <ArrowRight size={14} aria-hidden="true" /></Link>
                      </>
                    )}
                    {myEvents !== null && myEvents.length === 0 && (
                      <span className="home-menu-empty">{t("Você ainda não está inscrito em nenhum evento.")}</span>
                    )}
                  </div>
                )}
              </div>
              <Link className={`home-menu-quick${pathname === "/meetings/novo" ? " active" : ""}`} href="/meetings/novo">
                <PlusCircle size={15} aria-hidden="true" /> {t("Criar meeting")}
              </Link>
            </>
          ) : (
            <>
              <Link className={pathname === "/" || pathname === "/servicos/web-events" ? "active" : undefined} href="/servicos/web-events">
                {t("Web Events")}
              </Link>
              <Link className={pathname === "/servicos/meetings" ? "active" : undefined} href="/servicos/meetings">
                {t("Meetings")}
              </Link>
            </>
          )}
        </nav>
        <nav className="home-account-nav" aria-label={t("Conta")}>
          {user ? (
            <>
              <Link className={`home-quick-link${pathname === "/hub" ? " active" : undefined}`} href="/hub">{t("Hub da empresa")}</Link>
              <button className="home-user" type="button" onClick={() => setProfileOpen(true)} aria-haspopup="dialog">
                <span className="avatar">{user.first_name?.slice(0, 1) || "U"}</span>
                <span>{user.name || user.username}</span>
              </button>
              {(user.account_type === "organizer" || user.can_manage_events) && <Link className="button button-secondary" href="/painel">{t("Meu painel")}</Link>}
              {user.is_superuser && <Link className="button button-primary" href="/admin">{t("Admin")}</Link>}
              <LanguageSwitcher className="home-language" />
              <button className="home-logout" type="button" onClick={logout} aria-label={t("Sair da conta")}>
                <LogOut size={17} />
                <span>{t("Sair da conta")}</span>
              </button>
            </>
          ) : (
            <>
              <LanguageSwitcher className="home-language" />
              <Link className="home-signin" href="/entrar">{t("Entrar")}</Link>
              <Link className="button button-primary" href="/criar-conta">{t("Criar conta")}</Link>
            </>
          )}
        </nav>
        </div>
      </div>
      {profileOpen && user && (
        <div className="profile-modal-backdrop" role="presentation" onMouseDown={() => setProfileOpen(false)}>
          <section className="profile-modal" role="dialog" aria-modal="true" aria-labelledby="profile-title" onMouseDown={(event) => event.stopPropagation()}>
            <button className="icon-button profile-modal-close" type="button" onClick={() => setProfileOpen(false)} aria-label={t("Fechar perfil")}><X size={17} /></button>
            <span className="profile-modal-avatar">{user.first_name?.slice(0, 1) || "U"}</span>
            <p className="eyebrow"><UserRound size={14} /> {t("Sua conta")}</p>
            <h2 id="profile-title">{user.name || user.username}</h2>
            <dl>
              <div><dt><Mail size={15} /> {t("E-mail")}</dt><dd>{user.email}</dd></div>
              <div><dt><ShieldCheck size={15} /> {t("Perfil")}</dt><dd>{user.account_type === "organizer" ? t("Organizador") : user.can_manage_events ? t("Coordenador de evento") : t("Participante")}</dd></div>
            </dl>
            <div className="profile-modal-actions">
              <Link className="button button-secondary" href="/hub" onClick={() => setProfileOpen(false)}>{t("Hub da empresa")}</Link>
              <Link className="button button-secondary" href="/meus-eventos" onClick={() => setProfileOpen(false)}>{t("Meus eventos")}</Link>
              <Link className="button button-secondary" href="/meetings/novo" onClick={() => setProfileOpen(false)}>{t("Criar meeting")}</Link>
              {(user.account_type === "organizer" || user.can_manage_events) && <Link className="button button-primary" href="/painel" onClick={() => setProfileOpen(false)}>{t("Meu painel")}</Link>}
            </div>
          </section>
        </div>
      )}
    </header>
  );
}
